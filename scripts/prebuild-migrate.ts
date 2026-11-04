/**
 * NetMentor Prebuild Migration Step
 *
 * Runs immediately before Vite and TypeScript compilation during deployment builds.
 *
 * Enforcement Rules:
 * 1. Preview Deployments (VERCEL_ENV=preview):
 *    - SKIPPED. Preview deployments must NEVER touch or mutate production schema.
 * 2. Local Builds (VERCEL_ENV is unset and RUN_MIGRATIONS !== 'true'):
 *    - SKIPPED. Local developer builds ('npm run build') must NEVER execute automatic migrations.
 * 3. Production Deployments (VERCEL_ENV=production or RUN_MIGRATIONS=true):
 *    - EXECUTED. Connects to production Neon PostgreSQL with concurrency advisory locks.
 *    - If migrations fail, exits with code 1, which IMMEDIATELY HALTS the Vercel build
 *      before any new application code is bundled or deployed!
 */

import {
  runMigrations,
  evaluateEnvironmentGate,
  redactConnectionString,
} from '../api/_lib/db/migrate.js';

async function main() {
  const gate = evaluateEnvironmentGate(process.env);

  if (!gate.shouldRun) {
    console.log(`[Migration Guard]: ${gate.message}`);
    process.exit(0);
  }

  console.log(`[Migration Guard]: ${gate.message}`);
  console.log('[Migration Guard]: Applying pending database migrations before compiling application...');

  try {
    const result = await runMigrations({ lockTimeoutMs: 30000 });
    if (!result.success) {
      console.error('[Migration Guard Error]: Database migration failed.');
      if (result.error) {
        console.error(`[Migration Error Detail]: ${redactConnectionString(result.error)}`);
      }
      process.exit(1);
    }

    console.log('[Migration Guard]: Database schema is up-to-date. Proceeding with application build.');
    process.exit(0);
  } catch (err: any) {
    const safeMsg = redactConnectionString(err?.message || String(err));
    console.error(`[Migration Guard Fatal]: ${safeMsg}`);
    process.exit(1);
  }
}

main();
