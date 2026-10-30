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
import {
  checkDbRateLimit,
  recordDbFailedLogin,
  resetDbRateLimit,
  registerDbSession,
} from '../_lib/db/client';

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

  // Extract client IP address for persistent rate limiting
  const rawForwarded = req.headers['x-forwarded-for'];
  const clientIp = (Array.isArray(rawForwarded) ? rawForwarded[0] : rawForwarded)?.split(',')[0].trim() ||
    req.socket?.remoteAddress ||
    '127.0.0.1';

  // 1. Persistent Database Rate Limit Check
  const dbRateLimit = await checkDbRateLimit(clientIp);
  if (!dbRateLimit.allowed && dbRateLimit.retryAfterSeconds) {
    res.setHeader('Retry-After', dbRateLimit.retryAfterSeconds.toString());
    return res.status(429).json({
      error: 'Too Many Requests',
      message: `Account access locked due to repeated failed logins. Please wait ${dbRateLimit.retryAfterSeconds} seconds before trying again.`,
      retryAfterSeconds: dbRateLimit.retryAfterSeconds,
    });
  }

  // 2. Cookie-based UI Friction (Defense in Depth)
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

  // 3. Validate username and passphrase
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
    // Record persistent failure in database
    await recordDbFailedLogin(clientIp);

    // Record failure in signed tamper-proof cookie
    const updatedFails = bfState.fails + 1;
    const newBfCookie = serializeCookie(
      BRUTE_FORCE_COOKIE_NAME,
      serializeBruteForceState({ fails: updatedFails, lastAttempt: now }),
      {
        maxAge: 3600,
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

  // 4. Successful login:
  // Reset persistent DB rate limit for this IP
  await resetDbRateLimit(clientIp);

  // Issue cryptographically signed session token
  const { token: sessionToken, payload } = createSignedSessionToken(
    username.trim(),
    DEFAULT_SESSION_DURATION,
  );

  // Register session in persistent Neon database
  const userAgent = Array.isArray(req.headers['user-agent'])
    ? req.headers['user-agent'][0]
    : req.headers['user-agent'];

  await registerDbSession({
    id: payload.jti,
    userId: payload.sub,
    expiresAt: new Date(payload.exp * 1000),
    userAgent,
    ipAddress: clientIp,
  });

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
