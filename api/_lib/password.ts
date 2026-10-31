import { hash, verify } from '@node-rs/argon2';

/**
 * Standard OWASP-recommended parameters for Argon2id:
 * - Algorithm: 2 (Argon2id - hybrid memory-hard and side-channel resistant)
 * - Memory cost: 64 MB (65536 KiB)
 * - Time cost: 3 iterations
 * - Parallelism: 4 threads
 */
export const ARGON2_OPTIONS = {
  algorithm: 2, // 2 = Algorithm.Argon2id
  memoryCost: 65536,
  timeCost: 3,
  parallelFactor: 4,
};

// Pre-computed dummy Argon2id hash for constant-time comparison on non-existent users
// Prevents username enumeration through timing attacks
const DUMMY_HASH =
  '$argon2id$v=19$m=65536,t=3,p=4$6FvFkY9N2bV/5QvK1X2hvw$oFhVq+6e2oM+9Kq4Xl+e9pU+4kQ+4e2oM+9Kq4Xl+e8';

/**
 * Hashes a plaintext password using Argon2id.
 */
export async function hashPassword(plaintext: string): Promise<string> {
  if (!plaintext || typeof plaintext !== 'string' || plaintext.length < 8) {
    throw new Error('Password must be at least 8 characters long.');
  }

  return await hash(plaintext, ARGON2_OPTIONS);
}

/**
 * Verifies a plaintext password against an Argon2id PHC hash.
 * Returns false safely if the hash format is invalid or verification fails.
 */
export async function verifyPassword(plaintext: string, hashString: string): Promise<boolean> {
  if (!plaintext || !hashString || typeof plaintext !== 'string' || typeof hashString !== 'string') {
    return false;
  }

  try {
    return await verify(hashString, plaintext);
  } catch (err: any) {
    // Malformed hash or parsing failure
    return false;
  }
}

/**
 * Executes a dummy verification to provide timing defense against username enumeration
 * when an account does not exist.
 */
export async function dummyVerifyPassword(inputPass = 'dummy_password_input'): Promise<boolean> {
  try {
    await verify(DUMMY_HASH, inputPass);
  } catch {
    // Ignore dummy verification result
  }
  return false;
}
