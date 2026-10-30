import type { ApiRequest, ApiResponse } from '../_lib/types';
import { parseCookies, serializeExpiredCookie } from '../_lib/cookies';
import { SESSION_COOKIE_NAME, verifySessionToken } from '../_lib/crypto';
import { validateCsrf } from '../_lib/auth-guard';
import { revokeDbSession } from '../_lib/db/client';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed', message: 'Only POST is supported.' });
  }

  // Validate CSRF
  if (!validateCsrf(req)) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'CSRF validation failed: Missing or invalid security headers.',
    });
  }

  // Extract session token
  const cookies = req.cookies || parseCookies(req.headers.cookie);
  const sessionToken = cookies[SESSION_COOKIE_NAME];

  if (sessionToken) {
    const session = verifySessionToken(sessionToken);
    if (session?.jti) {
      // 1. Persistent server-side revocation: mark session revoked in Neon PostgreSQL
      await revokeDbSession(session.jti);
    }
  }

  // 2. Invalidate browser cookie
  const expiredCookie = serializeExpiredCookie(SESSION_COOKIE_NAME, {
    path: '/',
    httpOnly: true,
    sameSite: 'Strict',
  });

  res.setHeader('Set-Cookie', expiredCookie);

  return res.status(200).json({
    success: true,
    message: 'Logged out successfully (session revoked)',
  });
}
