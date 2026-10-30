import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { migrate } from 'drizzle-orm/neon-http/migrator';
import path from 'path';

/**
 * Runs Drizzle database migrations against the configured Neon PostgreSQL database.
 */
async function runMigrations() {
  const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!databaseUrl || databaseUrl.trim().length === 0) {
    console.error('ERROR: DATABASE_URL or POSTGRES_URL environment variable is required to run migrations.');
    process.exit(1);
  }

  console.log('Connecting to Neon PostgreSQL over serverless HTTP...');
  const sql = neon(databaseUrl);
  const db = drizzle(sql);

  const migrationsFolder = path.resolve(process.cwd(), 'drizzle');
  console.log(`Applying migrations from: ${migrationsFolder}`);

  try {
    await migrate(db, { migrationsFolder });
    console.log('✓ All migrations applied successfully to Neon PostgreSQL!');
  } catch (err: any) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  }
}

if (process.argv[1] && (process.argv[1].endsWith('migrate.ts') || process.argv[1].endsWith('migrate.js'))) {
  runMigrations();
}

export { runMigrations };
