import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { eq, and, gt, isNull } from 'drizzle-orm';
import * as schema from './schema';

export type DbClient = ReturnType<typeof drizzle<typeof schema>>;

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

/**
 * Validates whether a session ID exists and is neither revoked nor expired.
 *
 * PRODUCTION FAIL-CLOSED POLICY:
 * In any deployed or production environment (NODE_ENV=production or running under Vercel),
 * if the database is unconfigured or unreachable, this function returns FALSE.
 * It will NEVER fall back to bypassing database-backed session validation in production.
 */
export async function isDbSessionValid(sessionId: string): Promise<boolean> {
  const db = getDb();
  if (!db) {
    // Strict production fail-closed guard
    if (process.env.NODE_ENV === 'production' || process.env.VERCEL) {
      console.error('[Security Alert]: Database unconfigured in production. Failing closed.');
      return false;
    }
    // Local development only fallback before Neon is connected
    return true;
  }

  try {
    const records = await db
      .select({ id: schema.userSessions.id })
      .from(schema.userSessions)
      .where(
        and(
          eq(schema.userSessions.id, sessionId),
          isNull(schema.userSessions.revokedAt),
          gt(schema.userSessions.expiresAt, new Date()),
        ),
      )
      .limit(1);

    return records.length > 0;
  } catch (err: any) {
    // Fail safely without exposing database connection details
    console.error('[DB Session Validation Error]: Query failed.');
    return false;
  }
}

/**
 * Immediately revokes an active session by marking revokedAt = NOW().
 */
export async function revokeDbSession(sessionId: string): Promise<void> {
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
