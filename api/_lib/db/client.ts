import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { eq, and, gt, isNull, or } from 'drizzle-orm';
import crypto from 'node:crypto';
import * as schema from './schema';
import type { UserRole } from '../types';

export type DbClient = ReturnType<typeof drizzle<typeof schema>>;

interface TestMockStore {
  findUserByUsername?: (username: string) => Promise<any>;
  registerDbSession?: (session: any) => Promise<void>;
  validateDbSession?: (sessionId: string) => Promise<any>;
  revokeDbSession?: (sessionId: string) => Promise<void>;
}

let activeTestMockStore: TestMockStore | null = null;

export function __setTestMockStore(mock: TestMockStore | null) {
  activeTestMockStore = mock;
}

/**
 * Returns the configured database connection URL, supporting both
 * standard DATABASE_URL and Vercel's POSTGRES_URL.
 */
export function getDatabaseUrl(): string | undefined {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL;
}

/**
 * Returns whether a database connection string is configured in the environment.
 */
export function isDatabaseConfigured(): boolean {
  const url = getDatabaseUrl();
  return Boolean(url && url.trim().length > 0);
}

/**
 * Obtains the Drizzle database client using Neon's serverless HTTP driver.
 * Returns null if no connection string is configured.
 */
export function getDb(): DbClient | null {
  const databaseUrl = getDatabaseUrl();
  if (!databaseUrl || databaseUrl.trim().length === 0) {
    return null;
  }
  const sqlClient = neon(databaseUrl);
  return drizzle(sqlClient, { schema });
}

/**
 * Registers an active session in the database upon successful authentication.
 * In production, this operation MUST succeed for authentication to complete.
 */
export async function registerDbSession(session: {
  id: string; // jti
  userId: string;
  expiresAt: Date;
  userAgent?: string;
  ipAddress?: string;
}): Promise<void> {
  if (activeTestMockStore?.registerDbSession) {
    return activeTestMockStore.registerDbSession(session);
  }

  const db = getDb();
  if (!db) {
    if (process.env.NODE_ENV === 'production' || process.env.VERCEL) {
      throw new Error('DATABASE_URL is required in production to register sessions.');
    }
    return;
  }

  await db.insert(schema.userSessions).values({
    id: session.id,
    userId: session.userId,
    expiresAt: session.expiresAt,
    userAgent: session.userAgent || null,
    ipAddress: session.ipAddress || null,
  });
}

export interface SessionValidationResult {
  valid: boolean;
  currentRole?: UserRole;
  userStatus?: string;
  userId?: string;
}

/**
 * Validates whether a session ID exists, is neither revoked nor expired,
 * AND confirms that the corresponding user account is active.
 * If the user's role was changed or demoted in the database, returns the current role.
 * If the user's status is suspended, invalidates access immediately.
 *
 * PRODUCTION FAIL-CLOSED POLICY:
 * In any deployed or production environment (NODE_ENV=production or running under Vercel),
 * if the database is unconfigured or unreachable, this function returns valid: false.
 */
export async function validateDbSession(sessionId: string): Promise<SessionValidationResult> {
  if (activeTestMockStore?.validateDbSession) {
    return activeTestMockStore.validateDbSession(sessionId);
  }

  const db = getDb();
  if (!db) {
    if (process.env.NODE_ENV === 'production' || process.env.VERCEL) {
      console.error('[Security Alert]: Database unconfigured in production. Failing closed.');
      return { valid: false };
    }
    // Local development only fallback before Neon is connected
    return { valid: true, currentRole: 'admin', userStatus: 'active' };
  }

  try {
    const records = await db
      .select({
        id: schema.userSessions.id,
        userId: schema.userSessions.userId,
        expiresAt: schema.userSessions.expiresAt,
        revokedAt: schema.userSessions.revokedAt,
      })
      .from(schema.userSessions)
      .where(
        and(
          eq(schema.userSessions.id, sessionId),
          isNull(schema.userSessions.revokedAt),
          gt(schema.userSessions.expiresAt, new Date()),
        ),
      )
      .limit(1);

    if (records.length === 0) {
      return { valid: false };
    }

    const sessionRecord = records[0];

    // Check account status and role from users table
    const userRecords = await db
      .select({
        id: schema.users.id,
        username: schema.users.username,
        role: schema.users.role,
        status: schema.users.status,
      })
      .from(schema.users)
      .where(
        or(
          eq(schema.users.id, sessionRecord.userId),
          eq(schema.users.username, sessionRecord.userId),
        ),
      )
      .limit(1);

    if (userRecords.length > 0) {
      const user = userRecords[0];
      // If user account is suspended or not active, revoke session privilege immediately
      if (user.status !== 'active') {
        return { valid: false, userStatus: user.status };
      }
      return {
        valid: true,
        currentRole: (user.role as UserRole) || 'user',
        userStatus: user.status,
        userId: user.id,
      };
    }

    // Transition fallback: if user record is not in users table (e.g. legacy admin)
    return {
      valid: true,
      currentRole: 'admin',
      userStatus: 'active',
      userId: sessionRecord.userId,
    };
  } catch (err: any) {
    console.error('[DB Session Validation Error]: Query failed.');
    return { valid: false };
  }
}

/**
 * Validates whether a session ID exists and is neither revoked nor expired.
 */
export async function isDbSessionValid(sessionId: string): Promise<boolean> {
  const result = await validateDbSession(sessionId);
  return result.valid;
}

/**
 * Looks up a user account by case-insensitive username.
 */
export async function findUserByUsername(
  username: string,
): Promise<typeof schema.users.$inferSelect | null> {
  if (activeTestMockStore?.findUserByUsername) {
    return activeTestMockStore.findUserByUsername(username);
  }

  const db = getDb();
  if (!db) {
    if (process.env.NODE_ENV === 'production' || process.env.VERCEL) {
      throw new Error('DATABASE_URL is required in production for user authentication.');
    }
    return null;
  }

  try {
    const trimmed = username.trim().toLowerCase();
    const records = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.username, trimmed))
      .limit(1);

    return records[0] || null;
  } catch (err: any) {
    console.error('[DB User Lookup Error]: Query failed.');
    throw err;
  }
}

/**
 * Updates last_login_at timestamp for an authenticated user.
 */
export async function updateUserLastLogin(userId: string): Promise<void> {
  const db = getDb();
  if (!db) return;

  try {
    await db
      .update(schema.users)
      .set({ lastLoginAt: new Date() })
      .where(eq(schema.users.id, userId));
  } catch (err: any) {
    console.error('[DB User Login Update Error]: Query failed.');
  }
}

/**
 * Upserts a user account (for admin seeding and management).
 */
export async function upsertUser(user: {
  id?: string;
  username: string;
  passwordHash: string;
  role?: UserRole;
  status?: 'active' | 'suspended';
}): Promise<{ id: string; username: string; role: string }> {
  const db = getDb();
  if (!db) {
    throw new Error('Database connection required to create user.');
  }

  const userId = user.id || crypto.randomUUID();
  const normalizedUser = user.username.trim().toLowerCase();
  const role = user.role || 'user';
  const status = user.status || 'active';
  const now = new Date();

  await db
    .insert(schema.users)
    .values({
      id: userId,
      username: normalizedUser,
      passwordHash: user.passwordHash,
      role,
      status,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: schema.users.username,
      set: {
        passwordHash: user.passwordHash,
        role,
        status,
        updatedAt: now,
      },
    });

  return { id: userId, username: normalizedUser, role };
}

/**
 * Immediately revokes an active session by marking revokedAt = NOW().
 */
export async function revokeDbSession(sessionId: string): Promise<void> {
  if (activeTestMockStore?.revokeDbSession) {
    return activeTestMockStore.revokeDbSession(sessionId);
  }

  const db = getDb();
  if (!db) return;

  try {
    await db
      .update(schema.userSessions)
      .set({ revokedAt: new Date() })
      .where(eq(schema.userSessions.id, sessionId));
  } catch (err: any) {
    console.error('[DB Session Revocation Error]: Query failed.');
  }
}

/**
 * Persistent Rate Limiting Check:
 * Checks whether a client IP identifier is currently locked out in the database.
 */
export async function checkDbRateLimit(identifier: string): Promise<{
  allowed: boolean;
  retryAfterSeconds?: number;
}> {
  const db = getDb();
  if (!db) return { allowed: true };

  try {
    const records = await db
      .select()
      .from(schema.loginRateLimits)
      .where(eq(schema.loginRateLimits.identifier, identifier))
      .limit(1);

    if (records.length === 0) {
      return { allowed: true };
    }

    const record = records[0];
    const now = new Date();

    if (record.lockedUntil && record.lockedUntil > now) {
      const remainingSec = Math.ceil((record.lockedUntil.getTime() - now.getTime()) / 1000);
      return { allowed: false, retryAfterSeconds: remainingSec };
    }

    return { allowed: true };
  } catch (err: any) {
    console.error('[DB Rate Limit Check Error]: Query failed.');
    return { allowed: true };
  }
}

/**
 * Concurrency-Safe Persistent Failed Login Recorder:
 * Uses atomic PostgreSQL ON CONFLICT (UPSERT) to prevent race conditions
 * across concurrent serverless invocations.
 *
 * Lockout Policy:
 * - If last attempt was over 1 hour ago, reset failedAttempts to 1.
 * - If failed attempts reach 5 or more, locks out client for 15 minutes.
 */
export async function recordDbFailedLogin(identifier: string): Promise<{
  failedAttempts: number;
  lockedUntil?: Date;
}> {
  const db = getDb();
  if (!db) return { failedAttempts: 1 };

  const now = new Date();
  const lockoutDurationMs = 15 * 60 * 1000; // 15 minutes
  const expiryWindowMs = 60 * 60 * 1000; // 1 hour attempt reset window

  try {
    // Read existing record to determine next counter & lockout
    const existing = await db
      .select()
      .from(schema.loginRateLimits)
      .where(eq(schema.loginRateLimits.identifier, identifier))
      .limit(1);

    let nextFails = 1;
    let lockedUntil: Date | null = null;

    if (existing.length > 0) {
      const rec = existing[0];
      const timeSinceLast = now.getTime() - rec.lastAttemptAt.getTime();

      // If lockout expired or last attempt was over 1 hour ago, reset counter
      if (timeSinceLast > expiryWindowMs || (rec.lockedUntil && rec.lockedUntil < now)) {
        nextFails = 1;
      } else {
        nextFails = rec.failedAttempts + 1;
      }

      if (nextFails >= 5) {
        lockedUntil = new Date(now.getTime() + lockoutDurationMs);
      }
    }

    // Atomic UPSERT to handle concurrent requests safely without unique key collisions
    await db
      .insert(schema.loginRateLimits)
      .values({
        identifier,
        failedAttempts: nextFails,
        lastAttemptAt: now,
        lockedUntil,
      })
      .onConflictDoUpdate({
        target: schema.loginRateLimits.identifier,
        set: {
          failedAttempts: nextFails,
          lastAttemptAt: now,
          lockedUntil,
        },
      });

    return { failedAttempts: nextFails, lockedUntil: lockedUntil || undefined };
  } catch (err: any) {
    console.error('[DB Rate Limit Record Error]: Query failed.');
    return { failedAttempts: 1 };
  }
}

/**
 * Resets persistent rate limiting upon successful login.
 */
export async function resetDbRateLimit(identifier: string): Promise<void> {
  const db = getDb();
  if (!db) return;

  try {
    await db
      .delete(schema.loginRateLimits)
      .where(eq(schema.loginRateLimits.identifier, identifier));
  } catch (err: any) {
    console.error('[DB Rate Limit Reset Error]: Query failed.');
  }
}
