import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { eq, and, gt, isNull } from 'drizzle-orm';
import * as schema from './schema';

export type DbClient = ReturnType<typeof drizzle<typeof schema>>;

/**
 * Returns whether DATABASE_URL is configured in the environment.
 */
export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL.trim().length > 0);
}

/**
 * Obtains the Drizzle database client using Neon's serverless HTTP driver.
 * Returns null if DATABASE_URL is not configured.
 */
export function getDb(): DbClient | null {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl || databaseUrl.trim().length === 0) {
    return null;
  }
  const sql = neon(databaseUrl);
  return drizzle(sql, { schema });
}

/**
 * Registers an active session in the database upon successful authentication.
 */
export async function registerDbSession(session: {
  id: string; // jti
  userId: string;
  expiresAt: Date;
  userAgent?: string;
  ipAddress?: string;
}): Promise<void> {
  const db = getDb();
  if (!db) return; // Database optional in offline test mode

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
 * Returns false if revoked or expired.
 * If database is not configured (e.g. pre-deployment local test), returns true to allow cryptographic fallback.
 */
export async function isDbSessionValid(sessionId: string): Promise<boolean> {
  const db = getDb();
  if (!db) return true;

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
    console.error('[DB Session Check Error]:', err.message);
    // Fail safely: if DB query errors out, reject session
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
    console.error('[DB Session Revocation Error]:', err.message);
  }
}

/**
 * Persistent Rate Limiting Check:
 * Checks whether an IP identifier is currently locked out in the database.
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
    console.error('[DB Rate Limit Check Error]:', err.message);
    return { allowed: true };
  }
}

/**
 * Records a failed login attempt in the database with persistent backoff lockout.
 * Lockout policy:
 * - 1-4 fails: records attempt
 * - 5+ fails: locks out for 15 minutes
 */
export async function recordDbFailedLogin(identifier: string): Promise<{
  failedAttempts: number;
  lockedUntil?: Date;
}> {
  const db = getDb();
  if (!db) return { failedAttempts: 1 };

  try {
    const records = await db
      .select()
      .from(schema.loginRateLimits)
      .where(eq(schema.loginRateLimits.identifier, identifier))
      .limit(1);

    const now = new Date();

    if (records.length === 0) {
      await db.insert(schema.loginRateLimits).values({
        identifier,
        failedAttempts: 1,
        lastAttemptAt: now,
      });
      return { failedAttempts: 1 };
    }

    const currentFails = records[0].failedAttempts + 1;
    let lockedUntil: Date | null = null;

    if (currentFails >= 5) {
      // 15-minute lockout
      lockedUntil = new Date(now.getTime() + 15 * 60 * 1000);
    }

    await db
      .update(schema.loginRateLimits)
      .set({
        failedAttempts: currentFails,
        lastAttemptAt: now,
        lockedUntil,
      })
      .where(eq(schema.loginRateLimits.identifier, identifier));

    return { failedAttempts: currentFails, lockedUntil: lockedUntil || undefined };
  } catch (err: any) {
    console.error('[DB Record Failed Login Error]:', err.message);
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
    console.error('[DB Reset Rate Limit Error]:', err.message);
  }
}
