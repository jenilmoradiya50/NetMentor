import readline from 'node:readline';
import { hashPassword } from '../api/_lib/password';
import { upsertUser, isDatabaseConfigured, getPool } from '../api/_lib/db/client';
import type { UserRole } from '../api/_lib/types';

// Automatically load local environment files
if (typeof process.loadEnvFile === 'function') {
  try { process.loadEnvFile('.env.local'); } catch {}
  try { process.loadEnvFile('.env'); } catch {}
}

/**
 * Reads a line of input with terminal echo enabled (for username, role).
 */
function readInput(prompt: string, defaultValue = ''): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const displayPrompt = defaultValue ? `${prompt} [${defaultValue}]: ` : `${prompt}: `;

  return new Promise((resolve) => {
    rl.question(displayPrompt, (answer) => {
      rl.close();
      resolve(answer.trim() || defaultValue);
    });
  });
}

/**
 * Reads a password securely with ZERO ECHO (no characters displayed on the screen).
 * Prevents password leakage in terminal history, screen sharing, or logs.
 */
function readSecret(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    process.stdout.write(`${prompt}: `);

    const stdin = process.stdin;
    const wasRaw = stdin.isRaw;
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');

    let input = '';

    const onData = (char: string) => {
      // Handle Ctrl+C
      if (char === '\u0003') {
        stdin.setRawMode(wasRaw || false);
        stdin.pause();
        process.stdout.write('\nCancelled.\n');
        process.exit(1);
      }

      // Handle Enter (Carriage return / line feed)
      if (char === '\r' || char === '\n' || char === '\u0004') {
        stdin.setRawMode(wasRaw || false);
        stdin.pause();
        stdin.removeListener('data', onData);
        process.stdout.write('\n');
        resolve(input);
        return;
      }

      // Handle Backspace
      if (char === '\u0008' || char === '\x7f') {
        if (input.length > 0) {
          input = input.slice(0, -1);
        }
        return;
      }

      input += char;
    };

    stdin.on('data', onData);
  });
}

async function main() {
  console.log('================================================================');
  console.log(' NetMentor — Secure Database User Seeding');
  console.log(' Zero-echo interactive password entry (no passwords logged/saved)');
  console.log('================================================================\n');

  if (!isDatabaseConfigured()) {
    console.error('ERROR: DATABASE_URL or POSTGRES_URL environment variable is not configured.');
    console.error('Please configure your Neon database connection string before seeding accounts.');
    process.exit(1);
  }

  // 1. Prompt username
  const username = await readInput('Enter username', 'jenilmoradiya50@admin');
  if (!username) {
    console.error('Username cannot be empty.');
    process.exit(1);
  }

  // 2. Determine or prompt role
  const defaultRole: UserRole = username.includes('@admin') ? 'admin' : 'user';
  const roleInput = (await readInput('Enter role (admin / user)', defaultRole)).toLowerCase();
  const role: UserRole = roleInput === 'admin' ? 'admin' : 'user';

  // 3. Prompt password with zero echo
  const password = await readSecret('Enter password (zero-echo, characters hidden)');
  if (!password || password.length < 8) {
    console.error('ERROR: Password must be at least 8 characters long.');
    process.exit(1);
  }

  // 4. Confirm password
  const confirmPassword = await readSecret('Confirm password (zero-echo)');
  if (password !== confirmPassword) {
    console.error('ERROR: Passwords do not match.');
    process.exit(1);
  }

  console.log('\nDeriving memory-hard Argon2id hash...');
  const passwordHash = await hashPassword(password);

  console.log('Upserting user into Neon database...');
  const result = await upsertUser({
    username,
    passwordHash,
    role,
    status: 'active',
  });

  console.log('\n✓ User account successfully configured in Neon PostgreSQL!');
  console.log(`  - Username: ${result.username}`);
  console.log(`  - Role:     ${result.role}`);
  console.log('  - Status:   active');
  console.log('\nReady for database-backed authentication.\n');
}

main()
  .catch((err) => {
    console.error('\nSeeding failed:', err.message);
    process.exit(1);
  })
  .finally(async () => {
    const pool = getPool();
    if (pool) {
      await pool.end().catch(() => {});
    }
  });
