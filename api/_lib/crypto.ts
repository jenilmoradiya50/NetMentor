import crypto from 'node:crypto';
import type { SessionPayload, BruteForceState, UserRole } from './types';

export const SESSION_COOKIE_NAME = 'netmentor_session';
export const BRUTE_FORCE_COOKIE_NAME = 'netmentor_sec_state';

// 4 hours in seconds (reduced from 7 days as approved)
export const DEFAULT_SESSION_DURATION = 4 * 60 * 60;

/**
 * Retrieves the cryptographic secret from environment variables.
 * Fails safely across all environments (production, preview, and local)
 * if missing or under 32 characters.
 */
export function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      'CRITICAL CONFIGURATION ERROR: SESSION_SECRET is missing or under 32 characters. ' +
        'Please configure SESSION_SECRET in your environment variables or .env.local.',
    );
  }
  return secret;
}

/**
 * Retrieves the configured administrative username.
 * Defaults to 'jenilmoradiya50' if not overridden.
 */
export function getAdminUsername(): string {
  return process.env.ADMIN_USERNAME || 'jenilmoradiya50';
}

/**
 * Retrieves the configured administrative passphrase.
 * Fails safely if not configured. Never provides hardcoded fallback credentials.
 */
export function getAdminPassphrase(): string {
  const passphrase = process.env.ADMIN_PASSPHRASE || process.env.ADMIN_ACCESS_KEY;
  if (!passphrase || passphrase.trim().length === 0) {
    throw new Error(
      'CRITICAL CONFIGURATION ERROR: ADMIN_PASSPHRASE is not configured in the server environment. ' +
        'Please configure ADMIN_PASSPHRASE in your environment variables or .env.local.',
    );
  }
  return passphrase;
}

/**
 * Verifies both username and passphrase using constant-time PBKDF2 comparisons.
 * Uses a salt derived from the server session secret to prevent rainbow table attacks.
 */
export function verifyCredentials(inputUser?: string, inputPass?: string): boolean {
  if (!inputUser || !inputPass || typeof inputUser !== 'string' || typeof inputPass !== 'string') {
    return false;
  }

  const expectedUser = getAdminUsername();
  const expectedPass = getAdminPassphrase();
  const secret = getSessionSecret();

  // Derive cryptographic salt from server secret
  const salt = crypto.createHmac('sha256', secret).update('netmentor_auth_salt_v2').digest();
  const iterations = 50000;
  const keyLength = 32;

  // Constant-time username hash
  const inputUserHash = crypto.pbkdf2Sync(inputUser.trim(), salt, 10000, keyLength, 'sha256');
  const expectedUserHash = crypto.pbkdf2Sync(expectedUser.trim(), salt, 10000, keyLength, 'sha256');
  const userMatches = crypto.timingSafeEqual(inputUserHash, expectedUserHash);

  // Constant-time passphrase hash
  const inputPassHash = crypto.pbkdf2Sync(inputPass, salt, iterations, keyLength, 'sha256');
  const expectedPassHash = crypto.pbkdf2Sync(expectedPass, salt, iterations, keyLength, 'sha256');
  const passMatches = crypto.timingSafeEqual(inputPassHash, expectedPassHash);

  return userMatches && passMatches;
}

/**
 * Creates a cryptographically signed session token:
 * format: v1.<payload_base64url>.<hmac_signature_base64url>
 */
export function createSignedSessionToken(
  username = getAdminUsername(),
  role: UserRole = 'admin',
  durationSeconds = DEFAULT_SESSION_DURATION,
): { token: string; payload: SessionPayload } {
  const secret = getSessionSecret();
  const now = Math.floor(Date.now() / 1000);

  const payload: SessionPayload = {
    sub: username,
    role,
    iat: now,
    exp: now + durationSeconds,
    jti: crypto.randomBytes(16).toString('hex'),
  };

  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(`v1.${payloadB64}`);
  const signatureB64 = hmac.digest('base64url');

  return {
    token: `v1.${payloadB64}.${signatureB64}`,
    payload,
  };
}

/**
 * Verifies a signed session token. Returns the payload if valid and not expired, null otherwise.
 */
export function verifySessionToken(token?: string): SessionPayload | null {
  if (!token || typeof token !== 'string') return null;

  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== 'v1') return null;

  const [, payloadB64, signatureB64] = parts;
  const secret = getSessionSecret();

  // Re-compute signature
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(`v1.${payloadB64}`);
  const expectedSignatureB64 = hmac.digest('base64url');

  // Constant-time signature comparison to eliminate timing attacks
  const sigBuffer = Buffer.from(signatureB64);
  const expectedBuffer = Buffer.from(expectedSignatureB64);

  if (sigBuffer.length !== expectedBuffer.length) {
    return null;
  }

  if (!crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as SessionPayload;
    const now = Math.floor(Date.now() / 1000);

    // Validate expiration
    if (typeof payload.exp !== 'number' || payload.exp <= now) {
      return null;
    }

    if (payload.role !== 'admin' && payload.role !== 'user') {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Parses brute-force tracking state from signed cookie.
 * NOTE: As documented in the security audit, cookie-based tracking provides client-level
 * friction but CANNOT serve as server-side rate-limiting against automated attackers.
 * True distributed rate limiting will be enforced via persistent storage.
 */
export function parseBruteForceState(signedCookieValue?: string): BruteForceState {
  if (!signedCookieValue) {
    return { fails: 0, lastAttempt: 0 };
  }

  const parts = signedCookieValue.split('.');
  if (parts.length !== 2) {
    return { fails: 0, lastAttempt: 0 };
  }

  const [dataB64, sigB64] = parts;
  const secret = getSessionSecret();

  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(`bf.${dataB64}`);
  const expectedSig = hmac.digest('base64url');

  const sigBuf = Buffer.from(sigB64);
  const expBuf = Buffer.from(expectedSig);

  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return { fails: 0, lastAttempt: 0 };
  }

  try {
    const data = JSON.parse(Buffer.from(dataB64, 'base64url').toString('utf8'));
    return {
      fails: Number.isInteger(data.fails) ? data.fails : 0,
      lastAttempt: Number.isInteger(data.lastAttempt) ? data.lastAttempt : 0,
    };
  } catch {
    return { fails: 0, lastAttempt: 0 };
  }
}

/**
 * Creates a signed brute-force tracking token.
 */
export function serializeBruteForceState(state: BruteForceState): string {
  const secret = getSessionSecret();
  const dataB64 = Buffer.from(JSON.stringify(state)).toString('base64url');

  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(`bf.${dataB64}`);
  const sigB64 = hmac.digest('base64url');

  return `${dataB64}.${sigB64}`;
}

/**
 * Calculates exponential backoff in milliseconds:
 * 0-2 fails: 0ms
 * 3 fails: 2s
 * 4 fails: 4s
 * 5 fails: 8s
 * 6+ fails: 16s (max 30s)
 */
export function calculateRequiredBackoffMs(fails: number): number {
  if (fails <= 2) return 0;
  const delaySec = Math.min(30, Math.pow(2, fails - 2));
  return delaySec * 1000;
}
