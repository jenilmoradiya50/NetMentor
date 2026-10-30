import type { ApiRequest, ApiResponse, SessionPayload } from './types';
import { parseCookies } from './cookies';
import { SESSION_COOKIE_NAME, verifySessionToken } from './crypto';
import { isDbSessionValid } from './db/client';

/**
 * Validates CSRF mitigation on state-changing requests (POST, PUT, DELETE, PATCH).
 * Enforces mandatory custom header ('X-NetMentor-Request: 1') AND verifies that
 * the Origin header matches the Host header when present.
 */
export function validateCsrf(req: ApiRequest): boolean {
  const method = (req.method || 'GET').toUpperCase();
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    return true;
  }

  // 1. Mandatory custom header requirement
  const customHeader = req.headers['x-netmentor-request'];
  if (customHeader !== '1') {
    return false;
  }

  // 2. Validate Origin against Host when Origin is present
  const origin = req.headers['origin'];
  const host = req.headers['host'];
  if (origin && host) {
    try {
      const originUrl = new URL(origin);
      if (originUrl.host !== host) {
        return false;
      }
    } catch {
      return false;
    }
  }

  return true;
}

/**
 * Server-side Authentication Guard.
 * Validates cryptographically signed session token AND checks Neon PostgreSQL
 * to ensure the session has not been revoked on logout.
 */
export async function requireAuth(req: ApiRequest, res: ApiResponse): Promise<SessionPayload | null> {
  // 1. Enforce strict CSRF check for mutations
  if (!validateCsrf(req)) {
    res.status(403).json({
      error: 'Forbidden',
      message: 'Cross-Site Request Forgery validation failed: Invalid or missing security headers.',
    });
    return null;
  }

  // 2. Parse incoming cookies
  const cookies = req.cookies || parseCookies(req.headers.cookie);
  const sessionToken = cookies[SESSION_COOKIE_NAME];

  if (!sessionToken) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication required. Please log in.',
    });
    return null;
  }

  // 3. Cryptographically verify signature and expiration
  const session = verifySessionToken(sessionToken);
  if (!session) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Session has expired or is invalid. Please log in again.',
    });
    return null;
  }

  // 4. Verify persistent revocation status in database
  const isValid = await isDbSessionValid(session.jti);
  if (!isValid) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Session has been revoked or expired. Please log in again.',
    });
    return null;
  }

  return session;
}
