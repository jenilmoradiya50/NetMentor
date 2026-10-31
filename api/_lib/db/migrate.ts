import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';
const { Pool } = pg;
import path from 'path';
import { getDatabaseUrl, inspectConnectionConfig } from './client.js';

// Automatically load local environment files in development CLI tools
if (typeof process.loadEnvFile === 'function') {
  try { process.loadEnvFile('.env.local'); } catch {}
  try { process.loadEnvFile('.env'); } catch {}
}

/**
 * Runs Drizzle database migrations against the configured Neon PostgreSQL database.
 * Targets the 'public' schema explicitly and preserves existing data.
 */
async function runMigrations() {
  const databaseUrl = getDatabaseUrl();
  if (!databaseUrl || databaseUrl.trim().length === 0) {
    console.error('ERROR: DATABASE_URL, POSTGRES_URL, or POSTGRES_URL_NON_POOLING is required to run migrations.');
    console.error('Please configure your database connection string in .env.local or your environment.');
    process.exit(1);
  }

  const config = inspectConnectionConfig(databaseUrl);
  console.log(`Connecting to Neon PostgreSQL via pg driver (Connection type: ${config.connectionType})...`);

  // Migrations run from an isolated single connection pool
  const pool = new Pool({
    connectionString: databaseUrl,
    max: 1,
    connectionTimeoutMillis: 15000,
    ssl: config.ssl,
  });

  pool.on('error', (err) => {
    console.error('[Migration Pool Error]:', err.message);
  });

  // Ensure migrations are pinned to the public schema
  pool.on('connect', (client) => {
    client.query('SET search_path TO public;').catch(() => {});
  });

  const db = drizzle(pool);
  const migrationsFolder = path.resolve(process.cwd(), 'drizzle');
  console.log(`Applying versioned migrations from: ${migrationsFolder}`);

  try {
    await migrate(db, { migrationsFolder });
    console.log('✓ All migrations applied successfully to Neon PostgreSQL (public schema)!');
  } catch (err: any) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

if (process.argv[1] && (process.argv[1].endsWith('migrate.ts') || process.argv[1].endsWith('migrate.js'))) {
  runMigrations();
}

export { runMigrations };
