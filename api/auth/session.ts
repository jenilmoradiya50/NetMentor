import type { ApiRequest, ApiResponse } from '../_lib/types';
import { parseCookies } from '../_lib/cookies';
import { SESSION_COOKIE_NAME, verifySessionToken } from '../_lib/crypto';
import { isDbSessionValid } from '../_lib/db/client';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method Not Allowed', message: 'Only GET is supported.' });
  }

  const cookies = req.cookies || parseCookies(req.headers.cookie);
  const sessionToken = cookies[SESSION_COOKIE_NAME];

  if (!sessionToken) {
    return res.status(401).json({
      authenticated: false,
      message: 'No active session found.',
    });
  }

  const session = verifySessionToken(sessionToken);
  if (!session) {
    return res.status(401).json({
      authenticated: false,
      message: 'Session has expired or is invalid.',
    });
  }

  // Persistent database revocation check
  const isValid = await isDbSessionValid(session.jti);
  if (!isValid) {
    return res.status(401).json({
      authenticated: false,
      message: 'Session has been revoked or expired.',
    });
  }

  return res.status(200).json({
    authenticated: true,
    user: session.sub,
    role: session.role,
    expiresAt: session.exp,
  });
}
