import type { ApiRequest, ApiResponse, SessionPayload } from './types';
import { parseCookies } from './cookies';
import { SESSION_COOKIE_NAME, verifySessionToken } from './crypto';

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
 * Call this at the start of any protected API route.
 * If authentication fails or is missing, it sends an appropriate 401 response and returns null.
 */
export function requireAuth(req: ApiRequest, res: ApiResponse): SessionPayload | null {
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

  return session;
}
