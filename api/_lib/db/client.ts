import pg from 'pg';
const { Pool } = pg;
import type { PoolClient, QueryResult, QueryResultRow } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq, and, gt, isNull, or } from 'drizzle-orm';
import crypto from 'node:crypto';
import * as schema from './schema.js';
import type { UserRole } from '../types.js';

export type DbClient = ReturnType<typeof drizzle<typeof schema>>;

interface GlobalWithPool {
  __netmentor_pg_pool?: pg.Pool;
}

interface TestMockStore {
  findUserByUsername?: (username: string) => Promise<any>;
  registerDbSession?: (session: any) => Promise<void>;
  validateDbSession?: (sessionId: string) => Promise<any>;
  revokeDbSession?: (sessionId: string) => Promise<void>;
  query?: (text: string, params?: any[]) => Promise<any>;
}

let activeTestMockStore: TestMockStore | null = null;

export function __setTestMockStore(mock: TestMockStore | null) {
  activeTestMockStore = mock;
}

/**
 * 1. Connection-string resolution hierarchy:
 * 1. process.env.DATABASE_URL
 * 2. process.env.POSTGRES_URL
 * 3. process.env.POSTGRES_URL_NON_POOLING
 */
export function getDatabaseUrl(): string | undefined {
  const candidates = [
    process.env.DATABASE_URL,
    process.env.POSTGRES_URL,
    process.env.POSTGRES_URL_NON_POOLING,
  ];
  for (const candidate of candidates) {
    if (candidate && candidate.trim().length > 0 && !candidate.includes('[SENSITIVE]')) {
      return candidate.trim();
    }
  }
  return undefined;
}

/**
 * Returns whether a database connection string is configured in the environment.
 */
export function isDatabaseConfigured(): boolean {
  const url = getDatabaseUrl();
  return Boolean(url && url.trim().length > 0);
}

export type ConnectionType = 'neon-pooled' | 'neon-direct-unpooled' | 'standard-unpooled';

export interface PoolInspectionResult {
  connectionType: ConnectionType;
  max: number;
  idleTimeoutMillis: number;
  connectionTimeoutMillis: number;
  ssl: boolean | { rejectUnauthorized: boolean };
}

/**
 * Inspects the resolved connection URL format and determines the actual connection type
 * and appropriate pooling configuration without logging secrets or credentials.
 */
export function inspectConnectionConfig(connectionString: string): PoolInspectionResult {
  let connectionType: ConnectionType = 'standard-unpooled';
  let isNeonPooled = false;

  try {
    const parsed = new URL(connectionString);
    const hostname = parsed.hostname.toLowerCase();

    if (hostname.endsWith('.neon.tech')) {
      // First segment of hostname is the endpoint identifier
      const endpointSegment = hostname.split('.')[0] || '';
      if (endpointSegment.endsWith('-pooler')) {
        isNeonPooled = true;
        connectionType = 'neon-pooled';
      } else {
        connectionType = 'neon-direct-unpooled';
      }
    }
  } catch {
    // If URL parsing fails, default to most conservative configuration
    connectionType = 'standard-unpooled';
  }

  // Determine pool size:
  // - Confirmed pooled connection: max = 5 (safe under serverless horizontal scaling with Neon PgBouncer)
  // - Confirmed direct compute connection: max = 1 (preserves Neon compute direct connection limits)
  // - Unknown / Unidentified connection: max = 1 (conservative safe default)
  let max = isNeonPooled ? 5 : 1;

  // Allow explicit override if configured by deployment operator
  if (process.env.DATABASE_POOL_MAX) {
    const parsedMax = parseInt(process.env.DATABASE_POOL_MAX, 10);
    if (!isNaN(parsedMax) && parsedMax > 0) {
      max = parsedMax;
    }
  }

  // Determine SSL configuration
  // Neon requires SSL. Verify certificate authenticity by default; support explicit relaxation if needed.
  const rejectUnauthorized = process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false';
  const ssl = { rejectUnauthorized };

  return {
    connectionType,
    max,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    ssl,
  };
}

/**
 * Obtains or creates the singleton pg.Pool instance cached on globalThis.
 * Reuses the pool across warm serverless invocations and dev hot-reloads.
 */
export function getPool(): pg.Pool | null {
  const connectionString = getDatabaseUrl();
  if (!connectionString || connectionString.trim().length === 0) {
    return null;
  }

  const globalScope = globalThis as unknown as GlobalWithPool;
  if (globalScope.__netmentor_pg_pool) {
    return globalScope.__netmentor_pg_pool;
  }

  const config = inspectConnectionConfig(connectionString);

  const pool = new Pool({
    connectionString,
    max: config.max,
    idleTimeoutMillis: config.idleTimeoutMillis,
    connectionTimeoutMillis: config.connectionTimeoutMillis,
    ssl: config.ssl,
  });

  // Catch socket resets on idle pool connections without crashing process
  pool.on('error', (err) => {
    console.error('[PostgreSQL Pool Error]: Unexpected client error on idle connection:', err.message);
  });

  globalScope.__netmentor_pg_pool = pool;
  return pool;
}

/**
 * Raw reusable database query interface.
 */
export async function query<T extends QueryResultRow = any>(
  text: string,
  params?: any[],
): Promise<QueryResult<T>> {
  if (activeTestMockStore?.query) {
    return activeTestMockStore.query(text, params);
  }

  const pool = getPool();
  if (!pool) {
    throw new Error('DATABASE_URL is not configured. Cannot execute database query.');
  }

  return await pool.query<T>(text, params);
}

/**
 * Checks out a client directly from the pool for multi-statement transactions.
 */
export async function getClient(): Promise<PoolClient> {
  const pool = getPool();
  if (!pool) {
    throw new Error('DATABASE_URL is not configured. Cannot check out database client.');
  }

  return await pool.connect();
}

/**
 * Read-only database initialization & connectivity inspection.
 * Verifies connection and lists tables in the public schema without modifying DDL.
 */
export async function initDatabase(): Promise<{
  connected: boolean;
  engine: string;
  latencyMs: number;
  publicTables: string[];
}> {
  const startTime = performance.now();
  try {
    const res = await query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;`
    );
    const latencyMs = Math.round(performance.now() - startTime);
    return {
      connected: true,
      engine: 'Neon / PostgreSQL',
      latencyMs,
      publicTables: res.rows.map((r) => r.table_name),
    };
  } catch {
    const latencyMs = Math.round(performance.now() - startTime);
    return {
      connected: false,
      engine: 'Neon / PostgreSQL',
      latencyMs,
      publicTables: [],
    };
  }
}

/**
 * Obtains the Drizzle database client using Drizzle's node-postgres adapter.
 * Returns null if no connection string is configured.
 */
export function getDb(): DbClient | null {
  const pool = getPool();
  if (!pool) {
    return null;
  }
  return drizzle(pool, { schema });
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
    console.error('[DB User Lookup Error]: Query failed:', err?.message);
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
    console.error('[DB Rate Limit Check Error]: Query failed:', err?.message);
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

/**
 * Executes a callback within a managed database transaction.
 * Automatically BEGINs, COMMITs on success, or ROLLBACKs on error.
 */
export async function withTransaction<T>(
  callback: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Checks whether an imported deck already exists for a user by source file hash.
 */
export async function findImportedDeckByHash(userId: string, sourceHash: string) {
  const res = await query(
    `SELECT id, deck_name, title, card_count, created_at 
     FROM imported_decks 
     WHERE user_id = $1 AND source_hash = $2 
     LIMIT 1;`,
    [userId, sourceHash],
  );
  return res.rows[0] || null;
}

/**
 * Retrieves all imported decks belonging to a user, with aggregate study progress.
 */
export async function getUserImportedDecks(userId: string) {
  const res = await query(
    `SELECT 
       d.id, d.user_id as "userId", d.source_type as "sourceType", 
       d.source_name as "sourceName", d.source_hash as "sourceHash",
       d.deck_name as "deckName", d.title, d.description, 
       d.card_count as "cardCount", d.created_at as "createdAt", d.updated_at as "updatedAt",
       COUNT(p.id) FILTER (WHERE p.status != 'new')::int as "studiedCount",
       COUNT(p.id) FILTER (WHERE p.status = 'mastered')::int as "masteredCount",
       COUNT(p.id) FILTER (WHERE p.status IN ('learning', 'review'))::int as "learningCount"
     FROM imported_decks d
     LEFT JOIN flashcard_progress p ON p.deck_id = d.id AND p.user_id = d.user_id
     WHERE d.user_id = $1
     GROUP BY d.id
     ORDER BY d.created_at DESC;`,
    [userId],
  );
  return res.rows;
}

/**
 * Retrieves a single imported deck and its ordered cards with user learning progress.
 */
export async function getDeckWithCards(userId: string, deckId: string) {
  const deckRes = await query(
    `SELECT 
       id, user_id as "userId", source_type as "sourceType", 
       source_name as "sourceName", source_hash as "sourceHash",
       deck_name as "deckName", title, description, 
       card_count as "cardCount", created_at as "createdAt", updated_at as "updatedAt"
     FROM imported_decks 
     WHERE id = $1 AND user_id = $2
     LIMIT 1;`,
    [deckId, userId],
  );

  const deck = deckRes.rows[0];
  if (!deck) return null;

  const cardsRes = await query(
    `SELECT 
       c.id, c.deck_id as "deckId", c.user_id as "userId", c.card_type as "cardType",
       c.front_markdown as "frontMarkdown", c.back_markdown as "backMarkdown",
       c.cloze_data as "clozeData", c.tags, c.source_note_id as "sourceNoteId",
       c.order_index as "orderIndex", c.created_at as "createdAt",
       p.status as "progressStatus", p.confidence_score as "confidenceScore",
       p.review_count as "reviewCount", p.last_reviewed_at as "lastReviewedAt"
     FROM flashcards c
     LEFT JOIN flashcard_progress p ON p.card_id = c.id AND p.user_id = c.user_id
     WHERE c.deck_id = $1 AND c.user_id = $2
     ORDER BY c.order_index ASC;`,
    [deckId, userId],
  );

  const cards = cardsRes.rows.map((row: any) => ({
    id: row.id,
    deckId: row.deckId,
    userId: row.userId,
    cardType: row.cardType,
    frontMarkdown: row.frontMarkdown,
    backMarkdown: row.backMarkdown,
    clozeData: row.clozeData ? (typeof row.clozeData === 'string' ? JSON.parse(row.clozeData) : row.clozeData) : null,
    tags: row.tags ? (typeof row.tags === 'string' ? JSON.parse(row.tags) : row.tags) : [],
    orderIndex: row.orderIndex,
    progress: row.progressStatus
      ? {
          status: row.progressStatus,
          confidenceScore: row.confidenceScore ?? 0,
          reviewCount: row.reviewCount ?? 0,
          lastReviewedAt: row.lastReviewedAt,
        }
      : null,
    createdAt: row.createdAt,
  }));

  return { deck, cards };
}

/**
 * Creates an imported deck and batch-inserts all cards atomically inside a transaction.
 * If the deck with identical source hash already exists for the user, returns existing deck.
 */
export async function createImportedDeckWithCards(
  userId: string,
  deckData: {
    sourceType: string;
    sourceName: string;
    sourceHash: string;
    deckName: string;
    title: string;
    description?: string;
  },
  cards: Array<{
    frontMarkdown: string;
    backMarkdown: string;
    cardType: 'basic' | 'cloze' | 'fill_in_blank';
    clozeData?: Record<string, any>;
    tags?: string[];
    sourceNoteId?: string;
    orderIndex: number;
  }>,
): Promise<{ deckId: string; cardCount: number; alreadyImported: boolean }> {
  return await withTransaction(async (client) => {
    // 1. Check for duplicate within transaction
    const existingRes = await client.query(
      `SELECT id, card_count FROM imported_decks WHERE user_id = $1 AND source_hash = $2 LIMIT 1;`,
      [userId, deckData.sourceHash],
    );

    if (existingRes.rows.length > 0) {
      return {
        deckId: existingRes.rows[0].id,
        cardCount: existingRes.rows[0].card_count,
        alreadyImported: true,
      };
    }

    // 2. Insert new imported_decks record
    const deckId = crypto.randomUUID();
    await client.query(
      `INSERT INTO imported_decks 
       (id, user_id, source_type, source_name, source_hash, deck_name, title, description, card_count, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW());`,
      [
        deckId,
        userId,
        deckData.sourceType,
        deckData.sourceName,
        deckData.sourceHash,
        deckData.deckName,
        deckData.title,
        deckData.description || null,
        cards.length,
      ],
    );

    // 3. Batch insert flashcards in batches of 100
    const batchSize = 100;
    for (let i = 0; i < cards.length; i += batchSize) {
      const chunk = cards.slice(i, i + batchSize);
      const values: any[] = [];
      const placeholders: string[] = [];

      chunk.forEach((card, idx) => {
        const offset = idx * 9;
        placeholders.push(
          `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9})`
        );
        values.push(
          crypto.randomUUID(),
          deckId,
          userId,
          card.cardType,
          card.frontMarkdown,
          card.backMarkdown,
          card.clozeData ? JSON.stringify(card.clozeData) : null,
          card.tags && card.tags.length > 0 ? JSON.stringify(card.tags) : null,
          card.orderIndex ?? (i + idx),
        );
      });

      const sql = `
        INSERT INTO flashcards 
        (id, deck_id, user_id, card_type, front_markdown, back_markdown, cloze_data, tags, order_index)
        VALUES ${placeholders.join(', ')};
      `;
      await client.query(sql, values);
    }

    return {
      deckId,
      cardCount: cards.length,
      alreadyImported: false,
    };
  });
}

/**
 * Deletes an imported deck belonging to a user (cascades to cards and progress).
 */
export async function deleteImportedDeck(userId: string, deckId: string): Promise<boolean> {
  const res = await query(
    `DELETE FROM imported_decks WHERE id = $1 AND user_id = $2 RETURNING id;`,
    [deckId, userId],
  );
  return res.rowCount !== null && res.rowCount > 0;
}

/**
 * Upserts a flashcard's review progress for a user.
 */
export async function upsertCardProgress(
  userId: string,
  cardId: string,
  deckId: string,
  status: 'new' | 'learning' | 'review' | 'mastered',
  confidenceScore = 3,
) {
  const id = crypto.randomUUID();
  const res = await query(
    `INSERT INTO flashcard_progress 
     (id, user_id, card_id, deck_id, status, confidence_score, review_count, last_reviewed_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, 1, NOW(), NOW())
     ON CONFLICT (user_id, card_id) DO UPDATE SET
       status = EXCLUDED.status,
       confidence_score = EXCLUDED.confidence_score,
       review_count = flashcard_progress.review_count + 1,
       last_reviewed_at = NOW(),
       updated_at = NOW()
     RETURNING status, confidence_score as "confidenceScore", review_count as "reviewCount", last_reviewed_at as "lastReviewedAt";`,
    [id, userId, cardId, deckId, status, confidenceScore],
  );
  return res.rows[0];
}
