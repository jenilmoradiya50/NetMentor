/**
 * NetMentor Migration Runner & Production Automation Test Suite
 *
 * Verifies:
 * 1. Environment Gating: Preview deployments and local builds are strictly prevented from running migrations.
 * 2. Production Execution: VERCEL_ENV=production or explicit opt-in enables migration runner.
 * 3. Concurrency Protection: PostgreSQL advisory locks prevent parallel/conflicting migration executions.
 * 4. Lock Contention & Retry: Contended locks wait and retry or timeout safely.
 * 5. Secret Redaction: Connection strings, passwords, and tokens are scrubbed from logs.
 * 6. Error & Failure Handling: DDL failures fail closed with exit code 1 to halt deployments.
 * 7. Idempotency & No-Op: Repeated executions against migrated schemas complete safely with 0 errors.
 */

import {
  NETMENTOR_MIGRATION_ADVISORY_LOCK_ID,
  evaluateEnvironmentGate,
  acquireAdvisoryLock,
  releaseAdvisoryLock,
  redactConnectionString,
  runMigrations,
  resolveMigrationDatabaseUrl,
  getMigrationDatabaseUrl,
  isKnownNeonPoolerHost,
  deriveNeonDirectUrl,
  NEON_POOLED_HOST_REGEX,
} from '../api/_lib/db/migrate.js';
import { getDatabaseUrl } from '../api/_lib/db/client.js';
import { PGlite } from '@electric-sql/pglite';
import { spawnSync } from 'child_process';
import path from 'path';

let testPassed = 0;
let testFailed = 0;

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`  FAIL: ${msg}`);
    testFailed++;
    throw new Error(`Assertion failed: ${msg}`);
  } else {
    testPassed++;
    console.log(`  PASS: ${msg}`);
  }
}

async function runAllSuites() {
  console.log('\n============================================================');
  console.log('NETMENTOR MIGRATION AUTOMATION TEST SUITE');
  console.log('============================================================\n');

  // --- SUITE 1: Environment Gating & Deployment Isolation ---
  console.log('--- SUITE 1: Environment Gating & Deployment Isolation ---');
  {
    // Case 1: Vercel Preview Deployment
    const previewGate = evaluateEnvironmentGate({ VERCEL_ENV: 'preview' });
    assert(previewGate.shouldRun === false, 'Case 1: VERCEL_ENV=preview strictly blocks migrations');
    assert(previewGate.reason === 'preview_deployment', 'Case 1: Identified as preview_deployment');
    assert(previewGate.message.includes('preview'), 'Case 1: Log message explains preview suppression');

    // Case 2: Vercel Development Environment
    const devGate = evaluateEnvironmentGate({ VERCEL_ENV: 'development' });
    assert(devGate.shouldRun === false, 'Case 2: VERCEL_ENV=development strictly blocks migrations');
    assert(devGate.reason === 'local_development', 'Case 2: Identified as local_development');

    // Case 3: Local Developer Build (VERCEL_ENV unset)
    const localGate = evaluateEnvironmentGate({});
    assert(localGate.shouldRun === false, 'Case 3: Local developer build without VERCEL_ENV blocks migrations');
    assert(localGate.reason === 'local_build', 'Case 3: Identified as local_build');

    // Case 4a: Local machine with .env.local having VERCEL_ENV=production but VERCEL unset
    const localWithEnvGate = evaluateEnvironmentGate({ VERCEL_ENV: 'production' });
    assert(localWithEnvGate.shouldRun === false, 'Case 4a: Local environment with VERCEL_ENV=production but VERCEL unset blocks migrations');
    assert(localWithEnvGate.reason === 'local_build', 'Case 4a: Identified as local_build');

    // Case 4b: Genuine Vercel Production Build Container (VERCEL=1, VERCEL_ENV=production, CI=1)
    const prodGate = evaluateEnvironmentGate({ VERCEL: '1', VERCEL_ENV: 'production', CI: '1' });
    assert(prodGate.shouldRun === true, 'Case 4b: VERCEL=1, VERCEL_ENV=production, CI=1 permits migration execution');
    assert(prodGate.reason === 'production_deployment', 'Case 4b: Identified as production_deployment');

    // Case 5: Explicit RUN_MIGRATIONS Override
    const runMigGate = evaluateEnvironmentGate({ RUN_MIGRATIONS: 'true' });
    assert(runMigGate.shouldRun === true, 'Case 5: RUN_MIGRATIONS=true permits migration execution');
    assert(runMigGate.reason === 'explicit_override', 'Case 5: Identified as explicit_override');

    // Case 6: Explicit FORCE_MIGRATE Override
    const forceMigGate = evaluateEnvironmentGate({ FORCE_MIGRATE: 'true' });
    assert(forceMigGate.shouldRun === true, 'Case 6: FORCE_MIGRATE=true permits migration execution');
    assert(forceMigGate.reason === 'explicit_override', 'Case 6: Identified as explicit_override');
  }

  // --- SUITE 2: Concurrency Advisory Locking Mechanics ---
  console.log('\n--- SUITE 2: Concurrency Advisory Locking Mechanics ---');
  {
    assert(
      NETMENTOR_MIGRATION_ADVISORY_LOCK_ID === '847291048201',
      'Lock ID is configured to 64-bit deterministic key 847291048201'
    );

    // Mock client simulating PostgreSQL advisory lock state
    let isLocked = false;
    const mockClient = {
      query: async (sql: string, params?: any[]) => {
        if (sql.includes('pg_try_advisory_lock')) {
          const requestedKey = params?.[0];
          if (requestedKey === NETMENTOR_MIGRATION_ADVISORY_LOCK_ID) {
            if (isLocked) {
              return { rows: [{ acquired: false }] };
            }
            isLocked = true;
            return { rows: [{ acquired: true }] };
          }
        }
        if (sql.includes('pg_advisory_unlock')) {
          const requestedKey = params?.[0];
          if (requestedKey === NETMENTOR_MIGRATION_ADVISORY_LOCK_ID) {
            isLocked = false;
            return { rows: [{ released: true }] };
          }
        }
        return { rows: [] };
      },
    };

    // Case 7: Initial Lock Acquisition
    const firstAcquire = await acquireAdvisoryLock(mockClient, NETMENTOR_MIGRATION_ADVISORY_LOCK_ID, 1000, 100);
    assert(firstAcquire === true, 'Case 7: Successfully acquired unheld advisory lock');
    assert(isLocked === true, 'Case 7: Mock client reflects locked state');

    // Case 8: Concurrent Process Lock Contention
    const secondAcquire = await acquireAdvisoryLock(mockClient, NETMENTOR_MIGRATION_ADVISORY_LOCK_ID, 200, 50);
    assert(secondAcquire === false, 'Case 8: Concurrent acquisition attempt returns false while lock is held');

    // Case 9: Lock Release
    const releaseSuccess = await releaseAdvisoryLock(mockClient, NETMENTOR_MIGRATION_ADVISORY_LOCK_ID);
    assert(releaseSuccess === true, 'Case 9: Advisory lock successfully released');
    assert(isLocked === false, 'Case 9: Mock client reflects unlocked state');

    // Case 10: Re-acquisition after release
    const reAcquire = await acquireAdvisoryLock(mockClient, NETMENTOR_MIGRATION_ADVISORY_LOCK_ID, 1000, 100);
    assert(reAcquire === true, 'Case 10: Process successfully re-acquires lock after release');
    await releaseAdvisoryLock(mockClient, NETMENTOR_MIGRATION_ADVISORY_LOCK_ID);
  }

  // --- SUITE 3: Credential & Secret Redaction ---
  console.log('\n--- SUITE 3: Credential & Secret Redaction ---');
  {
    // Case 11: Redacting standard postgres URI credentials
    const rawPostgresUrl = 'postgresql://neondb_owner:npg_xY9Zabc789Secret@ep-ancient-hill-12345-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require';
    const redactedUrl = redactConnectionString(rawPostgresUrl);
    assert(!redactedUrl.includes('npg_xY9Zabc789Secret'), 'Case 11: Neon password scrubbed from connection string');
    assert(redactedUrl.includes('neondb_owner:[REDACTED]@'), 'Case 11: Replaced password with [REDACTED]');

    // Case 12: Redacting explicit password query parameter
    const queryParamUrl = 'postgres://user@host.com/db?password=superSecret123&ssl=true';
    const redactedParam = redactConnectionString(queryParamUrl);
    assert(!redactedParam.includes('superSecret123'), 'Case 12: password query parameter scrubbed');
    assert(redactedParam.includes('password=[REDACTED]'), 'Case 12: Replaced with password=[REDACTED]');

    // Case 13: Redacting Bearer authorization headers
    const bearerHeader = 'Error: upstream request failed with Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.token123';
    const redactedBearer = redactConnectionString(bearerHeader);
    assert(!redactedBearer.includes('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'), 'Case 13: Bearer JWT token scrubbed');
    assert(redactedBearer.includes('Bearer [REDACTED]'), 'Case 13: Replaced with Bearer [REDACTED]');
  }

  // --- SUITE 4: Runner Error Handling & Missing Environment Behavior ---
  console.log('\n--- SUITE 4: Runner Error Handling & Missing Environment Behavior ---');
  {
    // Case 14: Missing database connection string fails closed cleanly
    const missingDbResult = await runMigrations({ databaseUrl: '' });
    assert(missingDbResult.success === false, 'Case 14: Missing DATABASE_URL returns success=false');
    assert(missingDbResult.error?.includes('DATABASE_URL'), 'Case 14: Clear error indicates missing connection string');

    // Case 15: Concurrency lock acquisition failure fails closed cleanly
    // Pass a lockId that is locked by mock client
    let heldLock = true;
    const lockedClient = {
      query: async (sql: string) => {
        if (sql.includes('pg_try_advisory_lock')) return { rows: [{ acquired: !heldLock }] };
        if (sql.includes('pg_advisory_unlock')) return { rows: [{ released: true }] };
        return { rows: [] };
      },
    };
    const lockTest = await acquireAdvisoryLock(lockedClient, '847291048201', 200, 50);
    assert(lockTest === false, 'Case 15: Concurrency lock detection prevents parallel execution');

    // Mock Pool Factory for isolated runner testing
    const createMockPool = () => {
      const mockClient = {
        query: async (sql: string) => {
          if (sql.includes('pg_try_advisory_lock')) return { rows: [{ acquired: true }] };
          if (sql.includes('pg_advisory_unlock')) return { rows: [{ released: true }] };
          return { rows: [] };
        },
        release: () => {},
      };
      return {
        connect: async () => mockClient,
        on: () => {},
        end: async () => {},
      };
    };

    // Case 16: DDL error during migration fails closed and propagates error
    const ddlErrorResult = await runMigrations({
      databaseUrl: 'postgresql://mock_user:mock_pass@dummy.neon.tech/neondb?sslmode=require',
      skipLock: true,
      poolFactory: () => createMockPool(),
      executeMigrate: async () => {
        throw new Error('syntax error at or near "CRASH"');
      },
    });
    assert(ddlErrorResult.success === false, 'Case 16: DDL execution failure fails closed (success=false)');
    assert(ddlErrorResult.error?.includes('syntax error'), 'Case 16: Failure message captured');

    // Case 17: Successful / No-op migration execution
    const noopResult = await runMigrations({
      databaseUrl: 'postgresql://mock_user:mock_pass@dummy.neon.tech/neondb?sslmode=require',
      skipLock: true,
      poolFactory: () => createMockPool(),
      executeMigrate: async () => {
        // Simulates Drizzle checking __drizzle_migrations and finding 0 pending migrations
      },
    });
    assert(noopResult.success === true, 'Case 17: No-op / up-to-date schema returns success=true');
  }

  // --- SUITE 5: Prebuild Script Child Process Integration ---
  console.log('\n--- SUITE 5: Prebuild Script Child Process Integration ---');
  {
    const scriptPath = path.resolve(process.cwd(), 'scripts', 'prebuild-migrate.ts');

    // Case 16: Child process in local development (VERCEL unset) exits with code 0 (Skip)
    const localRun = spawnSync('node', ['node_modules/tsx/dist/cli.mjs', scriptPath], {
      env: { ...process.env, VERCEL: '', VERCEL_ENV: '', RUN_MIGRATIONS: '', FORCE_MIGRATE: '' },
      encoding: 'utf8',
    });
    assert(localRun.status === 0, 'Case 16: Local prebuild exits with code 0');
    assert(localRun.stdout.includes('Local build environment detected'), 'Case 16: Local prebuild logs skip reason');

    // Case 17: Child process in Vercel preview (VERCEL_ENV=preview) exits with code 0 (Skip)
    const previewRun = spawnSync('node', ['node_modules/tsx/dist/cli.mjs', scriptPath], {
      env: { ...process.env, VERCEL_ENV: 'preview', RUN_MIGRATIONS: '', FORCE_MIGRATE: '' },
      encoding: 'utf8',
    });
    assert(previewRun.status === 0, 'Case 17: Preview prebuild exits with code 0');
    assert(previewRun.stdout.includes('Vercel preview environment detected'), 'Case 17: Preview prebuild logs skip reason');

    // Case 18: Child process in Vercel development (VERCEL_ENV=development) exits with code 0 (Skip)
    const devRun = spawnSync('node', ['node_modules/tsx/dist/cli.mjs', scriptPath], {
      env: { ...process.env, VERCEL_ENV: 'development', RUN_MIGRATIONS: '', FORCE_MIGRATE: '' },
      encoding: 'utf8',
    });
    assert(devRun.status === 0, 'Case 18: Development prebuild exits with code 0');
    assert(devRun.stdout.includes('Vercel local development environment detected'), 'Case 18: Dev prebuild logs skip reason');
  }

  // --- SUITE 6: Migration Connection Resolution & Direct Compute Priority ---
  console.log('\n--- SUITE 6: Migration Connection Resolution & Direct Compute Priority ---');
  {
    // Case 19: POSTGRES_URL_NON_POOLING takes highest priority over DATABASE_URL
    const nonPoolingRes = resolveMigrationDatabaseUrl({
      POSTGRES_URL_NON_POOLING: 'postgresql://owner:pass@ep-ancient-123.us-east-2.aws.neon.tech/neondb?sslmode=require',
      DATABASE_URL: 'postgresql://owner:pass@ep-ancient-123-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require',
      POSTGRES_URL: 'postgresql://owner:pass@ep-ancient-123-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require',
    });
    assert(nonPoolingRes.source === 'POSTGRES_URL_NON_POOLING', 'Case 19: Prefers POSTGRES_URL_NON_POOLING over pooled DATABASE_URL');
    assert(!nonPoolingRes.url?.includes('-pooler'), 'Case 19: Resolved non-pooling URL has no -pooler suffix');

    // Case 20: DATABASE_URL_UNPOOLED explicit override
    const unpooledRes = resolveMigrationDatabaseUrl({
      DATABASE_URL_UNPOOLED: 'postgresql://owner:pass@ep-unpooled-999.us-east-2.aws.neon.tech/neondb',
      DATABASE_URL: 'postgresql://owner:pass@ep-pooler-999-pooler.us-east-2.aws.neon.tech/neondb',
    });
    assert(unpooledRes.source === 'DATABASE_URL_UNPOOLED', 'Case 20: Prefers DATABASE_URL_UNPOOLED over DATABASE_URL');
    assert(unpooledRes.url?.includes('ep-unpooled-999'), 'Case 20: Resolved unpooled override URL correctly');

    // Case 20b: Explicit direct variable precedence with modern cell subdomains
    const nonPoolingCellRes = resolveMigrationDatabaseUrl({
      POSTGRES_URL_NON_POOLING: 'postgresql://owner:pass@ep-direct-compute.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require',
      DATABASE_URL: 'postgresql://owner:pass@ep-polished-brook-b4wbw45g-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require',
    });
    assert(nonPoolingCellRes.source === 'POSTGRES_URL_NON_POOLING', 'Case 20b-1: Prefers POSTGRES_URL_NON_POOLING over pooled cell DATABASE_URL');
    assert(nonPoolingCellRes.url?.includes('ep-direct-compute'), 'Case 20b-1: Uses direct URL from POSTGRES_URL_NON_POOLING');

    const unpooledCellRes = resolveMigrationDatabaseUrl({
      DATABASE_URL_UNPOOLED: 'postgresql://owner:pass@ep-explicit-direct.c-6.us-east-2.aws.neon.tech/neondb',
      DATABASE_URL: 'postgresql://owner:pass@ep-polished-brook-b4wbw45g-pooler.c-6.us-east-2.aws.neon.tech/neondb',
    });
    assert(unpooledCellRes.source === 'DATABASE_URL_UNPOOLED', 'Case 20b-2: Prefers DATABASE_URL_UNPOOLED over pooled cell DATABASE_URL');

    // Case 20c: Accidental pooler in direct variables fails closed
    const badNonPoolingRes = resolveMigrationDatabaseUrl({
      POSTGRES_URL_NON_POOLING: 'postgresql://owner:pass@ep-bad-pooler.c-6.us-east-2.aws.neon.tech/neondb',
    });
    assert(badNonPoolingRes.source === 'none', 'Case 20c-1: Rejects pooled endpoint in POSTGRES_URL_NON_POOLING');
    assert(badNonPoolingRes.error?.includes('contains a pooler endpoint'), 'Case 20c-1: Clear error message on pooled POSTGRES_URL_NON_POOLING');

    const badUnpooledRes = resolveMigrationDatabaseUrl({
      DATABASE_URL_UNPOOLED: 'postgresql://owner:pass@ep-bad-pooler.c-6.us-east-2.aws.neon.tech/neondb',
    });
    assert(badUnpooledRes.source === 'none', 'Case 20c-2: Rejects pooled endpoint in DATABASE_URL_UNPOOLED');
    assert(badUnpooledRes.error?.includes('contains a pooler endpoint'), 'Case 20c-2: Clear error message on pooled DATABASE_URL_UNPOOLED');

    // Case 21: Safe resolution of verified Neon pooled URL (legacy format)
    const derivedRes = resolveMigrationDatabaseUrl({
      DATABASE_URL: 'postgresql://owner:pass@ep-cold-pond-12345-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require',
    });
    assert(derivedRes.source === 'derived_neon_direct', 'Case 21: Safely derives direct compute URL from verified Neon pooler');
    assert(derivedRes.url?.includes('ep-cold-pond-12345.us-east-2.aws.neon.tech'), 'Case 21: Derived host stripped -pooler correctly');
    assert(!derivedRes.url?.includes('-pooler'), 'Case 21: Derived URL is strictly unpooled');

    // Case 21a: Modern Neon AWS cell subdomain resolution (e.g. .c-6.us-east-2.aws.neon.tech)
    const cellDerivedRes = resolveMigrationDatabaseUrl({
      DATABASE_URL: 'postgresql://owner:pass@ep-polished-brook-b4wbw45g-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require',
    });
    assert(cellDerivedRes.source === 'derived_neon_direct', 'Case 21a: Safely derives direct URL from modern cell pooler');
    assert(
      cellDerivedRes.url === 'postgresql://owner:pass@ep-polished-brook-b4wbw45g.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require',
      'Case 21a: Exact direct compute endpoint matches production without -pooler'
    );
    assert(cellDerivedRes.url?.includes('?sslmode=require'), 'Case 21a: Preserves URL search params and configuration');

    // Case 21b: Other multi-segment Neon formats
    const multiSegmentRes1 = resolveMigrationDatabaseUrl({
      DATABASE_URL: 'postgresql://owner:pass@ep-cell-99-pooler.c-99.eu-central-1.aws.neon.tech/neondb',
    });
    assert(multiSegmentRes1.source === 'derived_neon_direct', 'Case 21b-1: Derives multi-segment cell in eu-central-1');
    assert(multiSegmentRes1.url?.includes('ep-cell-99.c-99.eu-central-1.aws.neon.tech'), 'Case 21b-1: Stripped -pooler correctly');

    const multiSegmentRes2 = resolveMigrationDatabaseUrl({
      DATABASE_URL: 'postgresql://owner:pass@ep-foo-pooler.cell-1.region.aws.neon.tech/neondb',
    });
    assert(multiSegmentRes2.source === 'derived_neon_direct', 'Case 21b-2: Derives general cell-1.region.aws.neon.tech format');
    assert(multiSegmentRes2.url?.includes('ep-foo.cell-1.region.aws.neon.tech'), 'Case 21b-2: Stripped -pooler correctly');

    const multiSegmentRes3 = resolveMigrationDatabaseUrl({
      DATABASE_URL: 'postgresql://owner:pass@ep-bar-pooler.us-west-2.neon.tech/neondb',
    });
    assert(multiSegmentRes3.source === 'derived_neon_direct', 'Case 21b-3: Derives non-AWS regional neon.tech format');
    assert(multiSegmentRes3.url?.includes('ep-bar.us-west-2.neon.tech'), 'Case 21b-3: Stripped -pooler correctly');

    const apexNeonRes = resolveMigrationDatabaseUrl({
      DATABASE_URL: 'postgresql://owner:pass@ep-apex-pooler.neon.tech/neondb',
    });
    assert(apexNeonRes.source === 'derived_neon_direct', 'Case 21b-4: Derives apex neon.tech format');
    assert(apexNeonRes.url?.includes('ep-apex.neon.tech'), 'Case 21b-4: Stripped -pooler correctly');

    // Case 21c: Direct compute endpoints already unpooled are recognized directly
    const directCellRes = resolveMigrationDatabaseUrl({
      DATABASE_URL: 'postgresql://owner:pass@ep-polished-brook-b4wbw45g.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require',
    });
    assert(directCellRes.source === 'direct_url', 'Case 21c: Unpooled cell hostname is recognized as direct_url');
    assert(
      directCellRes.url === 'postgresql://owner:pass@ep-polished-brook-b4wbw45g.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require',
      'Case 21c: Direct compute URL left completely untouched'
    );

    // Case 21d: Comprehensive hostname validator tests (isKnownNeonPoolerHost and NEON_POOLED_HOST_REGEX)
    assert(isKnownNeonPoolerHost('ep-polished-brook-b4wbw45g-pooler.c-6.us-east-2.aws.neon.tech') === true, 'Case 21d-1: Matches modern cell pooler');
    assert(isKnownNeonPoolerHost('ep-cold-pond-12345-pooler.us-east-2.aws.neon.tech') === true, 'Case 21d-2: Matches standard regional pooler');
    assert(isKnownNeonPoolerHost('ep-test-pooler.neon.tech') === true, 'Case 21d-3: Matches apex neon pooler');
    assert(isKnownNeonPoolerHost('ep-cell-1-pooler.cell-x.region.aws.neon.tech') === true, 'Case 21d-4: Matches generic cell pooler');
    // Direct compute endpoints
    assert(isKnownNeonPoolerHost('ep-polished-brook-b4wbw45g.c-6.us-east-2.aws.neon.tech') === false, 'Case 21d-5: Direct cell endpoint returns false');
    assert(isKnownNeonPoolerHost('ep-cold-pond-12345.us-east-2.aws.neon.tech') === false, 'Case 21d-6: Direct regional endpoint returns false');
    assert(isKnownNeonPoolerHost('ep-test.neon.tech') === false, 'Case 21d-7: Direct apex endpoint returns false');
    // Invalid / malformed neon hosts
    assert(isKnownNeonPoolerHost('pooler.neon.tech') === false, 'Case 21d-8: pooler.neon.tech (no prefix) returns false');
    assert(isKnownNeonPoolerHost('-pooler.neon.tech') === false, 'Case 21d-9: -pooler.neon.tech (no endpoint id) returns false');
    assert(isKnownNeonPoolerHost('attacker.pooler.neon.tech') === false, 'Case 21d-10: attacker.pooler.neon.tech returns false');
    assert(isKnownNeonPoolerHost('ep-test-pooler.neon.tech.attacker.com') === false, 'Case 21d-11: Trailing domain spoof returns false');
    // Hostnames with unexpected labels
    assert(isKnownNeonPoolerHost('ep-pooler..c-6.neon.tech') === false, 'Case 21d-12: Double dot in hostname returns false');
    assert(isKnownNeonPoolerHost('ep-pooler.c_6.neon.tech') === false, 'Case 21d-13: Underscore in domain label returns false');
    assert(isKnownNeonPoolerHost('ep-pooler.neon.tech@evil.com') === false, 'Case 21d-14: At sign in hostname returns false');
    assert(isKnownNeonPoolerHost('ep-pooler.c-6.neon.tech.') === false, 'Case 21d-15: Trailing dot in hostname returns false');
    // Non-Neon hosts containing 'pooler'
    assert(isKnownNeonPoolerHost('other-pooler.com') === false, 'Case 21d-16: other-pooler.com returns false');
    assert(isKnownNeonPoolerHost('pgbouncer-pooler.internal') === false, 'Case 21d-17: pgbouncer-pooler.internal returns false');
    assert(isKnownNeonPoolerHost('evil-pooler.attacker.com') === false, 'Case 21d-18: evil-pooler.attacker.com returns false');
    assert(isKnownNeonPoolerHost('my-pooler.aws.com') === false, 'Case 21d-19: my-pooler.aws.com returns false');

    // Case 21e: Unusual ports and malformed URLs handled safely
    const customPortRes = deriveNeonDirectUrl(
      'postgresql://owner:pass@ep-polished-brook-b4wbw45g-pooler.c-6.us-east-2.aws.neon.tech:5433/neondb?sslmode=require'
    );
    assert(customPortRes.directUrl?.includes(':5433'), 'Case 21e-1: Custom port 5433 preserved in derived direct URL');
    assert(customPortRes.directUrl?.includes('ep-polished-brook-b4wbw45g.c-6'), 'Case 21e-1: Hostname transformed without pooler');

    const highPortRes = deriveNeonDirectUrl(
      'postgresql://owner:pass@ep-polished-brook-b4wbw45g-pooler.c-6.us-east-2.aws.neon.tech:6543/neondb'
    );
    assert(highPortRes.directUrl?.includes(':6543'), 'Case 21e-2: Unusual port 6543 preserved in derived direct URL');

    const badUrlRes = deriveNeonDirectUrl('not_a_valid_url_string');
    assert(Boolean(badUrlRes.error && !badUrlRes.directUrl), 'Case 21e-3: Completely malformed URL returns error safely');

    const badPortRes = deriveNeonDirectUrl('postgresql://owner:pass@ep-foo-pooler.neon.tech:999999/db');
    assert(Boolean(badPortRes.error && !badPortRes.directUrl), 'Case 21e-4: Out-of-range port returns sanitized error');

    // Case 22: Reject arbitrary pooler hostnames without blind transformation
    const arbitraryPoolerRes = resolveMigrationDatabaseUrl({
      DATABASE_URL: 'postgresql://owner:pass@custom-pgbouncer-pooler.internal:5432/neondb',
    });
    assert(arbitraryPoolerRes.source === 'none', 'Case 22: Refuses to blindly transform arbitrary pooler hostnames');
    assert(arbitraryPoolerRes.error?.includes('unverified pooler'), 'Case 22: Clear sanitized error on arbitrary pooler');

    // Case 22b: Additional non-Neon pooler and malformed rejection tests
    const otherPoolerRes = resolveMigrationDatabaseUrl({
      DATABASE_URL: 'postgresql://owner:pass@other-pooler.com/neondb',
    });
    assert(otherPoolerRes.source === 'none', 'Case 22b-1: other-pooler.com fails closed');
    assert(otherPoolerRes.error?.includes('unverified pooler'), 'Case 22b-1: Explains unverified pooler');

    const evilPoolerRes = resolveMigrationDatabaseUrl({
      DATABASE_URL: 'postgresql://owner:pass@evil-pooler.attacker.com/neondb',
    });
    assert(evilPoolerRes.source === 'none', 'Case 22b-2: evil-pooler.attacker.com fails closed');

    const spoofDomainRes = resolveMigrationDatabaseUrl({
      DATABASE_URL: 'postgresql://owner:pass@ep-test-pooler.neon.tech.attacker.com/neondb',
    });
    assert(spoofDomainRes.source === 'none', 'Case 22b-3: Spoofed domain suffix fails closed');

    const malformedNeonRes = resolveMigrationDatabaseUrl({
      DATABASE_URL: 'postgresql://owner:pass@-pooler.neon.tech/neondb',
    });
    assert(malformedNeonRes.source === 'none', 'Case 22b-4: -pooler.neon.tech fails closed on invalid endpoint id');

    // Case 23: Strict Neon pooler rejection when NEON_REJECT_POOLED_URL=true
    const strictRejectRes = resolveMigrationDatabaseUrl({
      DATABASE_URL: 'postgresql://owner:pass@ep-cold-pond-12345-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require',
      NEON_REJECT_POOLED_URL: 'true',
    });
    assert(strictRejectRes.source === 'none', 'Case 23: Rejects pooled Neon URL when NEON_REJECT_POOLED_URL=true');
    assert(strictRejectRes.error?.includes('Detected pooled Neon connection'), 'Case 23: Clear error explaining advisory lock incompatibility');

    // Case 24: Missing direct migration URL fails closed
    const missingUrlRes = resolveMigrationDatabaseUrl({});
    assert(missingUrlRes.source === 'none', 'Case 24: Missing connection URL returns source: none');
    assert(missingUrlRes.error?.includes('Direct database connection URL'), 'Case 24: Informative error on missing URL');

    // Case 25: Application runtime database URL behavior remains unchanged
    // Client runtime getDatabaseUrl() must continue preferring DATABASE_URL for serverless query pooling
    const originalDbUrl = process.env.DATABASE_URL;
    const originalNonPool = process.env.POSTGRES_URL_NON_POOLING;
    try {
      process.env.DATABASE_URL = 'postgresql://owner:pass@ep-pooler.us-east-2.aws.neon.tech/neondb';
      process.env.POSTGRES_URL_NON_POOLING = 'postgresql://owner:pass@ep-direct.us-east-2.aws.neon.tech/neondb';
      const clientRuntimeUrl = getDatabaseUrl();
      assert(clientRuntimeUrl === process.env.DATABASE_URL, 'Case 25: Application runtime getDatabaseUrl() continues using DATABASE_URL');
    } finally {
      process.env.DATABASE_URL = originalDbUrl;
      process.env.POSTGRES_URL_NON_POOLING = originalNonPool;
    }

    // Case 26: Advisory lock release on migration failure
    let lockAcquiredState = false;
    let lockReleasedState = false;
    const trackingClient = {
      query: async (sql: string) => {
        if (sql.includes('pg_try_advisory_lock')) {
          lockAcquiredState = true;
          return { rows: [{ acquired: true }] };
        }
        if (sql.includes('pg_advisory_unlock')) {
          lockReleasedState = true;
          return { rows: [{ released: true }] };
        }
        return { rows: [] };
      },
      release: () => {},
    };

    const trackingPool = {
      connect: async () => trackingClient,
      on: () => {},
      end: async () => {},
    };

    const failRunRes = await runMigrations({
      databaseUrl: 'postgresql://mock_user:mock_pass@ep-direct.us-east-2.aws.neon.tech/neondb',
      poolFactory: () => trackingPool,
      executeMigrate: async () => {
        throw new Error('Simulated DDL crash during migration step');
      },
    });

    assert(failRunRes.success === false, 'Case 26: Migration runner reports failure on DDL error');
    assert(lockAcquiredState === true, 'Case 26: Lock was initially acquired');
    assert(lockReleasedState === true, 'Case 26: Lock was guaranteed released in finally block despite migration failure');

    // --- SUITE 7: Production Baseline Protocol & Catalog Invariant Verification ---
    console.log('\n--- SUITE 7: Production Baseline Protocol & Catalog Invariant Verification ---');

    // Case 27: Journal Validation - Rejection of NULL created_at timestamps
    const validateJournalRows = (rows: Array<{ hash: string | null; created_at: number | null }>) => {
      for (const row of rows) {
        if (row.created_at === null || row.created_at === undefined) {
          throw new Error('[BASELINE ABORT]: Found NULL created_at in drizzle.__drizzle_migrations.');
        }
        if (!row.hash || row.hash.trim() === '') {
          throw new Error('[BASELINE ABORT]: Found NULL or empty hash in drizzle.__drizzle_migrations.');
        }
      }
      return true;
    };

    let nullTimestampCaught = false;
    try {
      validateJournalRows([
        { hash: '8f2418b022a42d5a10cfbfd2fb5a4eb4051f372a3e4f14c94ed3834f8fd55b3e', created_at: 1793435374100 },
        { hash: '19602828caf802675b3faa334c540dcb2b1b8cf3a2e65514c637527824f916c8', created_at: null },
      ]);
    } catch (err: any) {
      if (err.message.includes('Found NULL created_at')) {
        nullTimestampCaught = true;
      }
    }
    assert(nullTimestampCaught === true, 'Case 27: Baseline journal validation strictly rejects NULL created_at timestamps');

    // Case 28: Journal Validation - Exact Sequence OID and Ownership Verification
    interface CatalogDependencyRecord {
      attrdefOid: number;
      columnDefaultSeqOid: number;
      expectedSeqOid: number;
      expectedSeqSchema: string;
      seqOwnerTableOid: number;
      expectedTableOid: number;
      dependencyType: 'a' | 'n';
    }

    const validateJournalSequenceIdentity = (dep: CatalogDependencyRecord) => {
      // 1. Verify sequence belongs strictly to schema "drizzle"
      if (dep.expectedSeqSchema !== 'drizzle') {
        throw new Error(`[BASELINE ABORT]: Sequence schema mismatch: expected drizzle, found ${dep.expectedSeqSchema}`);
      }
      // 2. Prove default expression references the exact sequence OID
      if (dep.columnDefaultSeqOid !== dep.expectedSeqOid) {
        throw new Error(`[BASELINE ABORT]: Column default references sequence OID ${dep.columnDefaultSeqOid}, expected ${dep.expectedSeqOid}. Default points to wrong sequence!`);
      }
      // 3. Prove sequence is owned by the journal table's id column (deptype = 'a')
      if (dep.seqOwnerTableOid !== dep.expectedTableOid || dep.dependencyType !== 'a') {
        throw new Error('[BASELINE ABORT]: Sequence is not auto-owned by drizzle.__drizzle_migrations.id');
      }
      return true;
    };

    // Subcase 28a: Correct sequence in schema "drizzle" with auto-dependency
    const validDep: CatalogDependencyRecord = {
      attrdefOid: 50101,
      columnDefaultSeqOid: 50102,
      expectedSeqOid: 50102,
      expectedSeqSchema: 'drizzle',
      seqOwnerTableOid: 50100,
      expectedTableOid: 50100,
      dependencyType: 'a',
    };
    assert(validateJournalSequenceIdentity(validDep) === true, 'Case 28a: Exact sequence identity and ownership passes on valid catalog record');

    // Subcase 28b: Default points to a same-named sequence in "public" schema
    let foreignSchemaSeqCaught = false;
    try {
      validateJournalSequenceIdentity({
        ...validDep,
        expectedSeqSchema: 'public', // Same name, but in wrong schema!
      });
    } catch (err: any) {
      if (err.message.includes('Sequence schema mismatch')) {
        foreignSchemaSeqCaught = true;
      }
    }
    assert(foreignSchemaSeqCaught === true, 'Case 28b: Rejects same-named sequence located in foreign schema (public instead of drizzle)');

    // Subcase 28c: Default points to an arbitrary/different sequence OID
    let wrongSeqOidCaught = false;
    try {
      validateJournalSequenceIdentity({
        ...validDep,
        columnDefaultSeqOid: 99999, // Points to different sequence OID!
      });
    } catch (err: any) {
      if (err.message.includes('Default points to wrong sequence')) {
        wrongSeqOidCaught = true;
      }
    }
    assert(wrongSeqOidCaught === true, 'Case 28c: Rejects default pointing to mismatched sequence OID');

    // Case 29: Journal Validation - Rejection of unexpected constraints and extra indexes
    const validateJournalConstraintsAndIndexes = (extraConstraints: number, extraIndexes: number) => {
      if (extraConstraints > 0) {
        throw new Error(`[BASELINE ABORT]: Unexpected constraints found on drizzle.__drizzle_migrations (${extraConstraints} extra).`);
      }
      if (extraIndexes > 0) {
        throw new Error(`[BASELINE ABORT]: Unexpected indexes found on drizzle.__drizzle_migrations (${extraIndexes} extra).`);
      }
      return true;
    };

    let unexpectedConCaught = false;
    try {
      validateJournalConstraintsAndIndexes(1, 0); // 1 extra check constraint
    } catch (err: any) {
      if (err.message.includes('Unexpected constraints found')) {
        unexpectedConCaught = true;
      }
    }
    assert(unexpectedConCaught === true, 'Case 29a: Rejects unexpected constraints on drizzle.__drizzle_migrations');

    let unexpectedIdxCaught = false;
    try {
      validateJournalConstraintsAndIndexes(0, 1); // 1 extra index
    } catch (err: any) {
      if (err.message.includes('Unexpected indexes found')) {
        unexpectedIdxCaught = true;
      }
    }
    assert(unexpectedIdxCaught === true, 'Case 29b: Rejects unexpected indexes on drizzle.__drizzle_migrations');

    // Case 30: Downstream Relation Inspection - Deterministic Multi-Schema Detection
    interface RelationMatchSummary {
      tableName: string;
      totalMatches: number;
      publicTableCount: number;
      publicNonTableCount: number;
      otherSchemaCount: number;
      relationsFound: string;
    }

    const classifyDownstreamRelation = (rel: RelationMatchSummary) => {
      if (rel.totalMatches === 0) {
        return 'CLEAN_ABSENT';
      }
      if (rel.totalMatches === 1 && rel.publicTableCount === 1) {
        return 'EXISTS_IN_PUBLIC';
      }
      if (rel.publicNonTableCount > 0) {
        return 'FAIL_RELATION_KIND_COLLISION';
      }
      if (rel.otherSchemaCount > 0 && rel.publicTableCount === 0) {
        return 'FAIL_DIVERGENT_SCHEMA';
      }
      if (rel.totalMatches > 1) {
        return 'FAIL_AMBIGUOUS_DUPLICATE_RELATIONS';
      }
      return 'FAIL_UNKNOWN';
    };

    // Subcase 30a: Clean absence
    assert(
      classifyDownstreamRelation({
        tableName: 'ai_conversations',
        totalMatches: 0,
        publicTableCount: 0,
        publicNonTableCount: 0,
        otherSchemaCount: 0,
        relationsFound: '',
      }) === 'CLEAN_ABSENT',
      'Case 30a: Truly absent relation classified as CLEAN_ABSENT'
    );

    // Subcase 30b: Ordinary table in public
    assert(
      classifyDownstreamRelation({
        tableName: 'ai_conversations',
        totalMatches: 1,
        publicTableCount: 1,
        publicNonTableCount: 0,
        otherSchemaCount: 0,
        relationsFound: 'public.ai_conversations (r)',
      }) === 'EXISTS_IN_PUBLIC',
      'Case 30b: Ordinary public table classified as EXISTS_IN_PUBLIC'
    );

    // Subcase 30c: Relation exists in public as a VIEW (relkind = 'v')
    assert(
      classifyDownstreamRelation({
        tableName: 'ai_conversations',
        totalMatches: 1,
        publicTableCount: 0,
        publicNonTableCount: 1,
        otherSchemaCount: 0,
        relationsFound: 'public.ai_conversations (v)',
      }) === 'FAIL_RELATION_KIND_COLLISION',
      'Case 30c: Public view collision detected and rejected (never CLEAN_ABSENT)'
    );

    // Subcase 30d: Same-named relation exists in non-public schema
    assert(
      classifyDownstreamRelation({
        tableName: 'ai_conversations',
        totalMatches: 1,
        publicTableCount: 0,
        publicNonTableCount: 0,
        otherSchemaCount: 1,
        relationsFound: 'staging.ai_conversations (r)',
      }) === 'FAIL_DIVERGENT_SCHEMA',
      'Case 30d: Non-public relation detected as divergent schema'
    );

    // Subcase 30e: Duplicate relations across schemas
    assert(
      classifyDownstreamRelation({
        tableName: 'ai_conversations',
        totalMatches: 2,
        publicTableCount: 1,
        publicNonTableCount: 0,
        otherSchemaCount: 1,
        relationsFound: 'public.ai_conversations (r), staging.ai_conversations (r)',
      }) === 'FAIL_AMBIGUOUS_DUPLICATE_RELATIONS',
      'Case 30e: Duplicate relations across multiple schemas rejected as ambiguous'
    );

    // Case 31: Index Key Columns vs INCLUDE Columns & Sort Options
    interface IndexCatalogRecord {
      indnatts: number;
      indnkeyatts: number;
      indoption: number[]; // 0 = ASC NULLS LAST
      isBtree: boolean;
    }

    const validateIndexOptions = (idx: IndexCatalogRecord) => {
      if (!idx.isBtree) {
        throw new Error('ACCESS METHOD MISMATCH: expected btree');
      }
      if (idx.indnatts > idx.indnkeyatts) {
        throw new Error('UNEXPECTED INCLUDE COLUMNS: index has included attributes');
      }
      for (let i = 0; i < idx.indnkeyatts; i++) {
        if (idx.indoption[i] !== 0) {
          throw new Error(`UNEXPECTED SORT ORDER: key column at pos ${i} has non-default indoption ${idx.indoption[i]}`);
        }
      }
      return true;
    };

    assert(
      validateIndexOptions({
        indnatts: 2,
        indnkeyatts: 2,
        indoption: [0, 0],
        isBtree: true,
      }) === true,
      'Case 31a: Standard B-tree index with zero INCLUDE columns and ASC NULLS LAST passes'
    );

    let includeColCaught = false;
    try {
      validateIndexOptions({
        indnatts: 3,
        indnkeyatts: 2, // 1 INCLUDE column!
        indoption: [0, 0],
        isBtree: true,
      });
    } catch (err: any) {
      if (err.message.includes('UNEXPECTED INCLUDE COLUMNS')) {
        includeColCaught = true;
      }
    }
    assert(includeColCaught === true, 'Case 31b: Rejects index with unexpected INCLUDE columns');

    let descSortCaught = false;
    try {
      validateIndexOptions({
        indnatts: 1,
        indnkeyatts: 1,
        indoption: [1], // bit 0 = DESC
        isBtree: true,
      });
    } catch (err: any) {
      if (err.message.includes('UNEXPECTED SORT ORDER')) {
        descSortCaught = true;
      }
    }
    assert(descSortCaught === true, 'Case 31c: Rejects index with non-standard sort option (DESC)');

    // Case 32: Journal Default Verification - Prove default explicitly calls nextval()
    interface JournalDefaultExpressionRecord {
      defaultExpr: string;
      procDependency: string; // e.g. "nextval(regclass)"
      referencedSeqOid: number;
      expectedSeqOid: number;
    }

    const validateJournalDefaultFunction = (rec: JournalDefaultExpressionRecord) => {
      // 1. Must specifically invoke nextval(regclass)
      if (rec.procDependency !== 'nextval(regclass)') {
        throw new Error(`[BASELINE ABORT]: Column id default does NOT invoke nextval(regclass). Found function dependency: ${rec.procDependency}`);
      }
      // 2. Expression string must match exact nextval canonized pattern
      const validCanonical = [
        "nextval('drizzle.__drizzle_migrations_id_seq'::regclass)",
        'nextval(\'"drizzle"."__drizzle_migrations_id_seq"\'::regclass)',
      ];
      if (!validCanonical.includes(rec.defaultExpr)) {
        throw new Error(`[BASELINE ABORT]: Column id default expression "${rec.defaultExpr}" does not match expected nextval call on drizzle.__drizzle_migrations_id_seq`);
      }
      // 3. Must reference exact sequence OID
      if (rec.referencedSeqOid !== rec.expectedSeqOid) {
        throw new Error(`[BASELINE ABORT]: Default references sequence OID ${rec.referencedSeqOid}, expected ${rec.expectedSeqOid}`);
      }
      return true;
    };

    // Subcase 32a: Valid nextval call on exact sequence
    assert(
      validateJournalDefaultFunction({
        defaultExpr: "nextval('drizzle.__drizzle_migrations_id_seq'::regclass)",
        procDependency: 'nextval(regclass)',
        referencedSeqOid: 70101,
        expectedSeqOid: 70101,
      }) === true,
      'Case 32a: Valid nextval() call on exact sequence passes'
    );

    // Subcase 32b: Expression uses currval() instead of nextval()
    let currvalCaught = false;
    try {
      validateJournalDefaultFunction({
        defaultExpr: "currval('drizzle.__drizzle_migrations_id_seq'::regclass)",
        procDependency: 'currval(regclass)',
        referencedSeqOid: 70101,
        expectedSeqOid: 70101,
      });
    } catch (err: any) {
      if (err.message.includes('does NOT invoke nextval(regclass)')) {
        currvalCaught = true;
      }
    }
    assert(currvalCaught === true, 'Case 32b: Rejects currval() expression on journal id column');

    // Subcase 32c: Expression calls nextval() on wrong sequence name
    let wrongSeqNameCaught = false;
    try {
      validateJournalDefaultFunction({
        defaultExpr: "nextval('public.wrong_id_seq'::regclass)",
        procDependency: 'nextval(regclass)',
        referencedSeqOid: 70101,
        expectedSeqOid: 70101,
      });
    } catch (err: any) {
      if (err.message.includes('does not match expected nextval call')) {
        wrongSeqNameCaught = true;
      }
    }
    assert(wrongSeqNameCaught === true, 'Case 32c: Rejects nextval() call on different sequence name');

    // Case 33: Journal Sequence State & Collision Invariant (Read-Only Check)
    interface SequenceStateRecord {
      maxId: number;
      lastValue: number;
      isCalled: boolean;
    }

    const verifyJournalSequenceCollisionSafety = (state: SequenceStateRecord) => {
      const nextGeneratedId = !state.isCalled ? state.lastValue : state.lastValue + 1;
      if (nextGeneratedId <= state.maxId) {
        throw new Error(
          `[BASELINE ABORT]: Sequence desynchronization detected in drizzle.__drizzle_migrations_id_seq. Next generated ID (${nextGeneratedId}) would collide with or is <= max existing id (${state.maxId}). Sequence synchronization is required before proceeding.`
        );
      }
      return { isSynchronized: true, nextGeneratedId };
    };

    // Subcase 33a: Synchronized sequence state (maxId=2, lastValue=2, isCalled=true -> next is 3)
    const syncRes = verifyJournalSequenceCollisionSafety({ maxId: 2, lastValue: 2, isCalled: true });
    assert(syncRes.isSynchronized === true && syncRes.nextGeneratedId === 3, 'Case 33a: Synchronized sequence state (nextId > maxId) passes without modification');

    // Subcase 33b: Brand new sequence (maxId=0, lastValue=1, isCalled=false -> next is 1)
    const newSeqRes = verifyJournalSequenceCollisionSafety({ maxId: 0, lastValue: 1, isCalled: false });
    assert(newSeqRes.isSynchronized === true && newSeqRes.nextGeneratedId === 1, 'Case 33b: New sequence state (isCalled=false) passes with next ID 1');

    // Subcase 33c: Desynchronized sequence (maxId=2, lastValue=1, isCalled=true -> next is 2, collision with existing row 2!)
    let desyncCollisionCaught = false;
    try {
      verifyJournalSequenceCollisionSafety({ maxId: 2, lastValue: 1, isCalled: true });
    } catch (err: any) {
      if (err.message.includes('Sequence desynchronization detected')) {
        desyncCollisionCaught = true;
      }
    }
    assert(desyncCollisionCaught === true, 'Case 33c: Desynchronized sequence strictly aborts preflight to prevent primary key collision');

    // Case 34: Complete Downstream Relation-Kind Classification (All relkind types fail closed)
    interface ExhaustiveRelationClassification {
      tableName: string;
      relkind: string; // r, p, v, m, f, S, i, I, c, ?
      schema: string;
    }

    const classifySpecificRelationKind = (rel: ExhaustiveRelationClassification) => {
      if (rel.schema !== 'public') {
        return { status: 'FAIL', reason: `DIVERGENT SCHEMA: relation exists in ${rel.schema}` };
      }
      switch (rel.relkind) {
        case 'r':
          return { status: 'PASS', reason: 'ordinary table' };
        case 'p':
          return { status: 'FAIL', reason: 'RELATION KIND COLLISION: Object exists in public as a PARTITIONED TABLE. Expected ordinary table (r).' };
        case 'v':
          return { status: 'FAIL', reason: 'RELATION KIND COLLISION: Object exists in public as a VIEW. CREATE TABLE will fail!' };
        case 'm':
          return { status: 'FAIL', reason: 'RELATION KIND COLLISION: Object exists in public as a MATERIALIZED VIEW.' };
        case 'f':
          return { status: 'FAIL', reason: 'RELATION KIND COLLISION: Object exists in public as a FOREIGN TABLE.' };
        case 'S':
          return { status: 'FAIL', reason: 'RELATION KIND COLLISION: Object exists in public as a SEQUENCE.' };
        case 'i':
        case 'I':
          return { status: 'FAIL', reason: 'RELATION KIND COLLISION: Object exists in public as an INDEX.' };
        case 'c':
          return { status: 'FAIL', reason: 'RELATION KIND COLLISION: Object exists in public as a COMPOSITE TYPE.' };
        default:
          return { status: 'FAIL', reason: `RELATION KIND COLLISION: Object exists in public with unknown/unexpected relkind: ${rel.relkind}` };
      }
    };

    assert(classifySpecificRelationKind({ tableName: 'ai_conversations', relkind: 'r', schema: 'public' }).status === 'PASS', 'Case 34a: Ordinary table (r) in public passes');
    assert(classifySpecificRelationKind({ tableName: 'ai_conversations', relkind: 'p', schema: 'public' }).status === 'FAIL', 'Case 34b: Partitioned table (p) fails closed');
    assert(classifySpecificRelationKind({ tableName: 'ai_conversations', relkind: 'v', schema: 'public' }).status === 'FAIL', 'Case 34c: View (v) fails closed');
    assert(classifySpecificRelationKind({ tableName: 'ai_conversations', relkind: 'm', schema: 'public' }).status === 'FAIL', 'Case 34d: Materialized view (m) fails closed');
    assert(classifySpecificRelationKind({ tableName: 'ai_conversations', relkind: 'f', schema: 'public' }).status === 'FAIL', 'Case 34e: Foreign table (f) fails closed');
    assert(classifySpecificRelationKind({ tableName: 'ai_conversations', relkind: 'S', schema: 'public' }).status === 'FAIL', 'Case 34f: Sequence (S) fails closed');
    assert(classifySpecificRelationKind({ tableName: 'ai_conversations', relkind: 'i', schema: 'public' }).status === 'FAIL', 'Case 34g: Index (i) fails closed');
    assert(classifySpecificRelationKind({ tableName: 'ai_conversations', relkind: 'c', schema: 'public' }).status === 'FAIL', 'Case 34h: Composite type (c) fails closed');
    assert(classifySpecificRelationKind({ tableName: 'ai_conversations', relkind: '?', schema: 'public' }).status === 'FAIL', 'Case 34i: Unknown relation kind fails closed');
  }

  // --- SUITE 8: Production Migration History No-Op Simulation & Fail-Closed Preflight ---
  console.log('\n--- SUITE 8: Production Migration History No-Op Simulation & Fail-Closed Preflight ---');
  {
    // Case 35: Full 6-migration journal simulation with PGlite (exact production timestamps and hashes)
    const pglite = new PGlite();
    await pglite.query('CREATE SCHEMA IF NOT EXISTS drizzle;');
    await pglite.query(
      'CREATE TABLE drizzle.__drizzle_migrations (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint);'
    );

    const productionJournalRows = [
      { id: 1, hash: '8f2418b022a42d5a10cfbfd2fb5a4eb4051f372a3e4f14c94ed3834f8fd55b3e', created_at: 1793435374100 },
      { id: 2, hash: '19602828caf802675b3faa334c540dcb2b1b8cf3a2e65514c637527824f916c8', created_at: 1793439022931 },
      { id: 3, hash: '7308d51ee4b4d79c6fa71d34bc7e5c9b68a62341d1a1cb8ec993d077c5fe56fa', created_at: 1793540000000 },
      { id: 4, hash: '494879b7b9ca4041b65053b27b3e157dc9f7d3c015bf26c483a37b38c0f56a31', created_at: 1793550000000 },
      { id: 5, hash: 'c0287cf91c4c81aebfc36357ca6f6348bb44a69cfd04e548238f4be2a7223b5b', created_at: 1793640000000 },
      { id: 6, hash: '3e168d60144d1593c662cefc8db2141544a0b27b682613d94b05a7662c1613b9', created_at: 1793685347204 },
    ];

    for (const row of productionJournalRows) {
      await pglite.query(
        'INSERT INTO drizzle.__drizzle_migrations (id, hash, created_at) VALUES ($1, $2, $3)',
        [row.id, row.hash, row.created_at]
      );
    }

    // Intercept all queries to detect any DDL or baseline insertions
    const executedDdlStatements: string[] = [];
    const executedMigrationInserts: string[] = [];
    let lockAcquiredOnClient = false;
    let lockReleasedOnClient = false;

    const noopClientAdapter = {
      query: async (queryTextOrConfig: any, values?: any[]) => {
        const sqlText = typeof queryTextOrConfig === 'string' ? queryTextOrConfig : queryTextOrConfig.text;
        const normalized = sqlText.trim().replace(/\s+/g, ' ');

        if (normalized.includes('pg_try_advisory_lock')) {
          lockAcquiredOnClient = true;
          return { rows: [{ acquired: true }] };
        }
        if (normalized.includes('pg_advisory_unlock')) {
          lockReleasedOnClient = true;
          return { rows: [{ released: true }] };
        }

        // Detect DDL execution from migration scripts
        const isMigrationDdl =
          (normalized.startsWith('CREATE TABLE') && !normalized.includes('__drizzle_migrations')) ||
          normalized.startsWith('ALTER TABLE') ||
          normalized.startsWith('CREATE INDEX') ||
          normalized.startsWith('DROP');

        if (isMigrationDdl) {
          executedDdlStatements.push(normalized);
        }

        // Detect insertion into __drizzle_migrations
        if (normalized.startsWith('insert into') && normalized.includes('__drizzle_migrations')) {
          executedMigrationInserts.push(normalized);
        }

        return pglite.query(sqlText, values);
      },
      release: () => {},
    };

    const noopMockPool = {
      connect: async () => noopClientAdapter,
      on: () => {},
      end: async () => {},
    };

    const noopRunResult = await runMigrations({
      databaseUrl: 'postgresql://owner:pass@ep-polished-brook-b4wbw45g.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require',
      poolFactory: () => noopMockPool,
    });

    assert(noopRunResult.success === true, 'Case 35a: runMigrations succeeds against fully migrated schema');
    assert(executedDdlStatements.length === 0, 'Case 35b: Exactly ZERO DDL statements executed (complete no-op)');
    assert(executedMigrationInserts.length === 0, 'Case 35c: Exactly ZERO migration inserts executed (no duplicate journal entries)');
    
    const countCheck = await pglite.query('SELECT count(*) as count FROM drizzle.__drizzle_migrations;');
    assert(Number(countCheck.rows[0].count) === 6, 'Case 35d: Journal table retains exactly 6 records without mutation');
    assert(lockAcquiredOnClient === true, 'Case 35e: Advisory lock was acquired on client during execution');
    assert(lockReleasedOnClient === true, 'Case 35f: Advisory lock was properly released after execution');

    await pglite.close();

    // Case 36: Direct URL availability and fail-closed resolution in migration runner
    // Case 36a: Runner derives direct cell URL from pooled DATABASE_URL and executes with neon-direct-unpooled
    const pglite36 = new PGlite();
    await pglite36.query('CREATE SCHEMA IF NOT EXISTS drizzle;');
    await pglite36.query(
      'CREATE TABLE drizzle.__drizzle_migrations (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint);'
    );
    for (const row of productionJournalRows) {
      await pglite36.query(
        'INSERT INTO drizzle.__drizzle_migrations (id, hash, created_at) VALUES ($1, $2, $3)',
        [row.id, row.hash, row.created_at]
      );
    }

    const cellDeriveRunnerResult = await runMigrations({
      databaseUrl: deriveNeonDirectUrl('postgresql://owner:pass@ep-polished-brook-b4wbw45g-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require').directUrl,
      poolFactory: () => ({
        connect: async () => ({
          query: async (queryTextOrConfig: any, params?: any[]) => {
            const sqlText = typeof queryTextOrConfig === 'string' ? queryTextOrConfig : queryTextOrConfig.text;
            if (sqlText.includes('pg_try_advisory_lock')) return { rows: [{ acquired: true }] };
            if (sqlText.includes('pg_advisory_unlock')) return { rows: [{ released: true }] };
            return pglite36.query(sqlText, params);
          },
          release: () => {},
        }),
        on: () => {},
        end: async () => {},
      }),
    });
    assert(cellDeriveRunnerResult.success === true, 'Case 36a: Runner succeeds when given derived direct compute cell URL');
    await pglite36.close();

    // Case 36b: Missing database URL fails closed before pool initialization
    let poolCreatedOnMissing = false;
    const origEnv = { ...process.env };
    delete process.env.POSTGRES_URL_NON_POOLING;
    delete process.env.DATABASE_URL_UNPOOLED;
    delete process.env.DATABASE_URL;
    delete process.env.POSTGRES_URL;

    try {
      const missingRunResult = await runMigrations({
        poolFactory: () => {
          poolCreatedOnMissing = true;
          return noopMockPool;
        },
      });
      assert(missingRunResult.success === false, 'Case 36b: Missing connection variables fails closed');
      assert(poolCreatedOnMissing === false, 'Case 36b: Pool was never initialized when URL was missing');
      assert(missingRunResult.error?.includes('Direct database connection URL'), 'Case 36b: Informative sanitized error returned');
    } finally {
      process.env = origEnv;
    }

    // Case 36c: Unverified pooler in environment fails closed before connection
    let poolCreatedOnArbitrary = false;
    const origEnv2 = { ...process.env };
    process.env.DATABASE_URL = 'postgresql://owner:pass@custom-pgbouncer-pooler.internal:5432/neondb';
    delete process.env.POSTGRES_URL_NON_POOLING;
    delete process.env.DATABASE_URL_UNPOOLED;

    try {
      const arbitraryRunResult = await runMigrations({
        poolFactory: () => {
          poolCreatedOnArbitrary = true;
          return noopMockPool;
        },
      });
      assert(arbitraryRunResult.success === false, 'Case 36c: Unverified pooler in DATABASE_URL fails closed');
      assert(poolCreatedOnArbitrary === false, 'Case 36c: Pool was never initialized for unverified pooler');
      assert(arbitraryRunResult.error?.includes('unverified pooler'), 'Case 36c: Error clearly explains unverified pooler');
    } finally {
      process.env = origEnv2;
    }

    // Case 36d: Strict Neon pooler rejection (NEON_REJECT_POOLED_URL=true) fails closed
    let poolCreatedOnReject = false;
    const origEnv3 = { ...process.env };
    process.env.DATABASE_URL = 'postgresql://owner:pass@ep-polished-brook-b4wbw45g-pooler.c-6.us-east-2.aws.neon.tech/neondb';
    process.env.NEON_REJECT_POOLED_URL = 'true';
    delete process.env.POSTGRES_URL_NON_POOLING;
    delete process.env.DATABASE_URL_UNPOOLED;

    try {
      const rejectRunResult = await runMigrations({
        poolFactory: () => {
          poolCreatedOnReject = true;
          return noopMockPool;
        },
      });
      assert(rejectRunResult.success === false, 'Case 36d: NEON_REJECT_POOLED_URL=true strictly blocks pooled URL');
      assert(poolCreatedOnReject === false, 'Case 36d: Pool was never initialized when derivation rejected');
      assert(rejectRunResult.error?.includes('Detected pooled Neon connection'), 'Case 36d: Error warns of advisory lock incompatibility');
    } finally {
      process.env = origEnv3;
    }
  }

  console.log('\n============================================================');
  console.log(`TEST RUN COMPLETE: ${testPassed} Passed, ${testFailed} Failed`);
  console.log('============================================================\n');

  if (testFailed > 0) {
    process.exit(1);
  }
}

runAllSuites().catch((err) => {
  console.error('Fatal test exception:', err);
  process.exit(1);
});
