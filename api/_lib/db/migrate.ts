import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { migrate } from 'drizzle-orm/neon-http/migrator';
import path from 'path';

/**
 * Runs Drizzle database migrations against the configured Neon PostgreSQL database.
 */
async function runMigrations() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl || databaseUrl.trim().length === 0) {
    console.error('ERROR: DATABASE_URL environment variable is required to run migrations.');
    process.exit(1);
  }

  console.log('Connecting to Neon PostgreSQL...');
  const sql = neon(databaseUrl);
  const db = drizzle(sql);

  console.log('Applying pending migrations from ./drizzle...');
  try {
    await migrate(db, { migrationsFolder: path.resolve(__dirname, '../../../drizzle') });
    console.log('✓ Migrations successfully applied!');
  } catch (err: any) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  }
}

if (process.argv[1] && process.argv[1].endsWith('migrate.ts')) {
  runMigrations();
}

export { runMigrations };
