import type { ApiRequest, ApiResponse } from '../_lib/types';
import { parseCookies, serializeCookie, serializeExpiredCookie } from '../_lib/cookies';
import {
  SESSION_COOKIE_NAME,
  BRUTE_FORCE_COOKIE_NAME,
  DEFAULT_SESSION_DURATION,
  createSignedSessionToken,
  verifyCredentials,
  parseBruteForceState,
  serializeBruteForceState,
  calculateRequiredBackoffMs,
} from '../_lib/crypto';
import { validateCsrf } from '../_lib/auth-guard';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  // Only accept POST
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed', message: 'Only POST is supported.' });
  }

  // Validate strict CSRF & Origin
  if (!validateCsrf(req)) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'CSRF validation failed: Missing or invalid security headers.',
    });
  }

  // Parse body
  const body = req.body || {};
  const { username, passphrase, password } = body;
  const passwordInput = passphrase || password;

  // Extract brute-force tracking state from signed cookie
  // (Provides client friction; persistent serverless rate limiting will be enforced via DB)
  const cookies = req.cookies || parseCookies(req.headers.cookie);
  const bfState = parseBruteForceState(cookies[BRUTE_FORCE_COOKIE_NAME]);
  const now = Date.now();

  const requiredBackoffMs = calculateRequiredBackoffMs(bfState.fails);
  const timeSinceLastAttempt = now - bfState.lastAttempt;

  if (requiredBackoffMs > 0 && timeSinceLastAttempt < requiredBackoffMs) {
    const remainingSec = Math.ceil((requiredBackoffMs - timeSinceLastAttempt) / 1000);
    res.setHeader('Retry-After', remainingSec.toString());
    return res.status(429).json({
      error: 'Too Many Requests',
      message: `Too many failed login attempts. Please wait ${remainingSec} second${remainingSec === 1 ? '' : 's'} before trying again.`,
      retryAfterSeconds: remainingSec,
    });
  }

  // Validate username and passphrase
  let isValid = false;
  try {
    isValid = verifyCredentials(username, passwordInput);
  } catch (err: any) {
    console.error('[Auth Error]:', err.message);
    return res.status(500).json({
      error: 'ServerError',
      message: 'Server configuration error. Please ensure server environment variables are configured.',
    });
  }

  if (!isValid) {
    // Record failure in signed tamper-proof cookie
    const updatedFails = bfState.fails + 1;
    const newBfCookie = serializeCookie(
      BRUTE_FORCE_COOKIE_NAME,
      serializeBruteForceState({ fails: updatedFails, lastAttempt: now }),
      {
        maxAge: 3600, // 1 hour
        httpOnly: true,
        sameSite: 'Strict',
        path: '/api/auth',
      },
    );

    res.setHeader('Set-Cookie', newBfCookie);

    const nextBackoffMs = calculateRequiredBackoffMs(updatedFails);
    const backoffSec = Math.ceil(nextBackoffMs / 1000);

    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid username or password.',
      failedAttempts: updatedFails,
      backoffSeconds: backoffSec > 0 ? backoffSec : 0,
    });
  }

  // Successful login:
  // 1. Clear brute-force tracking cookie
  // 2. Issue cryptographically signed session token in HttpOnly cookie (4-hour duration)
  const sessionToken = createSignedSessionToken(username.trim(), DEFAULT_SESSION_DURATION);

  const sessionCookie = serializeCookie(SESSION_COOKIE_NAME, sessionToken, {
    maxAge: DEFAULT_SESSION_DURATION,
    httpOnly: true,
    sameSite: 'Strict',
    path: '/',
  });

  const clearBfCookie = serializeExpiredCookie(BRUTE_FORCE_COOKIE_NAME, {
    path: '/api/auth',
  });

  res.setHeader('Set-Cookie', [sessionCookie, clearBfCookie]);

  return res.status(200).json({
    success: true,
    message: 'Authenticated successfully',
    role: 'admin',
    user: username.trim(),
    expiresIn: DEFAULT_SESSION_DURATION,
  });
}
