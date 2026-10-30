import type { ApiRequest, ApiResponse } from '../_lib/types';
import { serializeExpiredCookie } from '../_lib/cookies';
import { SESSION_COOKIE_NAME } from '../_lib/crypto';
import { validateCsrf } from '../_lib/auth-guard';

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

  // Clear browser session cookie.
  // Note: True persistent token revocation will be verified against the Neon DB sessions table.
  const expiredCookie = serializeExpiredCookie(SESSION_COOKIE_NAME, {
    path: '/',
    httpOnly: true,
    sameSite: 'Strict',
  });

  res.setHeader('Set-Cookie', expiredCookie);

  return res.status(200).json({
    success: true,
    message: 'Logged out successfully (cookie cleared)',
  });
}
