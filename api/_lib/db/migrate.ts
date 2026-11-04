import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';
const { Pool } = pg;
import path from 'path';
import { inspectConnectionConfig } from './client.js';

// Automatically load local environment files in development CLI tools
if (typeof process.loadEnvFile === 'function') {
  try { process.loadEnvFile('.env.local'); } catch {}
  try { process.loadEnvFile('.env'); } catch {}
}

/**
 * 64-bit PostgreSQL Advisory Lock ID for NetMentor migrations.
 * Derived from deterministic hash of 'netmentor_drizzle_migration_lock'.
 * Ensures concurrent deployment runs cannot execute conflicting migrations.
 */
export const NETMENTOR_MIGRATION_ADVISORY_LOCK_ID = '847291048201';

export interface MigrationEnvironmentGateResult {
  shouldRun: boolean;
  reason: 'production_deployment' | 'preview_deployment' | 'local_development' | 'local_build' | 'explicit_override';
  message: string;
}

export interface MigrationUrlResolutionResult {
  url?: string;
  source: 'POSTGRES_URL_NON_POOLING' | 'DATABASE_URL_UNPOOLED' | 'direct_url' | 'derived_neon_direct' | 'none';
  error?: string;
}

/**
 * Sanitizes connection strings and credentials from logs and error messages.
 */
export function redactConnectionString(input: string): string {
  if (!input || typeof input !== 'string') return '';
  return input
    .replace(/(postgres(?:ql)?:\/\/[^:]+:)([^@]+)(@)/gi, '$1[REDACTED]$3')
    .replace(/(password=)[^&;\s]+/gi, '$1[REDACTED]')
    .replace(/(key=)[^&;\s]+/gi, '$1[REDACTED]')
    .replace(/(bearer\s+)[a-zA-Z0-9_\-\.]{8,}/gi, '$1[REDACTED]');
}

/**
 * Strict regex for verifying and parsing Neon pooled hostnames:
 * Captures endpoint ID in group 1, and the domain suffix (.neon.tech, with optional cell/region segments) in group 2.
 * Examples matched:
 * - ep-polished-brook-b4wbw45g-pooler.c-6.us-east-2.aws.neon.tech
 * - ep-cold-pond-12345-pooler.us-east-2.aws.neon.tech
 * - ep-test-pooler.neon.tech
 */
export const NEON_POOLED_HOST_REGEX = /^([a-z0-9_-]+)-pooler((?:\.[a-z0-9-]+)*\.neon\.tech)$/i;

/**
 * Checks whether a hostname belongs to a known Neon pooler endpoint.
 */
export function isKnownNeonPoolerHost(hostname: string): boolean {
  if (!hostname || typeof hostname !== 'string') return false;
  return NEON_POOLED_HOST_REGEX.test(hostname.trim());
}

/**
 * Safely derives an unpooled direct compute endpoint from a verified Neon pooled URL.
 * Only transforms hostnames that strictly match the official Neon domain pattern (*-pooler.*.neon.tech).
 * Never transforms arbitrary hostnames.
 */
export function deriveNeonDirectUrl(pooledUrl: string): { directUrl?: string; error?: string } {
  try {
    const parsed = new URL(pooledUrl);
    const host = parsed.hostname.trim();

    // Strict Neon pattern: e.g. ep-polished-brook-b4wbw45g-pooler.c-6.us-east-2.aws.neon.tech or ep-cold-123-pooler.neon.tech
    const neonMatch = host.match(NEON_POOLED_HOST_REGEX);
    if (!neonMatch) {
      return {
        error: `Cannot derive direct compute endpoint: hostname "${redactConnectionString(parsed.hostname)}" does not match verified Neon endpoint syntax.`,
      };
    }

    parsed.hostname = `${neonMatch[1]}${neonMatch[2]}`;
    return { directUrl: parsed.toString() };
  } catch (err: any) {
    return { error: `Invalid connection URL: ${redactConnectionString(err?.message)}` };
  }
}

/**
 * Resolves the direct, unpooled database URL required for migration execution and advisory locking.
 *
 * Priority:
 * 1. env.POSTGRES_URL_NON_POOLING (Standard Neon direct unpooled connection)
 * 2. env.DATABASE_URL_UNPOOLED (Explicit direct unpooled override)
 * 3. env.DATABASE_URL or env.POSTGRES_URL:
 *    - If already direct/unpooled: used directly.
 *    - If known Neon pooler (*-pooler.*.neon.tech): safely resolves verified direct compute endpoint unless rejected.
 *    - If arbitrary pooler or unverifiable: FAILS CLOSED with sanitized error.
 */
export function resolveMigrationDatabaseUrl(
  env: Record<string, string | undefined> = process.env,
  options: { allowNeonDerivation?: boolean } = {}
): MigrationUrlResolutionResult {
  const allowDerivation = options.allowNeonDerivation ?? (env.NEON_REJECT_POOLED_URL !== 'true');

  // 1. First priority: POSTGRES_URL_NON_POOLING
  const nonPooling = env.POSTGRES_URL_NON_POOLING?.trim();
  if (nonPooling && !nonPooling.includes('[SENSITIVE]')) {
    try {
      const parsed = new URL(nonPooling);
      if (isKnownNeonPoolerHost(parsed.hostname)) {
        return {
          source: 'none',
          error: `Configuration Error: POSTGRES_URL_NON_POOLING contains a pooler endpoint (${redactConnectionString(parsed.hostname)}). Migrations require a direct compute connection.`,
        };
      }
      return { url: nonPooling, source: 'POSTGRES_URL_NON_POOLING' };
    } catch {
      return { url: nonPooling, source: 'POSTGRES_URL_NON_POOLING' };
    }
  }

  // 2. Second priority: DATABASE_URL_UNPOOLED
  const unpooledOverride = env.DATABASE_URL_UNPOOLED?.trim();
  if (unpooledOverride && !unpooledOverride.includes('[SENSITIVE]')) {
    try {
      const parsed = new URL(unpooledOverride);
      if (isKnownNeonPoolerHost(parsed.hostname)) {
        return {
          source: 'none',
          error: `Configuration Error: DATABASE_URL_UNPOOLED contains a pooler endpoint (${redactConnectionString(parsed.hostname)}). Migrations require a direct compute connection.`,
        };
      }
      return { url: unpooledOverride, source: 'DATABASE_URL_UNPOOLED' };
    } catch {
      return { url: unpooledOverride, source: 'DATABASE_URL_UNPOOLED' };
    }
  }

  // 3. Fallback candidates: DATABASE_URL or POSTGRES_URL
  const fallback = env.DATABASE_URL?.trim() || env.POSTGRES_URL?.trim();
  if (!fallback || fallback.includes('[SENSITIVE]')) {
    return {
      source: 'none',
      error: 'ERROR: Direct database connection URL (POSTGRES_URL_NON_POOLING, DATABASE_URL_UNPOOLED, or direct compute DATABASE_URL) is required to run migrations.',
    };
  }

  try {
    const parsed = new URL(fallback);
    const host = parsed.hostname;

    // Check if hostname indicates pooling
    const isNeon = host.toLowerCase().endsWith('.neon.tech');
    const isPooler = isKnownNeonPoolerHost(host) || host.toLowerCase().includes('-pooler');

    if (!isPooler) {
      // Direct compute endpoint or non-pooler connection
      return { url: fallback, source: 'direct_url' };
    }

    if (!isNeon) {
      // Arbitrary/non-Neon pooler: DO NOT blindly transform
      return {
        source: 'none',
        error: `Cannot execute migrations: The provided connection URL points to an unverified pooler (${redactConnectionString(host)}). Session-level advisory locks and DDL require a direct compute connection. Please configure POSTGRES_URL_NON_POOLING or DATABASE_URL_UNPOOLED.`,
      };
    }

    // Known Neon pooler: check if rejection requested or safe derivation allowed
    if (!allowDerivation) {
      return {
        source: 'none',
        error: `Cannot execute migrations: Detected pooled Neon connection (${redactConnectionString(host)}). Session-level advisory locks cannot be held across PgBouncer transaction pooling. Please configure POSTGRES_URL_NON_POOLING or DATABASE_URL_UNPOOLED.`,
      };
    }

    const derived = deriveNeonDirectUrl(fallback);
    if (!derived.directUrl || derived.error) {
      return {
        source: 'none',
        error: `Cannot execute migrations: Failed to safely derive direct compute endpoint from Neon pooler URL: ${derived.error}`,
      };
    }

    return { url: derived.directUrl, source: 'derived_neon_direct' };
  } catch (err: any) {
    return {
      source: 'none',
      error: `Invalid database connection URL: ${redactConnectionString(err?.message)}`,
    };
  }
}

/**
 * Returns the resolved migration database URL, or undefined if resolution failed.
 */
export function getMigrationDatabaseUrl(env: Record<string, string | undefined> = process.env): string | undefined {
  const res = resolveMigrationDatabaseUrl(env);
  return res.url;
}

/**
 * Evaluates whether migrations should execute based on deployment environment flags.
 *
 * Rules:
 * - VERCEL_ENV === 'preview': STRICTLY SKIPPED (protects production database from preview branches).
 * - VERCEL_ENV === 'development': STRICTLY SKIPPED.
 * - VERCEL_ENV === 'production': EXECUTED (applies pending migrations before application build).
 * - VERCEL_ENV unset & RUN_MIGRATIONS === 'true' / FORCE_MIGRATE === 'true': EXECUTED (explicit opt-in).
 * - VERCEL_ENV unset (local build / dev): SKIPPED (prevents automatic DDL during local 'npm run build').
 */
export function evaluateEnvironmentGate(
  env: Record<string, string | undefined> = process.env
): MigrationEnvironmentGateResult {
  // 1. Explicit override flag (used by manual CI triggers or testing)
  if (env.FORCE_MIGRATE === 'true' || env.RUN_MIGRATIONS === 'true') {
    return {
      shouldRun: true,
      reason: 'explicit_override',
      message: 'Explicit migration execution requested (RUN_MIGRATIONS=true / FORCE_MIGRATE=true).',
    };
  }

  // 2. Vercel Preview deployment guard
  if (env.VERCEL_ENV === 'preview') {
    return {
      shouldRun: false,
      reason: 'preview_deployment',
      message: 'Vercel preview environment detected (VERCEL_ENV=preview). Skipping database migrations to prevent modifying production schema.',
    };
  }

  // 3. Vercel Development environment guard
  if (env.VERCEL_ENV === 'development') {
    return {
      shouldRun: false,
      reason: 'local_development',
      message: 'Vercel local development environment detected (VERCEL_ENV=development). Skipping automatic migrations.',
    };
  }

  // 4. Actual Vercel Production deployment build
  // In Vercel build containers, VERCEL='1', VERCEL_ENV='production', and CI='1' are set by the platform.
  // In local environments (even if .env.local was created by `vercel env pull`), CI is not '1'.
  // This guarantees local 'npm run build' never touches the database.
  if (env.VERCEL === '1' && env.VERCEL_ENV === 'production' && env.CI === '1') {
    return {
      shouldRun: true,
      reason: 'production_deployment',
      message: 'Vercel production build container verified (VERCEL=1, VERCEL_ENV=production, CI=1). Executing versioned migrations.',
    };
  }

  // 5. Default local developer environment
  return {
    shouldRun: false,
    reason: 'local_build',
    message: 'Local build environment detected (VERCEL is not "1"). Skipping automatic database migrations. Use "npm run db:migrate" to apply migrations manually.',
  };
}

/**
 * Acquires a PostgreSQL session-level advisory lock with bounded retry polling.
 * Prevents race conditions when concurrent deployments trigger migrations simultaneously.
 */
export async function acquireAdvisoryLock(
  client: pg.PoolClient | { query: (sql: string, params?: any[]) => Promise<any> },
  lockId = NETMENTOR_MIGRATION_ADVISORY_LOCK_ID,
  maxWaitMs = 30000,
  pollIntervalMs = 2000
): Promise<boolean> {
  const startTime = Date.now();

  while (Date.now() - startTime <= maxWaitMs) {
    try {
      const res = await client.query('SELECT pg_try_advisory_lock($1) as acquired;', [lockId]);
      const acquired = Boolean(res.rows[0]?.acquired);
      if (acquired) {
        return true;
      }
    } catch (err: any) {
      console.warn(`[Migration Lock Warning]: Failed to test advisory lock: ${redactConnectionString(err?.message)}`);
    }

    const elapsed = Date.now() - startTime;
    if (elapsed + pollIntervalMs > maxWaitMs) {
      break;
    }

    console.log(
      `[Migration Lock]: Another deployment process currently holds the migration lock. Waiting for release (${Math.round(elapsed / 1000)}s / ${Math.round(maxWaitMs / 1000)}s)...`
    );
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  return false;
}

/**
 * Releases the PostgreSQL session-level advisory lock.
 */
export async function releaseAdvisoryLock(
  client: pg.PoolClient | { query: (sql: string, params?: any[]) => Promise<any> },
  lockId = NETMENTOR_MIGRATION_ADVISORY_LOCK_ID
): Promise<boolean> {
  try {
    const res = await client.query('SELECT pg_advisory_unlock($1) as released;', [lockId]);
    return Boolean(res.rows[0]?.released);
  } catch (err: any) {
    console.warn(`[Migration Lock Warning]: Failed to release advisory lock: ${redactConnectionString(err?.message)}`);
    return false;
  }
}

export interface MigrationRunnerOptions {
  databaseUrl?: string;
  migrationsFolder?: string;
  lockTimeoutMs?: number;
  pollIntervalMs?: number;
  skipLock?: boolean;
  poolFactory?: (config: any) => any;
  executeMigrate?: (db: any, options: { migrationsFolder: string }) => Promise<void>;
}

export interface MigrationRunnerResult {
  success: boolean;
  durationMs: number;
  error?: string;
}

/**
 * Runs Drizzle database migrations against the configured Neon PostgreSQL database.
 * Targets the 'public' schema explicitly, holds concurrency advisory locks, and preserves existing data.
 */
export async function runMigrations(options: MigrationRunnerOptions = {}): Promise<MigrationRunnerResult> {
  const startTime = Date.now();
  let databaseUrl = options.databaseUrl;
  if (databaseUrl === undefined) {
    const resolution = resolveMigrationDatabaseUrl(process.env);
    if (!resolution.url) {
      const errorMsg = resolution.error || 'ERROR: Direct database connection URL is required to run migrations.';
      console.error(`[Migration Connection Error]: ${errorMsg}`);
      return { success: false, durationMs: Date.now() - startTime, error: errorMsg };
    }
    databaseUrl = resolution.url;
  }

  if (!databaseUrl || databaseUrl.trim().length === 0) {
    const errorMsg = 'ERROR: Direct database connection URL (POSTGRES_URL_NON_POOLING, DATABASE_URL_UNPOOLED, or direct compute DATABASE_URL) is required to run migrations.';
    console.error(`[Migration Connection Error]: ${errorMsg}`);
    return { success: false, durationMs: Date.now() - startTime, error: errorMsg };
  }

  const config = inspectConnectionConfig(databaseUrl);
  console.log(`[Migration]: Connecting to Neon PostgreSQL via pg driver (Connection type: ${config.connectionType})...`);

  // Migrations run from an isolated single connection pool with bounded timeout
  const pool = options.poolFactory
    ? options.poolFactory(config)
    : new Pool({
        connectionString: databaseUrl,
        max: 1,
        connectionTimeoutMillis: 15000,
        ssl: config.ssl,
      });

  pool.on('error', (err: any) => {
    console.error('[Migration Pool Error]:', redactConnectionString(err?.message));
  });

  let client: pg.PoolClient | null = null;
  let lockAcquired = false;

  try {
    client = await pool.connect();
    if (!client) {
      throw new Error('Could not establish database connection client.');
    }

    // 1. Concurrency Protection via PostgreSQL Advisory Lock
    if (!options.skipLock) {
      const lockTimeout = options.lockTimeoutMs ?? 30000;
      const pollInterval = options.pollIntervalMs ?? 2000;
      lockAcquired = await acquireAdvisoryLock(client, NETMENTOR_MIGRATION_ADVISORY_LOCK_ID, lockTimeout, pollInterval);

      if (!lockAcquired) {
        const lockError = `Aborting migration: Could not acquire PostgreSQL advisory lock within ${lockTimeout / 1000}s. Another deployment is currently executing migrations.`;
        console.error(`[Migration Concurrency Error]: ${lockError}`);
        return { success: false, durationMs: Date.now() - startTime, error: lockError };
      }
      console.log('[Migration Lock]: Successfully acquired migration advisory lock.');
    }

    // 2. Drizzle Migrator Execution
    const db = drizzle(client as any);
    const migrationsFolder = options.migrationsFolder || path.resolve(process.cwd(), 'drizzle');
    console.log(`[Migration]: Applying versioned migrations from: ${migrationsFolder}`);

    if (options.executeMigrate) {
      await options.executeMigrate(db, { migrationsFolder });
    } else {
      await migrate(db, { migrationsFolder });
    }
    console.log('✓ All migrations applied successfully to Neon PostgreSQL (public schema)!');

    return {
      success: true,
      durationMs: Date.now() - startTime,
    };
  } catch (err: any) {
    const safeError = redactConnectionString(err?.message || String(err));
    console.error(`[Migration Failed]: ${safeError}`);
    return {
      success: false,
      durationMs: Date.now() - startTime,
      error: safeError,
    };
  } finally {
    // 3. Guaranteed Lock Release & Connection Cleanup
    if (client && lockAcquired) {
      try {
        await releaseAdvisoryLock(client, NETMENTOR_MIGRATION_ADVISORY_LOCK_ID);
        console.log('[Migration Lock]: Released migration advisory lock.');
      } catch (err: any) {
        console.warn(`[Migration Lock Warning]: Error releasing advisory lock: ${redactConnectionString(err?.message)}`);
      }
    }
    if (client) {
      try {
        client.release();
      } catch {}
    }
    await pool.end();
  }
}

// When invoked directly via CLI (e.g. npm run db:migrate)
const entryFile = process.argv[1] ? path.basename(process.argv[1]) : '';
if (entryFile === 'migrate.ts' || entryFile === 'migrate.js') {
  runMigrations().then((res) => {
    if (!res.success) {
      process.exit(1);
    }
    process.exit(0);
  });
}
