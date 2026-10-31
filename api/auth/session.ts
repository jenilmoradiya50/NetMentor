import type { ApiRequest, ApiResponse } from '../_lib/types.js';
import { parseCookies } from '../_lib/cookies.js';
import { SESSION_COOKIE_NAME, verifySessionToken } from '../_lib/crypto.js';
import { validateDbSession } from '../_lib/db/client.js';

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

  // Persistent database revocation, account suspension, and live role check
  const validation = await validateDbSession(session.jti);
  if (!validation.valid) {
    if (validation.userStatus === 'suspended') {
      return res.status(403).json({
        authenticated: false,
        message: 'Account has been suspended. Please contact administration.',
      });
    }
    return res.status(401).json({
      authenticated: false,
      message: 'Session has been revoked or expired.',
    });
  }

  const effectiveRole = validation.currentRole || session.role;

  return res.status(200).json({
    authenticated: true,
    user: session.sub,
    role: effectiveRole,
    expiresAt: session.exp,
  });
}
