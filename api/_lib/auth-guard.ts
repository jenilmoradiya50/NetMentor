import type { ApiRequest, ApiResponse, SessionPayload, UserRole } from './types.js';
import { parseCookies } from './cookies.js';
import { SESSION_COOKIE_NAME, verifySessionToken } from './crypto.js';
import { validateDbSession } from './db/client.js';

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
 * Server-side Authentication & Authorization Guard.
 * Validates cryptographically signed session token AND verifies with Neon PostgreSQL:
 * - Checks persistent session revocation.
 * - Confirms user account is active (suspended users lose access immediately).
 * - Dynamically updates session with current database role, preventing stale privileges.
 * - Enforces requiredRole if specified (e.g. 'admin').
 */
export async function requireAuth(
  req: ApiRequest,
  res: ApiResponse,
  requiredRole?: UserRole,
): Promise<SessionPayload | null> {
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

  // 4. Verify persistent revocation status, account status, and live role in database
  const validation = await validateDbSession(session.jti);
  if (!validation.valid) {
    if (validation.userStatus === 'suspended') {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Account has been suspended. Please contact administration.',
      });
      return null;
    }
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Session has been revoked or expired. Please log in again.',
    });
    return null;
  }

  // 5. Apply live role and user ID from database to prevent stale privilege retention
  if (validation.currentRole) {
    session.role = validation.currentRole;
  }
  session.userId = validation.userId || session.sub;

  // 6. Enforce role-based access control if an endpoint requires a specific role
  if (requiredRole && session.role !== requiredRole) {
    res.status(403).json({
      error: 'Forbidden',
      message: `Access denied: Requires ${requiredRole} privileges.`,
    });
    return null;
  }

  return session;
}
