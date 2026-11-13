import pg from 'pg';
const { Pool } = pg;
import type { PoolClient, QueryResult, QueryResultRow } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq, and, gt, isNull, or } from 'drizzle-orm';
import crypto from 'node:crypto';
import * as schema from './schema.js';
import type { UserRole } from '../types.js';
import type { ProtocolSimulationScenario, SavedSimulationRecord } from '../../../src/types/protocol-simulation.js';


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
  getUserLessonProgress?: (userId: string) => Promise<any[]>;
  upsertLessonProgress?: (
    userId: string,
    lessonId: string,
    masteryLevel: string,
    confidenceScore: number,
    notes?: string,
  ) => Promise<any>;
  createAiConversation?: (userId: string, options?: any) => Promise<any>;
  getUserAiConversations?: (userId: string) => Promise<any[]>;
  getAiConversationWithMessages?: (userId: string, conversationId: string) => Promise<any>;
  updateAiConversationTitle?: (userId: string, conversationId: string, title: string) => Promise<boolean>;
  deleteAiConversation?: (userId: string, conversationId: string) => Promise<boolean>;
  addAiMessage?: (userId: string, conversationId: string, message: any) => Promise<any>;
  createUserGeneratedLesson?: (userId: string, lesson: any) => Promise<any>;
  getUserGeneratedLessons?: (userId: string, filter?: { search?: string; difficulty?: string }) => Promise<any[]>;
  getUserGeneratedLessonById?: (userId: string, lessonId: string) => Promise<any>;
  updateUserGeneratedLessonTitle?: (userId: string, lessonId: string, title: string) => Promise<boolean>;
  deleteUserGeneratedLesson?: (userId: string, lessonId: string) => Promise<boolean>;
  getLessonFlashcardDeck?: (userId: string, lessonId: string) => Promise<any>;
  saveOrUpdateLessonFlashcardDeck?: (userId: string, lessonId: string, deckData: any, cards: any[]) => Promise<any>;
  saveOrUpdateStandaloneFlashcardDeck?: (userId: string, deckId: string | null | undefined, deckData: any, cards: any[]) => Promise<any>;
  getDeckWithCards?: (userId: string, deckId: string) => Promise<any>;
  deleteImportedDeck?: (userId: string, deckId: string) => Promise<boolean>;
  createUserQuiz?: (userId: string, quiz: any) => Promise<any>;
  getUserQuizzes?: (userId: string, filter?: { search?: string; difficulty?: string; lessonId?: string }) => Promise<any[]>;
  getUserQuizById?: (userId: string, quizId: string) => Promise<any>;
  updateQuizQuestion?: (userId: string, quizId: string, questionId: string, updates: any) => Promise<boolean>;
  deleteUserQuiz?: (userId: string, quizId: string) => Promise<boolean>;
  recordQuizAttempt?: (userId: string, quizId: string, attempt: any) => Promise<any>;
  getQuizAttempts?: (userId: string, quizId: string) => Promise<any[]>;
  getQuizAttemptById?: (userId: string, attemptId: string) => Promise<any>;
  getLessonQuiz?: (userId: string, lessonId: string) => Promise<any>;
  createGenerationTask?: (userId: string, task: any) => Promise<any>;
  startGenerationTaskProcessing?: (taskId: string, stage?: string, executionBudgetSeconds?: number) => Promise<boolean>;
  getGenerationTaskById?: (userId: string, taskId: string) => Promise<any>;
  getUserActiveGenerationTasks?: (userId: string) => Promise<any[]>;
  updateGenerationTaskStage?: (taskId: string, stage: string) => Promise<boolean>;
  completeGenerationTask?: (taskId: string, resultData: any, persistedEntityId?: string) => Promise<boolean>;
  failGenerationTask?: (taskId: string, error: { message: string; category?: string; isRetryable?: boolean }) => Promise<boolean>;
  cancelGenerationTask?: (userId: string, taskId: string) => Promise<boolean>;
  cleanupStaleGenerationTasks?: (olderThanSeconds?: number) => Promise<number>;
  saveCustomSimulation?: (userId: string, scenario: any) => Promise<any>;
  listSavedSimulations?: (userId: string) => Promise<any[]>;
  getSavedSimulationById?: (userId: string, scenarioOrDbId: string) => Promise<any>;
  deleteSavedSimulation?: (userId: string, scenarioOrDbId: string) => Promise<boolean>;
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
    connectionTimeoutMillis: 30000,
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
  if (activeTestMockStore?.getDeckWithCards) {
    return activeTestMockStore.getDeckWithCards(userId, deckId);
  }

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
  if (activeTestMockStore?.deleteImportedDeck) {
    return activeTestMockStore.deleteImportedDeck(userId, deckId);
  }

  const res = await query(
    `DELETE FROM imported_decks WHERE id = $1 AND user_id = $2 RETURNING id;`,
    [deckId, userId],
  );
  return res.rowCount !== null && res.rowCount > 0;
}

/**
 * Retrieves the AI-generated flashcard deck associated with a specific user-generated lesson.
 * (Milestone 3)
 */
export async function getLessonFlashcardDeck(
  userId: string,
  lessonId: string,
): Promise<{ deck: any; cards: any[] } | null> {
  if (activeTestMockStore?.getLessonFlashcardDeck) {
    return activeTestMockStore.getLessonFlashcardDeck(userId, lessonId);
  }

  const sourceName = `lesson:${lessonId}`;
  const res = await query(
    `SELECT id FROM imported_decks WHERE user_id = $1 AND source_type = 'ai_generated' AND source_name = $2 LIMIT 1;`,
    [userId, sourceName],
  );

  if (res.rows.length === 0) return null;
  return getDeckWithCards(userId, res.rows[0].id);
}

/**
 * Saves or updates an AI-generated flashcard deck for a custom lesson.
 * Preserves existing card IDs and review progress when updating an existing deck.
 * (Milestone 3)
 */
export async function saveOrUpdateLessonFlashcardDeck(
  userId: string,
  lessonId: string,
  deckData: {
    title: string;
    description?: string;
    deckName?: string;
  },
  cards: Array<{
    id?: string;
    frontMarkdown: string;
    backMarkdown: string;
    cardType?: 'basic' | 'cloze' | 'fill_in_blank';
    tags?: string[];
    orderIndex?: number;
  }>,
): Promise<{ deckId: string; cardCount: number; isUpdated: boolean }> {
  if (activeTestMockStore?.saveOrUpdateLessonFlashcardDeck) {
    return activeTestMockStore.saveOrUpdateLessonFlashcardDeck(userId, lessonId, deckData, cards);
  }

  const sourceName = `lesson:${lessonId}`;
  const sourceHash = crypto
    .createHash('sha256')
    .update(`${userId}:lesson:${lessonId}`)
    .digest('hex');

  return await withTransaction(async (client) => {
    // 1. Check if deck already exists for this lesson
    const existingRes = await client.query(
      `SELECT id, card_count FROM imported_decks WHERE user_id = $1 AND source_type = 'ai_generated' AND source_name = $2 LIMIT 1;`,
      [userId, sourceName],
    );

    let deckId: string;
    let isUpdated = false;

    if (existingRes.rows.length > 0) {
      deckId = existingRes.rows[0].id;
      isUpdated = true;

      // Update deck metadata
      await client.query(
        `UPDATE imported_decks 
         SET title = $1, description = $2, card_count = $3, updated_at = NOW()
         WHERE id = $4 AND user_id = $5;`,
        [deckData.title, deckData.description || null, cards.length, deckId, userId],
      );

      // Query existing cards in the deck
      const existingCardsRes = await client.query(
        `SELECT id FROM flashcards WHERE deck_id = $1 AND user_id = $2;`,
        [deckId, userId],
      );
      const existingCardIds = new Set(existingCardsRes.rows.map((r: any) => r.id));
      const keptCardIds = new Set<string>();

      // Update existing cards or insert new ones
      for (let i = 0; i < cards.length; i++) {
        const c = cards[i];
        const cardOrder = c.orderIndex ?? i;
        const tagsJson = c.tags && c.tags.length > 0 ? JSON.stringify(c.tags) : null;

        if (c.id && existingCardIds.has(c.id)) {
          // Update in place preserving ID and all review progress
          keptCardIds.add(c.id);
          await client.query(
            `UPDATE flashcards 
             SET front_markdown = $1, back_markdown = $2, tags = $3, order_index = $4
             WHERE id = $5 AND deck_id = $6 AND user_id = $7;`,
            [c.frontMarkdown, c.backMarkdown, tagsJson, cardOrder, c.id, deckId, userId],
          );
        } else {
          // New card
          const newCardId = crypto.randomUUID();
          keptCardIds.add(newCardId);
          await client.query(
            `INSERT INTO flashcards 
             (id, deck_id, user_id, card_type, front_markdown, back_markdown, tags, order_index, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW());`,
            [
              newCardId,
              deckId,
              userId,
              c.cardType || 'basic',
              c.frontMarkdown,
              c.backMarkdown,
              tagsJson,
              cardOrder,
            ],
          );
        }
      }

      // Delete cards that were removed from the draft (cascades to their progress)
      for (const oldId of existingCardIds) {
        if (!keptCardIds.has(oldId)) {
          await client.query(
            `DELETE FROM flashcards WHERE id = $1 AND deck_id = $2 AND user_id = $3;`,
            [oldId, deckId, userId],
          );
        }
      }
    } else {
      // Completely new deck
      deckId = crypto.randomUUID();
      await client.query(
        `INSERT INTO imported_decks 
         (id, user_id, source_type, source_name, source_hash, deck_name, title, description, card_count, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW());`,
        [
          deckId,
          userId,
          'ai_generated',
          sourceName,
          sourceHash,
          deckData.deckName || 'ai-lesson-flashcards',
          deckData.title,
          deckData.description || null,
          cards.length,
        ],
      );

      // Batch insert new cards
      for (let i = 0; i < cards.length; i++) {
        const c = cards[i];
        const cardId = c.id || crypto.randomUUID();
        const cardOrder = c.orderIndex ?? i;
        const tagsJson = c.tags && c.tags.length > 0 ? JSON.stringify(c.tags) : null;

        await client.query(
          `INSERT INTO flashcards 
           (id, deck_id, user_id, card_type, front_markdown, back_markdown, tags, order_index, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW());`,
          [
            cardId,
            deckId,
            userId,
            c.cardType || 'basic',
            c.frontMarkdown,
            c.backMarkdown,
            tagsJson,
            cardOrder,
          ],
        );
      }
    }

    return {
      deckId,
      cardCount: cards.length,
      isUpdated,
    };
  });
}

/**
 * Saves or updates an AI-generated standalone flashcard deck for a user.
 * Preserves existing card IDs and review progress when updating an existing deck.
 */
export async function saveOrUpdateStandaloneFlashcardDeck(
  userId: string,
  deckId: string | null | undefined,
  deckData: {
    title: string;
    description?: string;
    topic?: string;
    deckName?: string;
  },
  cards: Array<{
    id?: string;
    frontMarkdown: string;
    backMarkdown: string;
    cardType?: 'basic' | 'cloze' | 'fill_in_blank';
    tags?: string[];
    orderIndex?: number;
  }>,
): Promise<{ deckId: string; cardCount: number; isUpdated: boolean }> {
  if (activeTestMockStore?.saveOrUpdateStandaloneFlashcardDeck) {
    return activeTestMockStore.saveOrUpdateStandaloneFlashcardDeck(userId, deckId, deckData, cards);
  }

  return await withTransaction(async (client) => {
    let resolvedDeckId: string = deckId ? deckId.trim() : '';

    if (resolvedDeckId) {
      // 1. Check if deck exists and belongs to user
      const existingRes = await client.query(
        `SELECT id, card_count FROM imported_decks WHERE id = $1 AND user_id = $2 LIMIT 1;`,
        [resolvedDeckId, userId],
      );

      if (existingRes.rows.length > 0) {

        // Update deck metadata
        await client.query(
          `UPDATE imported_decks 
           SET title = $1, description = $2, card_count = $3, updated_at = NOW()
           WHERE id = $4 AND user_id = $5;`,
          [deckData.title, deckData.description || null, cards.length, resolvedDeckId, userId],
        );

        // Query existing cards in the deck
        const existingCardsRes = await client.query(
          `SELECT id FROM flashcards WHERE deck_id = $1 AND user_id = $2;`,
          [resolvedDeckId, userId],
        );
        const existingCardIds = new Set(existingCardsRes.rows.map((r: any) => r.id));
        const keptCardIds = new Set<string>();

        // Update existing cards or insert new ones
        for (let i = 0; i < cards.length; i++) {
          const c = cards[i];
          const cardOrder = c.orderIndex ?? i;
          const tagsJson = c.tags && c.tags.length > 0 ? JSON.stringify(c.tags) : null;

          if (c.id && existingCardIds.has(c.id)) {
            // Update in place preserving ID and all review progress
            keptCardIds.add(c.id);
            await client.query(
              `UPDATE flashcards 
               SET front_markdown = $1, back_markdown = $2, tags = $3, order_index = $4
               WHERE id = $5 AND deck_id = $6 AND user_id = $7;`,
              [c.frontMarkdown, c.backMarkdown, tagsJson, cardOrder, c.id, resolvedDeckId, userId],
            );
          } else {
            // New card
            const newCardId = crypto.randomUUID();
            keptCardIds.add(newCardId);
            await client.query(
              `INSERT INTO flashcards 
               (id, deck_id, user_id, card_type, front_markdown, back_markdown, tags, order_index, created_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW());`,
              [
                newCardId,
                resolvedDeckId,
                userId,
                c.cardType || 'basic',
                c.frontMarkdown,
                c.backMarkdown,
                tagsJson,
                cardOrder,
              ],
            );
          }
        }

        // Delete cards that were removed from the draft
        for (const oldId of existingCardIds) {
          if (!keptCardIds.has(oldId)) {
            await client.query(
              `DELETE FROM flashcards WHERE id = $1 AND deck_id = $2 AND user_id = $3;`,
              [oldId, resolvedDeckId, userId],
            );
          }
        }

        return { deckId: resolvedDeckId, cardCount: cards.length, isUpdated: true };
      }
    }

    // Completely new deck
    resolvedDeckId = crypto.randomUUID();
    const sourceName = `standalone:${deckData.topic || 'deck'}:${resolvedDeckId}`;
    const sourceHash = crypto
      .createHash('sha256')
      .update(`${userId}:standalone:${resolvedDeckId}`)
      .digest('hex');

    await client.query(
      `INSERT INTO imported_decks 
       (id, user_id, source_type, source_name, source_hash, deck_name, title, description, card_count, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW());`,
      [
        resolvedDeckId,
        userId,
        'ai_standalone',
        sourceName,
        sourceHash,
        deckData.deckName || deckData.topic || 'ai-standalone-flashcards',
        deckData.title,
        deckData.description || null,
        cards.length,
      ],
    );

    // Batch insert new cards
    for (let i = 0; i < cards.length; i++) {
      const c = cards[i];
      const cardId = c.id || crypto.randomUUID();
      const tagsJson = c.tags && c.tags.length > 0 ? JSON.stringify(c.tags) : null;
      await client.query(
        `INSERT INTO flashcards 
         (id, deck_id, user_id, card_type, front_markdown, back_markdown, tags, order_index, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW());`,
        [
          cardId,
          resolvedDeckId,
          userId,
          c.cardType || 'basic',
          c.frontMarkdown,
          c.backMarkdown,
          tagsJson,
          c.orderIndex ?? i,
        ],
      );
    }

    return {
      deckId: resolvedDeckId,
      cardCount: cards.length,
      isUpdated: false,
    };
  });
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

/**
 * Ensures baseline curriculum records exist in Neon PostgreSQL (learning_paths, topics, lessons)
 * so that foreign key constraints on user_progress are satisfied. Idempotent.
 */
export async function ensureCurriculumSeed(): Promise<void> {
  const seedPaths = [
    {
      id: 'path-fundamentals',
      slug: 'network-fundamentals',
      title: 'Network Fundamentals & Architecture',
      description: 'Master first-principles packet delivery, OSI and TCP/IP protocol stacks, IPv4 binary math, and Ethernet switching.',
      targetCert: 'Fundamentals',
      orderIndex: 1,
    },
    {
      id: 'path-ccna',
      slug: 'ccna-200-301',
      title: 'Cisco CCNA (200-301)',
      description: 'Comprehensive associate-level routing, switching, security, and IP services engineering.',
      targetCert: 'CCNA',
      orderIndex: 2,
    },
    {
      id: 'path-ccnp',
      slug: 'ccnp-encor-350-401',
      title: 'Cisco CCNP Enterprise (ENCOR)',
      description: 'Advanced enterprise architecture, scalable BGP routing, MPLS L3VPNs, VRF segmentation, and SD-WAN.',
      targetCert: 'CCNP Enterprise',
      orderIndex: 3,
    },
  ];

  const seedTopics = [
    {
      id: 'topic-packet-walk',
      pathId: 'path-fundamentals',
      slug: 'packet-delivery-encapsulation',
      title: 'Packet Delivery & Encapsulation',
      description: 'Understand how data traverses networks from client to server, stripping and rewriting headers at each hop.',
      orderIndex: 1,
      estimatedMinutes: 20,
    },
    {
      id: 'topic-subnetting',
      pathId: 'path-fundamentals',
      slug: 'ipv4-addressing-and-subnetting',
      title: 'IPv4 Addressing & Subnetting Mechanics',
      description: 'Master binary prefixing, block sizing, and the Magic Number method for rapid mental subnetting.',
      orderIndex: 2,
      estimatedMinutes: 25,
    },
    {
      id: 'topic-ospf',
      pathId: 'path-ccna',
      slug: 'ospf-routing-protocol',
      title: 'OSPFv2 Routing Protocol',
      description: 'Open Shortest Path First link-state routing, LSAs, metric calculation, and neighbor formation.',
      orderIndex: 1,
      estimatedMinutes: 30,
    },
    {
      id: 'topic-bgp',
      pathId: 'path-ccnp',
      slug: 'bgp-path-selection',
      title: 'Border Gateway Protocol (BGP) & Path Selection',
      description: 'Autonomous Systems, eBGP/iBGP peering, and the deterministic 13-step best path algorithm.',
      orderIndex: 1,
      estimatedMinutes: 90,
    },
    {
      id: 'topic-sdwan',
      pathId: 'path-ccnp',
      slug: 'cisco-sd-wan-architecture',
      title: 'Cisco SD-WAN Architecture & Planes',
      description: 'Orchestration (vBond), Management (vManage), Control (vSmart via OMP), and Data (vEdge IPsec).',
      orderIndex: 2,
      estimatedMinutes: 90,
    },
    {
      id: 'topic-mpls-vpn',
      pathId: 'path-ccnp',
      slug: 'mpls-l3vpn-vrf',
      title: 'MPLS Layer 3 VPNs & VRF Architecture',
      description: 'Provider edge routing, VRFs, Route Distinguishers, Route Targets, MP-BGP VPNv4, and inter-VRF route leaking.',
      orderIndex: 3,
      estimatedMinutes: 45,
    },
    {
      id: 'topic-qos',
      pathId: 'path-ccnp',
      slug: 'qos-traffic-conditioning',
      title: 'Quality of Service (QoS) & Traffic Conditioning',
      description: 'Classification, marking, policing, shaping, queuing (LLQ/CBWFQ), and congestion avoidance (WRED).',
      orderIndex: 4,
      estimatedMinutes: 45,
    },
  ];

  const seedLessons = [
    {
      id: 'lesson-packet-walk',
      topicId: 'topic-packet-walk',
      slug: 'anatomy-of-a-packet-walk',
      title: 'The Anatomy of a Packet Walk',
      summary: 'Host-to-Host Delivery Across Routers: What Changes and What Stays the Same.',
      contentMarkdown: 'Master the separation of Layer 2 hop-by-hop framing vs Layer 3 end-to-end IP delivery.',
      orderIndex: 1,
    },
    {
      id: 'lesson-subnetting-magic-number',
      topicId: 'topic-subnetting',
      slug: 'subnetting-from-scratch-magic-number',
      title: 'Subnetting from Scratch: Magic Number & Binary Intuition',
      summary: 'Calculate Network IDs, Usable Ranges, and Broadcasts Mentally in Seconds.',
      contentMarkdown: 'Understand the subnet mask knife, powers of 2, and the 256-minus-mask Magic Number rule.',
      orderIndex: 2,
    },
    {
      id: 'lesson-ospf-neighbor-states',
      topicId: 'topic-ospf',
      slug: 'ospf-neighbor-adjacencies',
      title: 'OSPF Neighbor Adjacencies: The 7-State Formation Machine',
      summary: 'From First Hello to Full LSDB Synchronization — and Where Engineers Get Stuck.',
      contentMarkdown: 'Understand the Down, Init, 2-Way, ExStart, Exchange, Loading, Full states and MTU mismatch troubleshooting.',
      orderIndex: 3,
    },
    {
      id: 'lesson-bgp-path-selection',
      topicId: 'topic-bgp',
      slug: 'bgp-path-selection-architecture',
      title: 'Border Gateway Protocol (BGP) & Path Selection: Architecture, Peering & Decision Mechanics',
      summary: 'Autonomous Systems, eBGP vs. iBGP Rules, TCP 179 Adjacencies, and the 13-Step Best Path Algorithm.',
      contentMarkdown: 'Understand BGP path-vector mechanics, TCP 179 peering, split-horizon, next-hop-self, and the 13-step best path selection algorithm.',
      orderIndex: 4,
    },
    {
      id: 'lesson-sd-wan-architecture',
      topicId: 'topic-sdwan',
      slug: 'sd-wan-architecture-and-control-planes',
      title: 'Cisco SD-WAN Architecture & Control Planes: Underlay, Overlay & Fabric Orchestration',
      summary: 'Orchestration (vBond), Management (vManage), Control (vSmart via OMP), and Data (WAN Edge IPsec) Mechanics.',
      contentMarkdown: 'Understand SD-WAN underlay vs overlay, the 4 architectural planes, device onboarding, OMP routing, TLOCs, and data plane BFD IPsec forwarding.',
      orderIndex: 5,
    },
    {
      id: 'lesson-bgp-troubleshooting',
      topicId: 'topic-bgp',
      slug: 'bgp-troubleshooting-and-route-advertisement',
      title: 'BGP Troubleshooting & Route Advertisement: Adjacencies, Policy Filtering & RIB Installation',
      summary: 'Diagnosing Stuck Neighbor States, Route Injection Failures, Inaccessible Next-Hops, and Routing Table Discrepancies.',
      contentMarkdown: 'Master systematic BGP troubleshooting across 3 operational phases: TCP 179 adjacency negotiation, route injection and filtering, and best path selection with RIB installation.',
      orderIndex: 6,
    },
    {
      id: 'lesson-sd-wan-routing-policy',
      topicId: 'topic-sdwan',
      slug: 'cisco-sd-wan-routing-policies-and-troubleshooting',
      title: 'Cisco SD-WAN Routing, Policies & Troubleshooting: OMP, Policy Enforcement & Forwarding Diagnostics',
      summary: 'OMP Route Propagation, TLOC Health, BFD Telemetry, Centralized vs. Localized Policies, and Data-Plane Incident Resolution.',
      contentMarkdown: 'Master SD-WAN OMP routing mechanics, TLOC reachability, BFD telemetry, the 4-quadrant policy matrix, Application-Aware Routing, and systematic forwarding troubleshooting.',
      orderIndex: 7,
    },
    {
      id: 'lesson-mpls-l3vpn',
      topicId: 'topic-mpls-vpn',
      slug: 'mpls-l3vpn-vrf-route-leaking',
      title: 'MPLS L3VPN and VRF Route Leaking: RD, RT, MP-BGP and Inter-VRF Connectivity',
      summary: 'Architectural Isolation, VRFs, Route Distinguishers, Route Targets, MP-BGP VPNv4 Exchange, and Controlled Route Leaking.',
      contentMarkdown: 'Master MPLS L3VPN architecture, CE-PE-P router roles, VRF routing tables, 64-bit RDs vs 64-bit extended community RTs, MP-BGP VPNv4 peering, MPLS transport vs VPN label stacks, and inter-VRF route leaking diagnostics.',
      orderIndex: 8,
    },
    {
      id: 'lesson-qos-fundamentals',
      topicId: 'topic-qos',
      slug: 'qos-fundamentals-and-troubleshooting',
      title: 'QoS Fundamentals & Troubleshooting: Classification, Marking, Conditioning & Queueing',
      summary: 'Bandwidth, Delay, Jitter, Packet Loss, CoS/DSCP Mapping, Trust Boundaries, Token-Bucket Conditioning, LLQ/CBWFQ, and WRED Diagnostics.',
      contentMarkdown: 'Master enterprise QoS principles, Layer 2 CoS vs Layer 3 DSCP, trust boundary enforcement, token-bucket policing and shaping, CBWFQ and LLQ priority queueing, WRED congestion avoidance, and MQC troubleshooting.',
      orderIndex: 9,
    },
  ];

  for (const p of seedPaths) {
    await query(
      `INSERT INTO learning_paths (id, slug, title, description, target_cert, order_index)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, description = EXCLUDED.description;`,
      [p.id, p.slug, p.title, p.description, p.targetCert, p.orderIndex],
    );
  }

  for (const t of seedTopics) {
    await query(
      `INSERT INTO topics (id, path_id, slug, title, description, order_index, estimated_minutes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, description = EXCLUDED.description;`,
      [t.id, t.pathId, t.slug, t.title, t.description, t.orderIndex, t.estimatedMinutes],
    );
  }

  for (const l of seedLessons) {
    await query(
      `INSERT INTO lessons (id, topic_id, slug, title, summary, content_markdown, order_index)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, summary = EXCLUDED.summary;`,
      [l.id, l.topicId, l.slug, l.title, l.summary, l.contentMarkdown, l.orderIndex],
    );
  }
}

/**
 * Retrieves all lesson progress records for a user.
 */
export async function getUserLessonProgress(userId: string) {
  if (activeTestMockStore?.getUserLessonProgress) {
    return activeTestMockStore.getUserLessonProgress(userId);
  }

  const res = await query(
    `SELECT 
       lesson_id as "lessonId",
       mastery_level as "masteryLevel",
       confidence_score as "confidenceScore",
       last_reviewed_at as "lastReviewedAt",
       notes
     FROM user_progress
     WHERE user_id = $1
     ORDER BY last_reviewed_at DESC;`,
    [userId],
  );

  return res.rows.map((row: any) => {
    let exerciseAttempts: Record<string, any> | undefined = undefined;
    if (row.notes && typeof row.notes === 'string' && row.notes.startsWith('{')) {
      try {
        const parsed = JSON.parse(row.notes);
        if (parsed && typeof parsed.exercises === 'object') {
          exerciseAttempts = parsed.exercises;
        }
      } catch {}
    }
    return {
      ...row,
      exerciseAttempts,
    };
  });
}

/**
 * Upserts a user's progress for a specific curriculum lesson.
 */
export async function upsertLessonProgress(
  userId: string,
  lessonId: string,
  masteryLevel: string,
  confidenceScore = 3,
  notes?: string,
) {
  if (activeTestMockStore?.upsertLessonProgress) {
    return activeTestMockStore.upsertLessonProgress(userId, lessonId, masteryLevel, confidenceScore, notes);
  }

  await ensureCurriculumSeed();

  const id = crypto.randomUUID();
  const res = await query(
    `INSERT INTO user_progress 
     (id, user_id, lesson_id, mastery_level, confidence_score, last_reviewed_at, notes)
     VALUES ($1, $2, $3, $4, $5, NOW(), $6)
     ON CONFLICT (user_id, lesson_id) DO UPDATE SET
       mastery_level = EXCLUDED.mastery_level,
       confidence_score = EXCLUDED.confidence_score,
       last_reviewed_at = NOW(),
       notes = CASE
         WHEN user_progress.notes IS NOT NULL 
              AND user_progress.notes LIKE '{%' 
              AND EXCLUDED.notes IS NOT NULL 
              AND EXCLUDED.notes LIKE '{%' 
         THEN (
           jsonb_set(
             COALESCE(user_progress.notes::jsonb, '{}'::jsonb),
             '{exercises}',
             COALESCE(user_progress.notes::jsonb->'exercises', '{}'::jsonb) || COALESCE(EXCLUDED.notes::jsonb->'exercises', '{}'::jsonb),
             true
           ) || (EXCLUDED.notes::jsonb - 'exercises')
         )::text
         ELSE COALESCE(EXCLUDED.notes, user_progress.notes)
       END
     RETURNING 
       lesson_id as "lessonId",
       mastery_level as "masteryLevel",
       confidence_score as "confidenceScore",
       last_reviewed_at as "lastReviewedAt",
       notes;`,
    [id, userId, lessonId, masteryLevel, confidenceScore, notes || null],
  );
  return res.rows[0];
}

export interface AiConversationRecord {
  id: string;
  userId: string;
  title: string;
  mode: string;
  lessonId?: string | null;
  sectionId?: string | null;
  exerciseId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AiMessageRecord {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  model?: string | null;
  isSimulated: boolean;
  promptTokens?: number | null;
  completionTokens?: number | null;
  totalTokens?: number | null;
  createdAt: Date;
}

let aiTablesEnsured = false;

/**
 * Ensures AI conversation tables exist in the public schema.
 */
export async function ensureAiTables(): Promise<void> {
  if (aiTablesEnsured) return;
  if (!isDatabaseConfigured()) return;

  try {
    await query(`
      CREATE TABLE IF NOT EXISTS "ai_conversations" (
        "id" varchar(36) PRIMARY KEY NOT NULL,
        "user_id" varchar(36) NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "title" varchar(255) DEFAULT 'New Conversation' NOT NULL,
        "mode" varchar(32) DEFAULT 'general_qa' NOT NULL,
        "lesson_id" varchar(64),
        "section_id" varchar(64),
        "exercise_id" varchar(64),
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL
      );
      CREATE INDEX IF NOT EXISTS "ai_conversations_user_id_idx" ON "ai_conversations" ("user_id");
      CREATE INDEX IF NOT EXISTS "ai_conversations_user_updated_idx" ON "ai_conversations" ("user_id", "updated_at");

      CREATE TABLE IF NOT EXISTS "ai_messages" (
        "id" varchar(36) PRIMARY KEY NOT NULL,
        "conversation_id" varchar(36) NOT NULL REFERENCES "ai_conversations"("id") ON DELETE CASCADE,
        "role" varchar(20) NOT NULL,
        "content" text NOT NULL,
        "model" varchar(64),
        "is_simulated" boolean DEFAULT false NOT NULL,
        "prompt_tokens" integer,
        "completion_tokens" integer,
        "total_tokens" integer,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL
      );
      CREATE INDEX IF NOT EXISTS "ai_messages_conv_id_idx" ON "ai_messages" ("conversation_id");
      CREATE INDEX IF NOT EXISTS "ai_messages_conv_created_idx" ON "ai_messages" ("conversation_id", "created_at");
    `);
    aiTablesEnsured = true;
  } catch (err: any) {
    console.error('[AI DB Init Warning]:', err?.message);
  }
}

/**
 * Creates a new AI conversation owned by the authenticated user.
 */
export async function createAiConversation(
  userId: string,
  options?: {
    id?: string;
    title?: string;
    mode?: string;
    lessonId?: string;
    sectionId?: string;
    exerciseId?: string;
  }
): Promise<AiConversationRecord> {
  if (activeTestMockStore?.createAiConversation) {
    return activeTestMockStore.createAiConversation(userId, options);
  }

  await ensureAiTables();
  const id = options?.id || crypto.randomUUID();
  const title = (options?.title || 'New Conversation').trim();
  const mode = (options?.mode || 'general_qa').trim();

  const res = await query<AiConversationRecord>(
    `INSERT INTO ai_conversations 
     (id, user_id, title, mode, lesson_id, section_id, exercise_id, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
     RETURNING 
       id,
       user_id as "userId",
       title,
       mode,
       lesson_id as "lessonId",
       section_id as "sectionId",
       exercise_id as "exerciseId",
       created_at as "createdAt",
       updated_at as "updatedAt";`,
    [
      id,
      userId,
      title,
      mode,
      options?.lessonId || null,
      options?.sectionId || null,
      options?.exerciseId || null,
    ]
  );
  return res.rows[0];
}

/**
 * Retrieves all AI conversations for an authenticated user, ordered by most recently updated.
 */
export async function getUserAiConversations(userId: string): Promise<AiConversationRecord[]> {
  if (activeTestMockStore?.getUserAiConversations) {
    return activeTestMockStore.getUserAiConversations(userId);
  }

  await ensureAiTables();
  const res = await query<AiConversationRecord>(
    `SELECT 
       id,
       user_id as "userId",
       title,
       mode,
       lesson_id as "lessonId",
       section_id as "sectionId",
       exercise_id as "exerciseId",
       created_at as "createdAt",
       updated_at as "updatedAt"
     FROM ai_conversations
     WHERE user_id = $1
     ORDER BY updated_at DESC;`,
    [userId]
  );
  return res.rows;
}

/**
 * Loads a specific conversation and all its messages, strictly validating user ownership.
 * Returns null if the conversation doesn't exist or does not belong to the user.
 */
export async function getAiConversationWithMessages(
  userId: string,
  conversationId: string
): Promise<{ conversation: AiConversationRecord; messages: AiMessageRecord[] } | null> {
  if (activeTestMockStore?.getAiConversationWithMessages) {
    return activeTestMockStore.getAiConversationWithMessages(userId, conversationId);
  }

  await ensureAiTables();

  const convRes = await query<AiConversationRecord>(
    `SELECT 
       id,
       user_id as "userId",
       title,
       mode,
       lesson_id as "lessonId",
       section_id as "sectionId",
       exercise_id as "exerciseId",
       created_at as "createdAt",
       updated_at as "updatedAt"
     FROM ai_conversations
     WHERE id = $1 AND user_id = $2;`,
    [conversationId, userId]
  );

  if (convRes.rows.length === 0) {
    return null;
  }

  const msgRes = await query<AiMessageRecord>(
    `SELECT 
       id,
       conversation_id as "conversationId",
       role,
       content,
       model,
       is_simulated as "isSimulated",
       prompt_tokens as "promptTokens",
       completion_tokens as "completionTokens",
       total_tokens as "totalTokens",
       created_at as "createdAt"
     FROM ai_messages
     WHERE conversation_id = $1
     ORDER BY created_at ASC;`,
    [conversationId]
  );

  return {
    conversation: convRes.rows[0],
    messages: msgRes.rows,
  };
}

/**
 * Updates an AI conversation's title with user ownership enforcement.
 */
export async function updateAiConversationTitle(
  userId: string,
  conversationId: string,
  title: string
): Promise<boolean> {
  if (activeTestMockStore?.updateAiConversationTitle) {
    return activeTestMockStore.updateAiConversationTitle(userId, conversationId, title);
  }

  await ensureAiTables();
  const trimmed = title.trim();
  if (!trimmed) return false;

  const res = await query(
    `UPDATE ai_conversations
     SET title = $1, updated_at = NOW()
     WHERE id = $2 AND user_id = $3;`,
    [trimmed.slice(0, 255), conversationId, userId]
  );
  return (res.rowCount ?? 0) > 0;
}

/**
 * Deletes an AI conversation and cascades deletion of its messages with ownership enforcement.
 */
export async function deleteAiConversation(
  userId: string,
  conversationId: string
): Promise<boolean> {
  if (activeTestMockStore?.deleteAiConversation) {
    return activeTestMockStore.deleteAiConversation(userId, conversationId);
  }

  await ensureAiTables();
  const res = await query(
    `DELETE FROM ai_conversations
     WHERE id = $1 AND user_id = $2;`,
    [conversationId, userId]
  );
  return (res.rowCount ?? 0) > 0;
}

/**
 * Persists a message turn to a conversation, validating that the user owns the conversation.
 */
export async function addAiMessage(
  userId: string,
  conversationId: string,
  message: {
    role: 'user' | 'assistant';
    content: string;
    model?: string;
    isSimulated?: boolean;
    usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number };
  }
): Promise<AiMessageRecord> {
  if (activeTestMockStore?.addAiMessage) {
    return activeTestMockStore.addAiMessage(userId, conversationId, message);
  }

  await ensureAiTables();

  // Validate conversation ownership
  const check = await query(
    `SELECT id FROM ai_conversations WHERE id = $1 AND user_id = $2;`,
    [conversationId, userId]
  );
  if (check.rows.length === 0) {
    throw new Error('Conversation not found or access denied.');
  }

  const id = crypto.randomUUID();
  const res = await query<AiMessageRecord>(
    `INSERT INTO ai_messages
     (id, conversation_id, role, content, model, is_simulated, prompt_tokens, completion_tokens, total_tokens, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
     RETURNING 
       id,
       conversation_id as "conversationId",
       role,
       content,
       model,
       is_simulated as "isSimulated",
       prompt_tokens as "promptTokens",
       completion_tokens as "completionTokens",
       total_tokens as "totalTokens",
       created_at as "createdAt";`,
    [
      id,
      conversationId,
      message.role,
      message.content,
      message.model || null,
      message.isSimulated ?? false,
      message.usage?.promptTokens || null,
      message.usage?.completionTokens || null,
      message.usage?.totalTokens || null,
    ]
  );

  // Touch conversation updated_at
  await query(
    `UPDATE ai_conversations SET updated_at = NOW() WHERE id = $1;`,
    [conversationId]
  );

  return res.rows[0];
}

export interface UserGeneratedLessonRecord {
  id: string;
  userId: string;
  conversationId: string | null;
  title: string;
  topic: string;
  description: string;
  difficulty: string;
  estimatedMinutes: number;
  tags: string[];
  prerequisites: string[];
  learningObjectives: string[];
  contentJson: string;
  createdAt: Date;
  updatedAt: Date;
}

let userGenLessonsTableEnsured = false;

export async function ensureUserGeneratedLessonsTable(): Promise<void> {
  if (userGenLessonsTableEnsured) return;
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS "user_generated_lessons" (
        "id" varchar(36) PRIMARY KEY NOT NULL,
        "user_id" varchar(36) NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "conversation_id" varchar(36) REFERENCES "ai_conversations"("id") ON DELETE SET NULL,
        "title" varchar(255) NOT NULL,
        "topic" varchar(255) NOT NULL,
        "description" text NOT NULL,
        "difficulty" varchar(32) DEFAULT 'intermediate' NOT NULL,
        "estimated_minutes" integer DEFAULT 20 NOT NULL,
        "tags" text DEFAULT '[]' NOT NULL,
        "prerequisites" text DEFAULT '[]' NOT NULL,
        "learning_objectives" text DEFAULT '[]' NOT NULL,
        "content_json" text NOT NULL,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL
      );
      CREATE INDEX IF NOT EXISTS "user_gen_lessons_user_id_idx" ON "user_generated_lessons" ("user_id");
      CREATE INDEX IF NOT EXISTS "user_gen_lessons_user_updated_idx" ON "user_generated_lessons" ("user_id", "updated_at");
    `);
    userGenLessonsTableEnsured = true;
  } catch (err: any) {
    console.error('[User Gen Lessons DB Init Warning]:', err?.message);
  }
}

/**
 * Persists a new AI-generated lesson in the user's personal learning library.
 */
export async function createUserGeneratedLesson(
  userId: string,
  lesson: {
    id?: string;
    conversationId?: string | null;
    title: string;
    topic: string;
    description: string;
    difficulty?: string;
    estimatedMinutes?: number;
    tags?: string[];
    prerequisites?: string[];
    learningObjectives?: string[];
    contentJson: string;
  }
): Promise<UserGeneratedLessonRecord> {
  if (activeTestMockStore?.createUserGeneratedLesson) {
    return activeTestMockStore.createUserGeneratedLesson(userId, lesson);
  }

  await ensureUserGeneratedLessonsTable();
  const id = lesson.id || crypto.randomUUID();
  const difficulty = lesson.difficulty || 'intermediate';
  const estimatedMinutes = lesson.estimatedMinutes ?? 20;
  const tagsJson = JSON.stringify(lesson.tags || []);
  const prereqsJson = JSON.stringify(lesson.prerequisites || []);
  const objectivesJson = JSON.stringify(lesson.learningObjectives || []);

  const res = await query<any>(
    `INSERT INTO user_generated_lessons
     (id, user_id, conversation_id, title, topic, description, difficulty, estimated_minutes, tags, prerequisites, learning_objectives, content_json, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
     RETURNING 
       id,
       user_id as "userId",
       conversation_id as "conversationId",
       title,
       topic,
       description,
       difficulty,
       estimated_minutes as "estimatedMinutes",
       tags,
       prerequisites,
       learning_objectives as "learningObjectives",
       content_json as "contentJson",
       created_at as "createdAt",
       updated_at as "updatedAt";`,
    [
      id,
      userId,
      lesson.conversationId || null,
      lesson.title.trim().slice(0, 255),
      lesson.topic.trim().slice(0, 255),
      lesson.description.trim(),
      difficulty,
      estimatedMinutes,
      tagsJson,
      prereqsJson,
      objectivesJson,
      lesson.contentJson,
    ]
  );

  const row = res.rows[0];
  return {
    ...row,
    tags: safeJsonParseArray(row.tags),
    prerequisites: safeJsonParseArray(row.prerequisites),
    learningObjectives: safeJsonParseArray(row.learningObjectives),
  };
}

/**
 * Retrieves all generated lessons for a user with optional search and difficulty filtering.
 */
export async function getUserGeneratedLessons(
  userId: string,
  filter?: { search?: string; difficulty?: string }
): Promise<UserGeneratedLessonRecord[]> {
  if (activeTestMockStore?.getUserGeneratedLessons) {
    return activeTestMockStore.getUserGeneratedLessons(userId, filter);
  }

  await ensureUserGeneratedLessonsTable();

  let sql = `
    SELECT 
      id,
      user_id as "userId",
      conversation_id as "conversationId",
      title,
      topic,
      description,
      difficulty,
      estimated_minutes as "estimatedMinutes",
      tags,
      prerequisites,
      learning_objectives as "learningObjectives",
      content_json as "contentJson",
      created_at as "createdAt",
      updated_at as "updatedAt"
    FROM user_generated_lessons
    WHERE user_id = $1
  `;
  const params: any[] = [userId];

  if (filter?.difficulty && filter.difficulty !== 'all') {
    params.push(filter.difficulty);
    sql += ` AND difficulty = $${params.length}`;
  }

  if (filter?.search && filter.search.trim()) {
    params.push(`%${filter.search.trim().toLowerCase()}%`);
    sql += ` AND (LOWER(title) LIKE $${params.length} OR LOWER(topic) LIKE $${params.length} OR LOWER(tags) LIKE $${params.length})`;
  }

  sql += ` ORDER BY updated_at DESC;`;

  const res = await query<any>(sql, params);
  return res.rows.map((row) => ({
    ...row,
    tags: safeJsonParseArray(row.tags),
    prerequisites: safeJsonParseArray(row.prerequisites),
    learningObjectives: safeJsonParseArray(row.learningObjectives),
  }));
}

/**
 * Loads a single generated lesson by ID, strictly enforcing user ownership.
 */
export async function getUserGeneratedLessonById(
  userId: string,
  lessonId: string
): Promise<UserGeneratedLessonRecord | null> {
  if (activeTestMockStore?.getUserGeneratedLessonById) {
    return activeTestMockStore.getUserGeneratedLessonById(userId, lessonId);
  }

  await ensureUserGeneratedLessonsTable();
  const res = await query<any>(
    `SELECT 
       id,
       user_id as "userId",
       conversation_id as "conversationId",
       title,
       topic,
       description,
       difficulty,
       estimated_minutes as "estimatedMinutes",
       tags,
       prerequisites,
       learning_objectives as "learningObjectives",
       content_json as "contentJson",
       created_at as "createdAt",
       updated_at as "updatedAt"
     FROM user_generated_lessons
     WHERE id = $1 AND user_id = $2;`,
    [lessonId, userId]
  );

  if (res.rows.length === 0) return null;
  const row = res.rows[0];
  return {
    ...row,
    tags: safeJsonParseArray(row.tags),
    prerequisites: safeJsonParseArray(row.prerequisites),
    learningObjectives: safeJsonParseArray(row.learningObjectives),
  };
}

/**
 * Updates the title of a generated lesson with strict user ownership enforcement.
 */
export async function updateUserGeneratedLessonTitle(
  userId: string,
  lessonId: string,
  title: string
): Promise<boolean> {
  if (activeTestMockStore?.updateUserGeneratedLessonTitle) {
    return activeTestMockStore.updateUserGeneratedLessonTitle(userId, lessonId, title);
  }

  await ensureUserGeneratedLessonsTable();
  const trimmed = title.trim();
  if (!trimmed) return false;

  const res = await query(
    `UPDATE user_generated_lessons
     SET title = $1, updated_at = NOW()
     WHERE id = $2 AND user_id = $3;`,
    [trimmed.slice(0, 255), lessonId, userId]
  );
  return (res.rowCount ?? 0) > 0;
}

/**
 * Deletes a generated lesson with strict user ownership enforcement.
 */
export async function deleteUserGeneratedLesson(
  userId: string,
  lessonId: string
): Promise<boolean> {
  if (activeTestMockStore?.deleteUserGeneratedLesson) {
    return activeTestMockStore.deleteUserGeneratedLesson(userId, lessonId);
  }

  await ensureUserGeneratedLessonsTable();
  const res = await query(
    `DELETE FROM user_generated_lessons
     WHERE id = $1 AND user_id = $2;`,
    [lessonId, userId]
  );
  return (res.rowCount ?? 0) > 0;
}

function safeJsonParseArray(val: unknown): string[] {
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) return parsed;
    } catch {}
  }
  return [];
}

let userQuizzesTablesEnsured = false;

export async function ensureUserQuizzesTables(): Promise<void> {
  if (userQuizzesTablesEnsured) return;
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS "user_quizzes" (
        "id" varchar(36) PRIMARY KEY NOT NULL,
        "user_id" varchar(36) NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "lesson_id" varchar(36) REFERENCES "user_generated_lessons"("id") ON DELETE SET NULL,
        "title" varchar(255) NOT NULL,
        "topic" varchar(255) NOT NULL,
        "difficulty" varchar(32) DEFAULT 'medium' NOT NULL,
        "question_count" integer NOT NULL,
        "question_types" text DEFAULT '["single_choice"]' NOT NULL,
        "questions_json" text NOT NULL,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL
      );
      CREATE INDEX IF NOT EXISTS "user_quizzes_user_id_idx" ON "user_quizzes" ("user_id");
      CREATE INDEX IF NOT EXISTS "user_quizzes_lesson_id_idx" ON "user_quizzes" ("lesson_id");
      CREATE INDEX IF NOT EXISTS "user_quizzes_user_updated_idx" ON "user_quizzes" ("user_id", "updated_at");

      CREATE TABLE IF NOT EXISTS "quiz_attempts" (
        "id" varchar(36) PRIMARY KEY NOT NULL,
        "quiz_id" varchar(36) NOT NULL REFERENCES "user_quizzes"("id") ON DELETE CASCADE,
        "user_id" varchar(36) NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "score" integer NOT NULL,
        "total_questions" integer NOT NULL,
        "percentage" integer NOT NULL,
        "time_taken_seconds" integer,
        "answers_json" text NOT NULL,
        "results_json" text NOT NULL,
        "completed_at" timestamp with time zone DEFAULT now() NOT NULL
      );
      CREATE INDEX IF NOT EXISTS "quiz_attempts_quiz_id_idx" ON "quiz_attempts" ("quiz_id");
      CREATE INDEX IF NOT EXISTS "quiz_attempts_user_id_idx" ON "quiz_attempts" ("user_id");
      CREATE INDEX IF NOT EXISTS "quiz_attempts_user_completed_idx" ON "quiz_attempts" ("user_id", "completed_at");
    `);
    userQuizzesTablesEnsured = true;
  } catch (err: any) {
    console.warn('[DB Init Warning]: Failed to ensure user_quizzes tables:', err?.message);
  }
}

export interface UserQuizRecord {
  id: string;
  userId: string;
  lessonId: string | null;
  title: string;
  topic: string;
  difficulty: 'easy' | 'medium' | 'hard';
  questionCount: number;
  questionTypes: string[];
  questionsJson: string;
  createdAt: string;
  updatedAt: string;
  latestAttempt?: {
    id: string;
    score: number;
    totalQuestions: number;
    percentage: number;
    completedAt: string;
  } | null;
}

export interface QuizAttemptRecord {
  id: string;
  quizId: string;
  userId: string;
  score: number;
  totalQuestions: number;
  percentage: number;
  timeTakenSeconds?: number;
  answersJson: string;
  resultsJson: string;
  answers?: Record<string, any>;
  results?: any[];
  completedAt: string;
}

/**
 * Creates and persists a generated quiz for a user.
 */
export async function createUserQuiz(
  userId: string,
  quiz: {
    id?: string;
    lessonId?: string | null;
    title: string;
    topic: string;
    difficulty?: string;
    questionCount: number;
    questionTypes: string[];
    questionsJson: string;
  }
): Promise<UserQuizRecord> {
  if (activeTestMockStore?.createUserQuiz) {
    return activeTestMockStore.createUserQuiz(userId, quiz);
  }

  await ensureUserQuizzesTables();
  const id = quiz.id || crypto.randomUUID();
  const difficulty = (quiz.difficulty || 'medium').toLowerCase();
  const questionTypesJson = JSON.stringify(quiz.questionTypes || ['single_choice']);

  const res = await query<any>(
    `INSERT INTO user_quizzes
     (id, user_id, lesson_id, title, topic, difficulty, question_count, question_types, questions_json, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
     RETURNING 
       id,
       user_id as "userId",
       lesson_id as "lessonId",
       title,
       topic,
       difficulty,
       question_count as "questionCount",
       question_types as "questionTypes",
       questions_json as "questionsJson",
       created_at as "createdAt",
       updated_at as "updatedAt";`,
    [
      id,
      userId,
      quiz.lessonId || null,
      quiz.title.slice(0, 255),
      quiz.topic.slice(0, 255),
      difficulty,
      quiz.questionCount,
      questionTypesJson,
      quiz.questionsJson,
    ]
  );

  const row = res.rows[0];
  return {
    ...row,
    questionTypes: safeJsonParseArray(row.questionTypes),
    createdAt: row.createdAt?.toISOString?.() || String(row.createdAt),
    updatedAt: row.updatedAt?.toISOString?.() || String(row.updatedAt),
  };
}

/**
 * Retrieves all quizzes for a user with optional search and difficulty filtering.
 */
export async function getUserQuizzes(
  userId: string,
  filter?: { search?: string; difficulty?: string; lessonId?: string }
): Promise<UserQuizRecord[]> {
  if (activeTestMockStore?.getUserQuizzes) {
    return activeTestMockStore.getUserQuizzes(userId, filter);
  }

  await ensureUserQuizzesTables();

  let sql = `
    SELECT 
      q.id,
      q.user_id as "userId",
      q.lesson_id as "lessonId",
      q.title,
      q.topic,
      q.difficulty,
      q.question_count as "questionCount",
      q.question_types as "questionTypes",
      q.questions_json as "questionsJson",
      q.created_at as "createdAt",
      q.updated_at as "updatedAt",
      a.id as "attemptId",
      a.score as "attemptScore",
      a.total_questions as "attemptTotal",
      a.percentage as "attemptPercentage",
      a.completed_at as "attemptCompletedAt"
    FROM user_quizzes q
    LEFT JOIN LATERAL (
      SELECT id, score, total_questions, percentage, completed_at
      FROM quiz_attempts
      WHERE quiz_id = q.id AND user_id = $1
      ORDER BY completed_at DESC
      LIMIT 1
    ) a ON true
    WHERE q.user_id = $1
  `;
  const params: any[] = [userId];

  if (filter?.lessonId) {
    params.push(filter.lessonId);
    sql += ` AND q.lesson_id = $${params.length}`;
  }

  if (filter?.difficulty && filter.difficulty !== 'all') {
    params.push(filter.difficulty.toLowerCase());
    sql += ` AND LOWER(q.difficulty) = $${params.length}`;
  }

  if (filter?.search && filter.search.trim()) {
    params.push(`%${filter.search.trim()}%`);
    sql += ` AND (q.title ILIKE $${params.length} OR q.topic ILIKE $${params.length})`;
  }

  sql += ` ORDER BY q.updated_at DESC;`;

  const res = await query<any>(sql, params);
  return res.rows.map((row) => ({
    id: row.id,
    userId: row.userId,
    lessonId: row.lessonId,
    title: row.title,
    topic: row.topic,
    difficulty: row.difficulty,
    questionCount: row.questionCount,
    questionTypes: safeJsonParseArray(row.questionTypes),
    questionsJson: row.questionsJson,
    createdAt: row.createdAt?.toISOString?.() || String(row.createdAt),
    updatedAt: row.updatedAt?.toISOString?.() || String(row.updatedAt),
    latestAttempt: row.attemptId
      ? {
          id: row.attemptId,
          score: row.attemptScore,
          totalQuestions: row.attemptTotal,
          percentage: row.attemptPercentage,
          completedAt: row.attemptCompletedAt?.toISOString?.() || String(row.attemptCompletedAt),
        }
      : null,
  }));
}

/**
 * Retrieves a single quiz by ID, strictly scoped to the authenticated user.
 */
export async function getUserQuizById(
  userId: string,
  quizId: string
): Promise<UserQuizRecord | null> {
  if (activeTestMockStore?.getUserQuizById) {
    return activeTestMockStore.getUserQuizById(userId, quizId);
  }

  await ensureUserQuizzesTables();
  const res = await query<any>(
    `SELECT 
       q.id,
       q.user_id as "userId",
       q.lesson_id as "lessonId",
       q.title,
       q.topic,
       q.difficulty,
       q.question_count as "questionCount",
       q.question_types as "questionTypes",
       q.questions_json as "questionsJson",
       q.created_at as "createdAt",
       q.updated_at as "updatedAt",
       a.id as "attemptId",
       a.score as "attemptScore",
       a.total_questions as "attemptTotal",
       a.percentage as "attemptPercentage",
       a.completed_at as "attemptCompletedAt"
     FROM user_quizzes q
     LEFT JOIN LATERAL (
       SELECT id, score, total_questions, percentage, completed_at
       FROM quiz_attempts
       WHERE quiz_id = q.id AND user_id = $1
       ORDER BY completed_at DESC
       LIMIT 1
     ) a ON true
     WHERE q.id = $2 AND q.user_id = $1;`,
    [userId, quizId]
  );

  if (res.rows.length === 0) return null;
  const row = res.rows[0];
  return {
    id: row.id,
    userId: row.userId,
    lessonId: row.lessonId,
    title: row.title,
    topic: row.topic,
    difficulty: row.difficulty,
    questionCount: row.questionCount,
    questionTypes: safeJsonParseArray(row.questionTypes),
    questionsJson: row.questionsJson,
    createdAt: row.createdAt?.toISOString?.() || String(row.createdAt),
    updatedAt: row.updatedAt?.toISOString?.() || String(row.updatedAt),
    latestAttempt: row.attemptId
      ? {
          id: row.attemptId,
          score: row.attemptScore,
          totalQuestions: row.attemptTotal,
          percentage: row.attemptPercentage,
          completedAt: row.attemptCompletedAt?.toISOString?.() || String(row.attemptCompletedAt),
        }
      : null,
  };
}

/**
 * Updates a question's text or options within a saved quiz, verifying answer-key consistency.
 */
export async function updateQuizQuestion(
  userId: string,
  quizId: string,
  questionId: string,
  updates: { question?: string; options?: Array<{ id: string; text: string }>; scenarioContext?: string }
): Promise<boolean> {
  if (activeTestMockStore?.updateQuizQuestion) {
    return activeTestMockStore.updateQuizQuestion(userId, quizId, questionId, updates);
  }

  const quiz = await getUserQuizById(userId, quizId);
  if (!quiz) return false;

  let questions: any[] = [];
  try {
    questions = JSON.parse(quiz.questionsJson);
  } catch {
    return false;
  }

  const qIndex = questions.findIndex((q) => q.id === questionId);
  if (qIndex === -1) return false;

  const target = questions[qIndex];

  // If question text updated
  if (typeof updates.question === 'string' && updates.question.trim()) {
    target.question = updates.question.trim().slice(0, 1000);
  }

  if (typeof updates.scenarioContext === 'string') {
    target.scenarioContext = updates.scenarioContext.trim().slice(0, 2000);
  }

  // If options updated, verify answer key consistency
  if (Array.isArray(updates.options) && updates.options.length >= 2) {
    const newOptionIds = new Set(updates.options.map((o) => o.id));

    // Verify existing correctAnswer remains valid
    if (typeof target.correctAnswer === 'string') {
      if (!newOptionIds.has(target.correctAnswer)) {
        throw new Error(`Cannot update options: existing correct answer "${target.correctAnswer}" was removed.`);
      }
    } else if (Array.isArray(target.correctAnswer)) {
      const allFound = target.correctAnswer.every((ans: string) => newOptionIds.has(ans));
      if (!allFound) {
        throw new Error('Cannot update options: one or more correct answer option IDs were removed.');
      }
    }

    target.options = updates.options;
  }

  questions[qIndex] = target;

  const res = await query(
    `UPDATE user_quizzes
     SET questions_json = $1, updated_at = NOW()
     WHERE id = $2 AND user_id = $3;`,
    [JSON.stringify(questions), quizId, userId]
  );

  return (res.rowCount ?? 0) > 0;
}

/**
 * Deletes a quiz and all associated attempts with strict user ownership enforcement.
 */
export async function deleteUserQuiz(
  userId: string,
  quizId: string
): Promise<boolean> {
  if (activeTestMockStore?.deleteUserQuiz) {
    return activeTestMockStore.deleteUserQuiz(userId, quizId);
  }

  await ensureUserQuizzesTables();
  const res = await query(
    `DELETE FROM user_quizzes
     WHERE id = $1 AND user_id = $2;`,
    [quizId, userId]
  );
  return (res.rowCount ?? 0) > 0;
}

/**
 * Records a scored quiz attempt.
 */
export async function recordQuizAttempt(
  userId: string,
  quizId: string,
  attempt: {
    id?: string;
    score: number;
    totalQuestions: number;
    percentage: number;
    timeTakenSeconds?: number;
    answersJson: string;
    resultsJson: string;
  }
): Promise<QuizAttemptRecord> {
  if (activeTestMockStore?.recordQuizAttempt) {
    return activeTestMockStore.recordQuizAttempt(userId, quizId, attempt);
  }

  await ensureUserQuizzesTables();
  const id = attempt.id || crypto.randomUUID();

  const res = await query<any>(
    `INSERT INTO quiz_attempts
     (id, quiz_id, user_id, score, total_questions, percentage, time_taken_seconds, answers_json, results_json, completed_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
     RETURNING 
       id,
       quiz_id as "quizId",
       user_id as "userId",
       score,
       total_questions as "totalQuestions",
       percentage,
       time_taken_seconds as "timeTakenSeconds",
       answers_json as "answersJson",
       results_json as "resultsJson",
       completed_at as "completedAt";`,
    [
      id,
      quizId,
      userId,
      attempt.score,
      attempt.totalQuestions,
      attempt.percentage,
      attempt.timeTakenSeconds || null,
      attempt.answersJson,
      attempt.resultsJson,
    ]
  );

  const row = res.rows[0];
  return {
    ...row,
    completedAt: row.completedAt?.toISOString?.() || String(row.completedAt),
  };
}

/**
 * Retrieves all completed attempts for a quiz, ordered by most recent first.
 */
export async function getQuizAttempts(
  userId: string,
  quizId: string
): Promise<QuizAttemptRecord[]> {
  if (activeTestMockStore?.getQuizAttempts) {
    return activeTestMockStore.getQuizAttempts(userId, quizId);
  }

  await ensureUserQuizzesTables();
  const res = await query<any>(
    `SELECT 
       id,
       quiz_id as "quizId",
       user_id as "userId",
       score,
       total_questions as "totalQuestions",
       percentage,
       time_taken_seconds as "timeTakenSeconds",
       answers_json as "answersJson",
       results_json as "resultsJson",
       completed_at as "completedAt"
     FROM quiz_attempts
     WHERE quiz_id = $1 AND user_id = $2
     ORDER BY completed_at DESC;`,
    [quizId, userId]
  );

  return res.rows.map((row) => ({
    ...row,
    completedAt: row.completedAt?.toISOString?.() || String(row.completedAt),
  }));
}

/**
 * Retrieves a single quiz attempt by ID with full itemized breakdown.
 */
export async function getQuizAttemptById(
  userId: string,
  attemptId: string
): Promise<QuizAttemptRecord | null> {
  if (activeTestMockStore?.getQuizAttemptById) {
    return activeTestMockStore.getQuizAttemptById(userId, attemptId);
  }

  await ensureUserQuizzesTables();
  const res = await query<any>(
    `SELECT 
       id,
       quiz_id as "quizId",
       user_id as "userId",
       score,
       total_questions as "totalQuestions",
       percentage,
       time_taken_seconds as "timeTakenSeconds",
       answers_json as "answersJson",
       results_json as "resultsJson",
       completed_at as "completedAt"
     FROM quiz_attempts
     WHERE id = $1 AND user_id = $2;`,
    [attemptId, userId]
  );

  if (res.rows.length === 0) return null;
  const row = res.rows[0];
  let results: any[] = [];
  if (row.resultsJson) {
    try {
      results = JSON.parse(row.resultsJson);
    } catch {}
  }
  let answers: any = {};
  if (row.answersJson) {
    try {
      answers = JSON.parse(row.answersJson);
    } catch {}
  }

  return {
    ...row,
    results,
    answers,
    completedAt: row.completedAt?.toISOString?.() || String(row.completedAt),
  };
}

/**
 * Retrieves the quiz linked to a specific user-generated lesson.
 */
export async function getLessonQuiz(
  userId: string,
  lessonId: string
): Promise<UserQuizRecord | null> {
  if (activeTestMockStore?.getLessonQuiz) {
    return activeTestMockStore.getLessonQuiz(userId, lessonId);
  }

  await ensureUserQuizzesTables();
  const res = await query<any>(
    `SELECT 
       q.id,
       q.user_id as "userId",
       q.lesson_id as "lessonId",
       q.title,
       q.topic,
       q.difficulty,
       q.question_count as "questionCount",
       q.question_types as "questionTypes",
       q.questions_json as "questionsJson",
       q.created_at as "createdAt",
       q.updated_at as "updatedAt",
       a.id as "attemptId",
       a.score as "attemptScore",
       a.total_questions as "attemptTotal",
       a.percentage as "attemptPercentage",
       a.completed_at as "attemptCompletedAt"
     FROM user_quizzes q
     LEFT JOIN LATERAL (
       SELECT id, score, total_questions, percentage, completed_at
       FROM quiz_attempts
       WHERE quiz_id = q.id AND user_id = $1
       ORDER BY completed_at DESC
       LIMIT 1
     ) a ON true
     WHERE q.lesson_id = $2 AND q.user_id = $1
     ORDER BY q.updated_at DESC
     LIMIT 1;`,
    [userId, lessonId]
  );

  if (res.rows.length === 0) return null;
  const row = res.rows[0];
  return {
    id: row.id,
    userId: row.userId,
    lessonId: row.lessonId,
    title: row.title,
    topic: row.topic,
    difficulty: row.difficulty,
    questionCount: row.questionCount,
    questionTypes: safeJsonParseArray(row.questionTypes),
    questionsJson: row.questionsJson,
    createdAt: row.createdAt?.toISOString?.() || String(row.createdAt),
    updatedAt: row.updatedAt?.toISOString?.() || String(row.updatedAt),
    latestAttempt: row.attemptId
      ? {
          id: row.attemptId,
          score: row.attemptScore,
          totalQuestions: row.attemptTotal,
          percentage: row.attemptPercentage,
          completedAt: row.attemptCompletedAt?.toISOString?.() || String(row.attemptCompletedAt),
        }
      : null,
  };
}

// ============================================================================
// Generation Tasks Database Layer (Persistent Background AI Generation)
// ============================================================================

export interface GenerationTaskRecord {
  id: string;
  userId: string;
  taskType: 'lesson' | 'quiz' | 'flashcards';
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
  currentStage: 'queued' | 'prompting_ai' | 'validating_schema' | 'persisting';
  title: string;
  topic: string;
  difficulty: string;
  idempotencyKey: string;
  inputParamsJson: string;
  resultDataJson?: string | null;
  persistedEntityId?: string | null;
  errorMessage?: string | null;
  errorCategory?: string | null;
  isRetryable: boolean;
  executionDeadlineAt?: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
}

let generationTasksTableEnsured = false;

export async function ensureGenerationTasksTable(): Promise<void> {
  if (generationTasksTableEnsured) return;
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS "generation_tasks" (
        "id" varchar(36) PRIMARY KEY NOT NULL,
        "user_id" varchar(36) NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "task_type" varchar(32) NOT NULL,
        "status" varchar(20) DEFAULT 'queued' NOT NULL,
        "current_stage" varchar(32) DEFAULT 'queued' NOT NULL,
        "title" varchar(255) NOT NULL,
        "topic" varchar(255) NOT NULL,
        "difficulty" varchar(32) DEFAULT 'intermediate' NOT NULL,
        "idempotency_key" varchar(64) NOT NULL,
        "input_params_json" text NOT NULL,
        "result_data_json" text,
        "persisted_entity_id" varchar(36),
        "error_message" text,
        "error_category" varchar(64),
        "is_retryable" boolean DEFAULT true NOT NULL,
        "execution_deadline_at" timestamp with time zone,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
        "completed_at" timestamp with time zone
      );
      CREATE INDEX IF NOT EXISTS "generation_tasks_user_id_idx" ON "generation_tasks" ("user_id");
      CREATE INDEX IF NOT EXISTS "generation_tasks_user_status_idx" ON "generation_tasks" ("user_id", "status");
      CREATE INDEX IF NOT EXISTS "generation_tasks_created_idx" ON "generation_tasks" ("created_at");
      CREATE INDEX IF NOT EXISTS "generation_tasks_active_deadline_idx" ON "generation_tasks" ("status", "execution_deadline_at");
      CREATE UNIQUE INDEX IF NOT EXISTS "generation_tasks_active_idempotency_idx" ON "generation_tasks" ("user_id", "idempotency_key") WHERE "status" IN ('queued', 'processing');
    `);
    generationTasksTableEnsured = true;
  } catch (err: any) {
    console.warn('[DB Init Warning]: Failed to ensure generation_tasks table:', err?.message);
  }
}

/**
 * Serverless function execution ceiling configured in vercel.json.
 * Fluid Compute enforces maxDuration as a hard limit beyond which functions are killed.
 */
export const MAX_FUNCTION_DURATION_SECONDS = 60;

/**
 * Safety buffer reserved for schema validation, database persistence, and graceful error handling.
 */
export const TASK_SAFETY_BUFFER_SECONDS = 10;

/**
 * Default execution window allocated for an active running generation task (50 seconds).
 * Guarantees at least 10s headroom before the 60s Vercel container ceiling is hit.
 */
export const DEFAULT_TASK_EXECUTION_BUDGET_SECONDS = MAX_FUNCTION_DURATION_SECONDS - TASK_SAFETY_BUFFER_SECONDS; // 50s

/**
 * Maximum duration a task can remain in 'queued' status before being deemed abandoned by a worker.
 */
export const DEFAULT_QUEUE_TIMEOUT_SECONDS = 180; // 3 minutes

/**
 * Resolves the bounded execution deadline for AI generation tasks.
 * Hierarchy:
 * 1. process.env.AI_TASK_DEADLINE_SECONDS (clamped between 15s and 55s, strictly below MAX_FUNCTION_DURATION_SECONDS)
 * 2. 50 seconds (safe default ensuring 10s headroom within the 60s Vercel function limit)
 */
export function getTaskExecutionDeadlineSeconds(): number {
  const envVal = process.env.AI_TASK_DEADLINE_SECONDS;
  if (envVal) {
    const parsed = parseInt(envVal, 10);
    if (!isNaN(parsed)) {
      // Strictly clamp: minimum 15s, maximum 55s (never exceed 60s function limit)
      return Math.min(Math.max(parsed, 15), MAX_FUNCTION_DURATION_SECONDS - 5);
    }
  }
  return DEFAULT_TASK_EXECUTION_BUDGET_SECONDS;
}

/**
 * Creates a new generation task with atomic idempotency prevention.
 * Strictly adheres to the lifecycle: newly created tasks begin in 'queued' status.
 * If an active task with the exact same idempotency key exists and has not timed out,
 * returns the existing task with alreadyExists = true.
 */
export async function createGenerationTask(
  userId: string,
  task: {
    id?: string;
    taskType: 'lesson' | 'quiz' | 'flashcards';
    title: string;
    topic: string;
    difficulty?: string;
    idempotencyKey: string;
    inputParams: Record<string, any>;
    deadlineSeconds?: number;
    queueTimeoutSeconds?: number;
  }
): Promise<{ task: GenerationTaskRecord; alreadyExists: boolean }> {
  if (activeTestMockStore?.createGenerationTask) {
    return activeTestMockStore.createGenerationTask(userId, task);
  }

  await ensureGenerationTasksTable();

  // 1. Check for existing active in-flight task that has not expired
  const existingRes = await query<any>(
    `SELECT 
       id, user_id as "userId", task_type as "taskType", status, current_stage as "currentStage",
       title, topic, difficulty, idempotency_key as "idempotencyKey",
       input_params_json as "inputParamsJson", result_data_json as "resultDataJson",
       persisted_entity_id as "persistedEntityId", error_message as "errorMessage",
       error_category as "errorCategory", is_retryable as "isRetryable",
       execution_deadline_at as "executionDeadlineAt",
       created_at as "createdAt", updated_at as "updatedAt", completed_at as "completedAt"
     FROM generation_tasks
     WHERE user_id = $1 AND idempotency_key = $2 AND status IN ('queued', 'processing')
       AND (execution_deadline_at IS NULL OR execution_deadline_at > NOW())
     ORDER BY created_at DESC
     LIMIT 1;`,
    [userId, task.idempotencyKey]
  );

  if (existingRes.rows.length > 0) {
    const row = existingRes.rows[0];
    return {
      task: {
        ...row,
        createdAt: row.createdAt?.toISOString?.() || String(row.createdAt),
        updatedAt: row.updatedAt?.toISOString?.() || String(row.updatedAt),
        executionDeadlineAt: row.executionDeadlineAt?.toISOString?.() || (row.executionDeadlineAt ? String(row.executionDeadlineAt) : null),
        completedAt: row.completedAt?.toISOString?.() || (row.completedAt ? String(row.completedAt) : null),
      },
      alreadyExists: true,
    };
  }

  const taskId = task.id || crypto.randomUUID();
  const queueTimeout = task.queueTimeoutSeconds && task.queueTimeoutSeconds >= 30
    ? task.queueTimeoutSeconds
    : DEFAULT_QUEUE_TIMEOUT_SECONDS;
  const difficulty = (task.difficulty || 'intermediate').toLowerCase();
  const inputParamsJson = JSON.stringify(task.inputParams);

  try {
    const insertRes = await query<any>(
      `INSERT INTO generation_tasks (
         id, user_id, task_type, status, current_stage, title, topic, difficulty,
         idempotency_key, input_params_json, is_retryable, execution_deadline_at,
         created_at, updated_at
       )
       VALUES (
         $1, $2, $3, 'queued', 'queued', $4, $5, $6,
         $7, $8, true, NOW() + ($9 || ' seconds')::INTERVAL,
         NOW(), NOW()
       )
       RETURNING 
         id, user_id as "userId", task_type as "taskType", status, current_stage as "currentStage",
         title, topic, difficulty, idempotency_key as "idempotencyKey",
         input_params_json as "inputParamsJson", result_data_json as "resultDataJson",
         persisted_entity_id as "persistedEntityId", error_message as "errorMessage",
         error_category as "errorCategory", is_retryable as "isRetryable",
         execution_deadline_at as "executionDeadlineAt",
         created_at as "createdAt", updated_at as "updatedAt", completed_at as "completedAt";`,
      [
        taskId,
        userId,
        task.taskType,
        task.title,
        task.topic,
        difficulty,
        task.idempotencyKey,
        inputParamsJson,
        String(queueTimeout),
      ]
    );

    const row = insertRes.rows[0];
    return {
      task: {
        ...row,
        createdAt: row.createdAt?.toISOString?.() || String(row.createdAt),
        updatedAt: row.updatedAt?.toISOString?.() || String(row.updatedAt),
        executionDeadlineAt: row.executionDeadlineAt?.toISOString?.() || (row.executionDeadlineAt ? String(row.executionDeadlineAt) : null),
        completedAt: row.completedAt?.toISOString?.() || (row.completedAt ? String(row.completedAt) : null),
      },
      alreadyExists: false,
    };
  } catch (err: any) {
    // If unique constraint violation occurred due to concurrent collision, return existing active task
    if (err?.code === '23505' || err?.message?.includes('duplicate key') || err?.message?.includes('unique')) {
      const raceExistingRes = await query<any>(
        `SELECT 
           id, user_id as "userId", task_type as "taskType", status, current_stage as "currentStage",
           title, topic, difficulty, idempotency_key as "idempotencyKey",
           input_params_json as "inputParamsJson", result_data_json as "resultDataJson",
           persisted_entity_id as "persistedEntityId", error_message as "errorMessage",
           error_category as "errorCategory", is_retryable as "isRetryable",
           execution_deadline_at as "executionDeadlineAt",
           created_at as "createdAt", updated_at as "updatedAt", completed_at as "completedAt"
         FROM generation_tasks
         WHERE user_id = $1 AND idempotency_key = $2 AND status IN ('queued', 'processing')
         ORDER BY created_at DESC
         LIMIT 1;`,
        [userId, task.idempotencyKey]
      );
      if (raceExistingRes.rows.length > 0) {
        const row = raceExistingRes.rows[0];
        return {
          task: {
            ...row,
            createdAt: row.createdAt?.toISOString?.() || String(row.createdAt),
            updatedAt: row.updatedAt?.toISOString?.() || String(row.updatedAt),
            executionDeadlineAt: row.executionDeadlineAt?.toISOString?.() || (row.executionDeadlineAt ? String(row.executionDeadlineAt) : null),
            completedAt: row.completedAt?.toISOString?.() || (row.completedAt ? String(row.completedAt) : null),
          },
          alreadyExists: true,
        };
      }
    }
    throw err;
  }
}

/**
 * Explicit lifecycle transition: transitions an active task from 'queued' to 'processing'.
 * Atomic guard: ONLY transitions if the task is currently in 'queued' status.
 * If user cancelled while queued, this returns false so execution does not start.
 * 
 * Crucially: Sets/resets execution_deadline_at to NOW() + executionBudgetSeconds (default 50s),
 * ensuring queue waiting time does not consume the task's active execution budget.
 */
export async function startGenerationTaskProcessing(
  taskId: string,
  stage: 'prompting_ai' = 'prompting_ai',
  executionBudgetSeconds: number = getTaskExecutionDeadlineSeconds()
): Promise<boolean> {
  if (activeTestMockStore?.startGenerationTaskProcessing) {
    return activeTestMockStore.startGenerationTaskProcessing(taskId, stage, executionBudgetSeconds);
  }

  await ensureGenerationTasksTable();

  // Clamp budget so it never exceeds serverless function limits
  const clampedBudget = Math.min(
    Math.max(executionBudgetSeconds, 15),
    MAX_FUNCTION_DURATION_SECONDS - 5
  );

  const res = await query(
    `UPDATE generation_tasks
     SET status = 'processing',
         current_stage = $1,
         execution_deadline_at = NOW() + ($2 || ' seconds')::INTERVAL,
         updated_at = NOW()
     WHERE id = $3 AND status = 'queued';`,
    [stage, String(clampedBudget), taskId]
  );

  return (res.rowCount ?? 0) > 0;
}

/**
 * Retrieves a generation task by ID for an authenticated user.
 * Self-heals tasks that have exceeded their execution deadline by marking them failed.
 */
export async function getGenerationTaskById(
  userId: string,
  taskId: string
): Promise<GenerationTaskRecord | null> {
  if (activeTestMockStore?.getGenerationTaskById) {
    return activeTestMockStore.getGenerationTaskById(userId, taskId);
  }

  await ensureGenerationTasksTable();

  const res = await query<any>(
    `SELECT 
       id, user_id as "userId", task_type as "taskType", status, current_stage as "currentStage",
       title, topic, difficulty, idempotency_key as "idempotencyKey",
       input_params_json as "inputParamsJson", result_data_json as "resultDataJson",
       persisted_entity_id as "persistedEntityId", error_message as "errorMessage",
       error_category as "errorCategory", is_retryable as "isRetryable",
       execution_deadline_at as "executionDeadlineAt",
       created_at as "createdAt", updated_at as "updatedAt", completed_at as "completedAt"
     FROM generation_tasks
     WHERE id = $1 AND user_id = $2;`,
    [taskId, userId]
  );

  if (res.rows.length === 0) return null;
  const row = res.rows[0];

  // Self-heal: If task is in 'queued' or 'processing' but execution deadline has passed, mark as failed
  if (
    (row.status === 'queued' || row.status === 'processing') &&
    row.executionDeadlineAt &&
    new Date(row.executionDeadlineAt) < new Date()
  ) {
    const isQueued = row.status === 'queued';
    const failureMsg = isQueued
      ? 'The generation task timed out while waiting in the queue. You may retry.'
      : 'The generation task exceeded its execution deadline and timed out. You may retry.';

    await query(
      `UPDATE generation_tasks
       SET status = 'failed',
           error_message = $1,
           error_category = 'timeout',
           is_retryable = true,
           completed_at = NOW(),
           updated_at = NOW()
       WHERE id = $2 AND status IN ('queued', 'processing');`,
      [failureMsg, taskId]
    );

    return {
      ...row,
      status: 'failed',
      errorMessage: failureMsg,
      errorCategory: 'timeout',
      isRetryable: true,
      completedAt: new Date().toISOString(),
      createdAt: row.createdAt?.toISOString?.() || String(row.createdAt),
      updatedAt: new Date().toISOString(),
      executionDeadlineAt: row.executionDeadlineAt?.toISOString?.() || String(row.executionDeadlineAt),
    };
  }

  return {
    ...row,
    createdAt: row.createdAt?.toISOString?.() || String(row.createdAt),
    updatedAt: row.updatedAt?.toISOString?.() || String(row.updatedAt),
    executionDeadlineAt: row.executionDeadlineAt?.toISOString?.() || (row.executionDeadlineAt ? String(row.executionDeadlineAt) : null),
    completedAt: row.completedAt?.toISOString?.() || (row.completedAt ? String(row.completedAt) : null),
  };
}

/**
 * Retrieves all active (queued or processing) generation tasks for an authenticated user.
 */
export async function getUserActiveGenerationTasks(userId: string): Promise<GenerationTaskRecord[]> {
  if (activeTestMockStore?.getUserActiveGenerationTasks) {
    return activeTestMockStore.getUserActiveGenerationTasks(userId);
  }

  await ensureGenerationTasksTable();

  // Self-heal any expired tasks for this user before retrieving active list
  await query(
    `UPDATE generation_tasks
     SET status = 'failed',
         error_message = CASE WHEN status = 'queued' THEN 'The generation task timed out while waiting in the queue. You may retry.' ELSE 'The generation task exceeded its execution deadline and timed out. You may retry.' END,
         error_category = 'timeout',
         is_retryable = true,
         completed_at = NOW(),
         updated_at = NOW()
     WHERE user_id = $1 AND status IN ('queued', 'processing')
       AND execution_deadline_at IS NOT NULL AND execution_deadline_at < NOW();`,
    [userId]
  );

  const res = await query<any>(
    `SELECT 
       id, user_id as "userId", task_type as "taskType", status, current_stage as "currentStage",
       title, topic, difficulty, idempotency_key as "idempotencyKey",
       input_params_json as "inputParamsJson", result_data_json as "resultDataJson",
       persisted_entity_id as "persistedEntityId", error_message as "errorMessage",
       error_category as "errorCategory", is_retryable as "isRetryable",
       execution_deadline_at as "executionDeadlineAt",
       created_at as "createdAt", updated_at as "updatedAt", completed_at as "completedAt"
     FROM generation_tasks
     WHERE user_id = $1 AND status IN ('queued', 'processing')
       AND (execution_deadline_at IS NULL OR execution_deadline_at > NOW())
     ORDER BY created_at DESC
     LIMIT 5;`,
    [userId]
  );

  return res.rows.map((row) => ({
    ...row,
    createdAt: row.createdAt?.toISOString?.() || String(row.createdAt),
    updatedAt: row.updatedAt?.toISOString?.() || String(row.updatedAt),
    executionDeadlineAt: row.executionDeadlineAt?.toISOString?.() || (row.executionDeadlineAt ? String(row.executionDeadlineAt) : null),
    completedAt: row.completedAt?.toISOString?.() || (row.completedAt ? String(row.completedAt) : null),
  }));
}

/**
 * Conditionally updates the current stage of an active generation task.
 */
export async function updateGenerationTaskStage(
  taskId: string,
  stage: 'queued' | 'prompting_ai' | 'validating_schema' | 'persisting'
): Promise<boolean> {
  if (activeTestMockStore?.updateGenerationTaskStage) {
    return activeTestMockStore.updateGenerationTaskStage(taskId, stage);
  }

  await ensureGenerationTasksTable();

  const res = await query(
    `UPDATE generation_tasks
     SET current_stage = $1, updated_at = NOW()
     WHERE id = $2 AND status = 'processing';`,
    [stage, taskId]
  );

  return (res.rowCount ?? 0) > 0;
}

/**
 * Conditionally completes a generation task.
 * Atomic guard: ONLY transitions to 'completed' if the task is STILL in 'processing' status.
 * If the user cancelled the task while provider was executing, this returns false and drops persistence.
 */
export async function completeGenerationTask(
  taskId: string,
  resultData: any,
  persistedEntityId?: string | null
): Promise<boolean> {
  if (activeTestMockStore?.completeGenerationTask) {
    return activeTestMockStore.completeGenerationTask(taskId, resultData, persistedEntityId || undefined);
  }

  await ensureGenerationTasksTable();

  const resultDataJson = typeof resultData === 'string' ? resultData : JSON.stringify(resultData);

  const res = await query(
    `UPDATE generation_tasks
     SET status = 'completed',
         current_stage = 'persisting',
         result_data_json = $1,
         persisted_entity_id = $2,
         completed_at = NOW(),
         updated_at = NOW()
     WHERE id = $3 AND status = 'processing';`,
    [resultDataJson, persistedEntityId || null, taskId]
  );

  return (res.rowCount ?? 0) > 0;
}

/**
 * Conditionally marks an active task as failed with sanitized error details.
 */
export async function failGenerationTask(
  taskId: string,
  error: {
    message: string;
    category?: string;
    isRetryable?: boolean;
  }
): Promise<boolean> {
  if (activeTestMockStore?.failGenerationTask) {
    return activeTestMockStore.failGenerationTask(taskId, error);
  }

  await ensureGenerationTasksTable();

  const res = await query(
    `UPDATE generation_tasks
     SET status = 'failed',
         error_message = $1,
         error_category = $2,
         is_retryable = $3,
         completed_at = NOW(),
         updated_at = NOW()
     WHERE id = $4 AND status IN ('queued', 'processing');`,
    [
      error.message,
      error.category || 'unknown',
      error.isRetryable !== false,
      taskId,
    ]
  );

  return (res.rowCount ?? 0) > 0;
}

/**
 * Cancels an active generation task on behalf of the owning user.
 */
export async function cancelGenerationTask(userId: string, taskId: string): Promise<boolean> {
  if (activeTestMockStore?.cancelGenerationTask) {
    return activeTestMockStore.cancelGenerationTask(userId, taskId);
  }

  await ensureGenerationTasksTable();

  const res = await query(
    `UPDATE generation_tasks
     SET status = 'cancelled',
         completed_at = NOW(),
         updated_at = NOW()
     WHERE id = $1 AND user_id = $2 AND status IN ('queued', 'processing');`,
    [taskId, userId]
  );

  return (res.rowCount ?? 0) > 0;
}

/**
 * Housekeeping sweeper: marks all tasks that have exceeded their deadline plus a safety buffer as failed.
 * Condition strictly requires execution_deadline_at < NOW() - buffer.
 * A task within its legitimate execution window CANNOT be prematurely failed by cleanup.
 */
export async function cleanupStaleGenerationTasks(graceBufferSeconds: number = 5): Promise<number> {
  if (activeTestMockStore?.cleanupStaleGenerationTasks) {
    return activeTestMockStore.cleanupStaleGenerationTasks(graceBufferSeconds);
  }

  await ensureGenerationTasksTable();

  const res = await query(
    `UPDATE generation_tasks
     SET status = 'failed',
         error_message = 'The task exceeded its execution window and timed out.',
         error_category = 'timeout',
         is_retryable = true,
         completed_at = NOW(),
         updated_at = NOW()
     WHERE status IN ('queued', 'processing')
       AND execution_deadline_at IS NOT NULL
       AND execution_deadline_at < (NOW() - ($1 || ' seconds')::INTERVAL);`,
    [String(graceBufferSeconds)]
  );

  return res.rowCount ?? 0;
}

let savedSimulationsTableEnsured = false;

export async function ensureSavedSimulationsTable(): Promise<void> {
  if (savedSimulationsTableEnsured) return;
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS "saved_simulations" (
        "id" varchar(36) PRIMARY KEY NOT NULL,
        "user_id" varchar(36) NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "scenario_id" varchar(128) NOT NULL,
        "title" varchar(255) NOT NULL,
        "protocol" varchar(32) NOT NULL,
        "certification" varchar(32) NOT NULL,
        "difficulty" varchar(32) NOT NULL,
        "scenario_json" text NOT NULL,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL
      );
      CREATE INDEX IF NOT EXISTS "saved_simulations_user_id_idx" ON "saved_simulations" ("user_id");
      CREATE INDEX IF NOT EXISTS "saved_simulations_user_created_idx" ON "saved_simulations" ("user_id", "created_at");
      CREATE UNIQUE INDEX IF NOT EXISTS "saved_simulations_user_scenario_unique" ON "saved_simulations" ("user_id", "scenario_id");
    `);
    savedSimulationsTableEnsured = true;
  } catch (err: any) {
    console.error('[Saved Simulations DB Init Warning]:', err?.message);
  }
}

/**
 * Persists or updates an AI-generated protocol simulation scenario for a user.
 */
export async function saveCustomSimulation(
  userId: string,
  scenario: ProtocolSimulationScenario
): Promise<SavedSimulationRecord> {
  if (activeTestMockStore?.saveCustomSimulation) {
    return activeTestMockStore.saveCustomSimulation(userId, scenario);
  }

  await ensureSavedSimulationsTable();

  const id = crypto.randomUUID();
  const scenarioId = scenario.metadata.id || `sim-${id.slice(0, 8)}`;
  const title = (scenario.metadata.title || 'Custom Simulation').trim().slice(0, 255);
  const protocol = scenario.metadata.protocol || 'OSPF';
  const certification = scenario.metadata.certification || 'CCNA';
  const difficulty = scenario.metadata.difficulty || 'Intermediate';
  const scenarioJson = JSON.stringify(scenario);

  const res = await query<any>(
    `INSERT INTO saved_simulations
     (id, user_id, scenario_id, title, protocol, certification, difficulty, scenario_json, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
     ON CONFLICT ("user_id", "scenario_id")
     DO UPDATE SET
       title = EXCLUDED.title,
       protocol = EXCLUDED.protocol,
       certification = EXCLUDED.certification,
       difficulty = EXCLUDED.difficulty,
       scenario_json = EXCLUDED.scenario_json,
       updated_at = NOW()
     RETURNING
       id,
       user_id as "userId",
       scenario_id as "scenarioId",
       title,
       protocol,
       certification,
       difficulty,
       scenario_json as "scenarioJson",
       created_at as "createdAt",
       updated_at as "updatedAt";`,
    [id, userId, scenarioId, title, protocol, certification, difficulty, scenarioJson]
  );

  const row = res.rows[0];
  let parsedScenario: ProtocolSimulationScenario;
  try {
    parsedScenario = JSON.parse(row.scenarioJson);
  } catch {
    parsedScenario = scenario;
  }

  return {
    id: row.id,
    userId: row.userId,
    scenarioId: row.scenarioId,
    title: row.title,
    protocol: row.protocol,
    certification: row.certification,
    difficulty: row.difficulty,
    scenario: parsedScenario,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : new Date().toISOString(),
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : undefined,
  };
}

/**
 * Lists all saved simulations owned by a user, ordered by creation date descending.
 */
export async function listSavedSimulations(userId: string): Promise<SavedSimulationRecord[]> {
  if (activeTestMockStore?.listSavedSimulations) {
    return activeTestMockStore.listSavedSimulations(userId);
  }

  await ensureSavedSimulationsTable();

  const res = await query<any>(
    `SELECT
       id,
       user_id as "userId",
       scenario_id as "scenarioId",
       title,
       protocol,
       certification,
       difficulty,
       scenario_json as "scenarioJson",
       created_at as "createdAt",
       updated_at as "updatedAt"
     FROM saved_simulations
     WHERE user_id = $1
     ORDER BY created_at DESC;`,
    [userId]
  );

  return (res.rows || []).map((row) => {
    let parsedScenario: ProtocolSimulationScenario;
    try {
      parsedScenario = JSON.parse(row.scenarioJson);
    } catch {
      parsedScenario = {} as any;
    }

    return {
      id: row.id,
      userId: row.userId,
      scenarioId: row.scenarioId,
      title: row.title,
      protocol: row.protocol,
      certification: row.certification,
      difficulty: row.difficulty,
      scenario: parsedScenario,
      createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : new Date().toISOString(),
      updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : undefined,
    };
  });
}

/**
 * Fetches a single saved simulation by database UUID or scenario ID, with strict user isolation.
 */
export async function getSavedSimulationById(
  userId: string,
  scenarioOrDbId: string
): Promise<SavedSimulationRecord | null> {
  if (activeTestMockStore?.getSavedSimulationById) {
    return activeTestMockStore.getSavedSimulationById(userId, scenarioOrDbId);
  }

  await ensureSavedSimulationsTable();

  const res = await query<any>(
    `SELECT
       id,
       user_id as "userId",
       scenario_id as "scenarioId",
       title,
       protocol,
       certification,
       difficulty,
       scenario_json as "scenarioJson",
       created_at as "createdAt",
       updated_at as "updatedAt"
     FROM saved_simulations
     WHERE user_id = $1 AND (id = $2 OR scenario_id = $2)
     LIMIT 1;`,
    [userId, scenarioOrDbId]
  );

  if (!res.rows || res.rows.length === 0) return null;

  const row = res.rows[0];
  let parsedScenario: ProtocolSimulationScenario;
  try {
    parsedScenario = JSON.parse(row.scenarioJson);
  } catch {
    parsedScenario = {} as any;
  }

  return {
    id: row.id,
    userId: row.userId,
    scenarioId: row.scenarioId,
    title: row.title,
    protocol: row.protocol,
    certification: row.certification,
    difficulty: row.difficulty,
    scenario: parsedScenario,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : new Date().toISOString(),
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : undefined,
  };
}

/**
 * Deletes a saved simulation with strict user ownership enforcement.
 */
export async function deleteSavedSimulation(
  userId: string,
  scenarioOrDbId: string
): Promise<boolean> {
  if (activeTestMockStore?.deleteSavedSimulation) {
    return activeTestMockStore.deleteSavedSimulation(userId, scenarioOrDbId);
  }

  await ensureSavedSimulationsTable();

  const res = await query(
    `DELETE FROM saved_simulations
     WHERE user_id = $1 AND (id = $2 OR scenario_id = $2);`,
    [userId, scenarioOrDbId]
  );

  return (res.rowCount ?? 0) > 0;
}




