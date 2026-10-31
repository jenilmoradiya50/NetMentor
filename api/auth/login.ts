import type { ApiRequest, ApiResponse, UserRole } from '../_lib/types.js';
import { parseCookies, serializeCookie, serializeExpiredCookie } from '../_lib/cookies.js';
import {
  SESSION_COOKIE_NAME,
  BRUTE_FORCE_COOKIE_NAME,
  DEFAULT_SESSION_DURATION,
  createSignedSessionToken,
  verifyCredentials,
  parseBruteForceState,
  serializeBruteForceState,
  calculateRequiredBackoffMs,
} from '../_lib/crypto.js';
import { validateCsrf } from '../_lib/auth-guard.js';
import {
  checkDbRateLimit,
  recordDbFailedLogin,
  resetDbRateLimit,
  registerDbSession,
  findUserByUsername,
  updateUserLastLogin,
} from '../_lib/db/client.js';
import { verifyPassword, dummyVerifyPassword } from '../_lib/password.js';

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

  // Extract client IP address behind Vercel Edge proxy
  const rawForwarded = req.headers['x-forwarded-for'];
  const forwardedIp = (Array.isArray(rawForwarded) ? rawForwarded[0] : rawForwarded)?.split(',')[0].trim();
  const clientIp = (req.headers['x-real-ip'] as string) || forwardedIp || req.socket?.remoteAddress || '127.0.0.1';

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

  // 3. User Authentication:
  // Check Neon PostgreSQL `users` table first, with temporary fallback to legacy env admin
  let authenticatedUser: { id: string; username: string; role: UserRole } | null = null;
  let isSuspended = false;

  try {
    const dbUser = await findUserByUsername(username);
    if (dbUser) {
      if (dbUser.status !== 'active') {
        isSuspended = true;
      } else {
        const passwordMatches = await verifyPassword(passwordInput, dbUser.passwordHash);
        if (passwordMatches) {
          authenticatedUser = {
            id: dbUser.id,
            username: dbUser.username,
            role: (dbUser.role as UserRole) || 'user',
          };
          // Asynchronously update last_login_at
          updateUserLastLogin(dbUser.id).catch(() => {});
        }
      }
    } else {
      // User not found in database: check legacy environment fallback (during migration period)
      const legacyAdminUser = process.env.ADMIN_USERNAME || 'jenilmoradiya50';
      const hasLegacyPass = Boolean(process.env.ADMIN_PASSPHRASE || process.env.ADMIN_ACCESS_KEY);

      if (hasLegacyPass && username && username.trim().toLowerCase() === legacyAdminUser.toLowerCase()) {
        try {
          const legacyValid = verifyCredentials(username, passwordInput);
          if (legacyValid) {
            authenticatedUser = {
              id: legacyAdminUser,
              username: legacyAdminUser,
              role: 'admin',
            };
          }
        } catch {
          // If legacy secret check fails, proceed to rejection
        }
      } else {
        // Run dummy verification to prevent timing attack enumeration
        await dummyVerifyPassword(passwordInput);
      }
    }
  } catch (err: any) {
    // FAIL CLOSED: If DB fails in production, never bypass authentication
    if (process.env.NODE_ENV === 'production' || process.env.VERCEL) {
      console.error('[Auth Error]: Database query failed during authentication. Failing closed.');
      return res.status(500).json({
        error: 'ServerError',
        message: 'Authentication service temporarily unavailable.',
      });
    }
    // Local development fallback only if DB is unconfigured
    console.warn('[Auth Warning]: Database unconfigured in development. Trying legacy fallback.');
    try {
      if (verifyCredentials(username, passwordInput)) {
        authenticatedUser = {
          id: username.trim(),
          username: username.trim(),
          role: 'admin',
        };
      }
    } catch {
      return res.status(500).json({
        error: 'ServerError',
        message: 'Authentication service configuration error.',
      });
    }
  }

  // Handle suspended accounts
  if (isSuspended) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Account has been suspended. Please contact administration.',
    });
  }

  if (!authenticatedUser) {
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

  // Issue cryptographically signed session token with role from database
  const { token: sessionToken, payload } = createSignedSessionToken(
    authenticatedUser.username,
    authenticatedUser.role,
    DEFAULT_SESSION_DURATION,
  );

  // Register session in persistent Neon database
  const userAgent = Array.isArray(req.headers['user-agent'])
    ? req.headers['user-agent'][0]
    : req.headers['user-agent'];

  try {
    await registerDbSession({
      id: payload.jti,
      userId: authenticatedUser.id,
      expiresAt: new Date(payload.exp * 1000),
      userAgent,
      ipAddress: clientIp,
    });
  } catch (err: any) {
    // Strict production fail-closed: if DB cannot record session, fail login safely
    console.error('[Session Registration Error]: Failed to register session in database.');
    return res.status(500).json({
      error: 'DatabaseError',
      message: 'Authentication service temporarily unavailable. Please try again later.',
    });
  }

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
    role: authenticatedUser.role,
    user: authenticatedUser.username,
    expiresIn: DEFAULT_SESSION_DURATION,
  });
}
