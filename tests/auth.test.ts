import { hashPassword, verifyPassword, dummyVerifyPassword } from '../api/_lib/password.ts';
import {
  createSignedSessionToken,
  verifySessionToken,
  SESSION_COOKIE_NAME,
  BRUTE_FORCE_COOKIE_NAME,
} from '../api/_lib/crypto.ts';
import { requireAuth, validateCsrf } from '../api/_lib/auth-guard.ts';
import loginHandler from '../api/auth/login.ts';
import sessionHandler from '../api/auth/session.ts';
import logoutHandler from '../api/auth/logout.ts';
import type { ApiRequest, ApiResponse, UserRole } from '../api/_lib/types.ts';
import * as client from '../api/_lib/db/client.ts';

// Ensure SESSION_SECRET is set for testing
process.env.SESSION_SECRET = 'test-session-secret-at-least-32-characters-long-123456';
process.env.NODE_ENV = 'development';

// In-memory mock database store for comprehensive testing
const mockUsers = new Map<string, {
  id: string;
  username: string;
  passwordHash: string;
  role: UserRole;
  status: string;
}>();

const mockSessions = new Map<string, {
  id: string;
  userId: string;
  expiresAt: Date;
  revokedAt: Date | null;
}>();

// Helper to mock HTTP request/response
function createMockHttp(options: {
  method?: string;
  headers?: Record<string, string>;
  body?: any;
  cookies?: Record<string, string>;
}) {
  let statusCode = 200;
  const headers: Record<string, string | string[]> = {};
  let responseData: any = null;

  const req: ApiRequest = {
    method: options.method || 'POST',
    headers: { ...options.headers },
    body: options.body || {},
    cookies: options.cookies || undefined,
  };

  const res: ApiResponse = {
    statusCode: 200,
    status(code: number) {
      statusCode = code;
      this.statusCode = code;
      return this;
    },
    json(data: any) {
      responseData = data;
      return this;
    },
    setHeader(key: string, val: string | string[]) {
      headers[key.toLowerCase()] = val;
      return this;
    },
    getHeader(key: string) {
      return headers[key.toLowerCase()];
    },
    end(data?: any) {
      if (data && !responseData) responseData = data;
      return this;
    },
  };

  return {
    req,
    res,
    getStatus: () => statusCode,
    getData: () => responseData,
    getHeaders: () => headers,
  };
}

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${msg}`);
  }
}

async function runTests() {
  console.log('=== STARTING NETMENTOR AUTHENTICATION TEST SUITE ===\n');

  // 1. Password Hashing Tests (Argon2id)
  console.log('1. Testing Argon2id Password Hashing:');
  const testPass = 'AdminSecretPassphrase2026!';
  const hash = await hashPassword(testPass);
  assert(hash.startsWith('$argon2id$'), 'Hash must start with $argon2id$');
  assert(await verifyPassword(testPass, hash), 'Correct password must verify');
  assert(!(await verifyPassword('WrongPassword!', hash)), 'Incorrect password must fail');
  assert(!(await verifyPassword('', hash)), 'Empty password must fail');
  assert(!(await dummyVerifyPassword()), 'Dummy verify must always return false');
  console.log('   ✓ Argon2id hashing, verification, and dummy timing defense verified.');

  // Setup mock database accounts
  const adminHash = await hashPassword('AdminPass2026!');
  const userHash = await hashPassword('UserPass2026!');
  const suspendedHash = await hashPassword('SuspendedPass2026!');

  mockUsers.set('jenilmoradiya50@admin', {
    id: 'user-admin-1',
    username: 'jenilmoradiya50@admin',
    passwordHash: adminHash,
    role: 'admin',
    status: 'active',
  });

  mockUsers.set('jenilmoradiya50', {
    id: 'user-standard-1',
    username: 'jenilmoradiya50',
    passwordHash: userHash,
    role: 'user',
    status: 'active',
  });

  mockUsers.set('suspended_user', {
    id: 'user-suspended-1',
    username: 'suspended_user',
    passwordHash: suspendedHash,
    role: 'user',
    status: 'suspended',
  });

  // Configure test mock store
  client.__setTestMockStore({
    findUserByUsername: async (uname: string) => {
      return mockUsers.get(uname.trim().toLowerCase()) || null;
    },
    registerDbSession: async (sess: any) => {
      mockSessions.set(sess.id, {
        id: sess.id,
        userId: sess.userId,
        expiresAt: sess.expiresAt,
        revokedAt: null,
      });
    },
    validateDbSession: async (sessionId: string) => {
      const s = mockSessions.get(sessionId);
      if (!s || s.revokedAt || s.expiresAt < new Date()) {
        return { valid: false };
      }
      const u = Array.from(mockUsers.values()).find(user => user.id === s.userId || user.username === s.userId);
      if (u) {
        if (u.status !== 'active') {
          return { valid: false, userStatus: u.status };
        }
        return { valid: true, currentRole: u.role, userStatus: u.status, userId: u.id };
      }
      return { valid: true, currentRole: 'admin', userStatus: 'active' };
    },
    revokeDbSession: async (sessionId: string) => {
      const s = mockSessions.get(sessionId);
      if (s) {
        s.revokedAt = new Date();
      }
    },
  });

  // 2. CSRF Mitigation Tests
  console.log('\n2. Testing CSRF Protection:');
  const csrfReq = createMockHttp({
    method: 'POST',
    headers: {}, // Missing custom header
    body: { username: 'jenilmoradiya50@admin', passphrase: 'AdminPass2026!' },
  });
  await loginHandler(csrfReq.req, csrfReq.res);
  assert(csrfReq.getStatus() === 403, 'Missing CSRF header must return 403');
  console.log('   ✓ CSRF missing header rejected with 403 Forbidden.');

  // 3. Database Admin Login
  console.log('\n3. Testing Database Admin Login (jenilmoradiya50@admin):');
  const adminReq = createMockHttp({
    method: 'POST',
    headers: { 'x-netmentor-request': '1' },
    body: { username: 'jenilmoradiya50@admin', passphrase: 'AdminPass2026!' },
  });
  await loginHandler(adminReq.req, adminReq.res);
  assert(adminReq.getStatus() === 200, `Admin login must return 200, got ${adminReq.getStatus()}`);
  assert(adminReq.getData()?.success === true, 'Response must indicate success');
  assert(adminReq.getData()?.role === 'admin', 'Admin account must receive role admin');
  const adminCookie = adminReq.getHeaders()['set-cookie'];
  assert(Boolean(adminCookie), 'Session cookie must be set');
  console.log('   ✓ Admin login authenticated successfully with role "admin".');

  // Extract session token from cookie
  const cookieStr = Array.isArray(adminCookie) ? adminCookie.find(c => c.startsWith('netmentor_session=')) : adminCookie;
  const adminToken = cookieStr?.split(';')[0]?.replace('netmentor_session=', '') || '';

  // 4. Database Standard User Login
  console.log('\n4. Testing Database Standard User Login (jenilmoradiya50):');
  const userReq = createMockHttp({
    method: 'POST',
    headers: { 'x-netmentor-request': '1' },
    body: { username: 'jenilmoradiya50', passphrase: 'UserPass2026!' },
  });
  await loginHandler(userReq.req, userReq.res);
  assert(userReq.getStatus() === 200, 'User login must return 200');
  assert(userReq.getData()?.role === 'user', 'Standard user must receive role user');
  const userCookie = userReq.getHeaders()['set-cookie'];
  const userCookieStr = Array.isArray(userCookie) ? userCookie.find(c => c.startsWith('netmentor_session=')) : userCookie;
  const userToken = userCookieStr?.split(';')[0]?.replace('netmentor_session=', '') || '';
  console.log('   ✓ Standard user login authenticated successfully with role "user".');

  // 5. Incorrect Password
  console.log('\n5. Testing Incorrect Password:');
  const badReq = createMockHttp({
    method: 'POST',
    headers: { 'x-netmentor-request': '1' },
    body: { username: 'jenilmoradiya50', passphrase: 'IncorrectPassword999!' },
  });
  await loginHandler(badReq.req, badReq.res);
  assert(badReq.getStatus() === 401, 'Bad password must return 401');
  assert(badReq.getData()?.error === 'Unauthorized', 'Error must be Unauthorized');
  console.log('   ✓ Incorrect password rejected with 401 Unauthorized.');

  // 6. Unknown Username (Timing defense & no enumeration)
  console.log('\n6. Testing Unknown Username:');
  const unknownReq = createMockHttp({
    method: 'POST',
    headers: { 'x-netmentor-request': '1' },
    body: { username: 'non_existent_user_xyz', passphrase: 'SomePassword123!' },
  });
  await loginHandler(unknownReq.req, unknownReq.res);
  assert(unknownReq.getStatus() === 401, 'Unknown user must return 401');
  assert(unknownReq.getData()?.message === 'Invalid username or password.', 'Generic error message enforced');
  console.log('   ✓ Unknown username rejected without user existence disclosure.');

  // 7. Suspended Account Rejection
  console.log('\n7. Testing Suspended Account:');
  const suspReq = createMockHttp({
    method: 'POST',
    headers: { 'x-netmentor-request': '1' },
    body: { username: 'suspended_user', passphrase: 'SuspendedPass2026!' },
  });
  await loginHandler(suspReq.req, suspReq.res);
  assert(suspReq.getStatus() === 403, 'Suspended account must return 403 Forbidden');
  console.log('   ✓ Suspended user login rejected with 403 Forbidden.');

  // 8. Role Enforcement & Authorization Guard
  console.log('\n8. Testing Role Authorization:');
  // Admin accessing admin-only check
  const adminGuardReq = createMockHttp({
    method: 'GET',
    headers: { cookie: `netmentor_session=${adminToken}` },
  });
  const adminSession = await requireAuth(adminGuardReq.req, adminGuardReq.res, 'admin');
  assert(adminSession !== null, 'Admin must pass admin authorization check');
  assert(adminSession.role === 'admin', 'Session role must be admin');

  // Standard user attempting to access admin-only check
  const userGuardReq = createMockHttp({
    method: 'GET',
    headers: { cookie: `netmentor_session=${userToken}` },
  });
  const forbiddenSession = await requireAuth(userGuardReq.req, userGuardReq.res, 'admin');
  assert(forbiddenSession === null, 'Standard user must be rejected from admin check');
  assert(userGuardReq.getStatus() === 403, 'Rejection status must be 403 Forbidden');
  console.log('   ✓ Standard user strictly blocked from administrative endpoint (403 Forbidden).');

  // 9. Stale Session & Demotion / Suspension Invalidation
  console.log('\n9. Testing Stale Session & Status Invalidation:');
  // Demote user in database from admin to user
  const adminUserRecord = mockUsers.get('jenilmoradiya50@admin')!;
  adminUserRecord.role = 'user'; // Demote

  const demotedGuardReq = createMockHttp({
    method: 'GET',
    headers: { cookie: `netmentor_session=${adminToken}` },
  });
  const demotedSession = await requireAuth(demotedGuardReq.req, demotedGuardReq.res, 'admin');
  assert(demotedSession === null, 'Demoted user must immediately lose admin access');
  assert(demotedGuardReq.getStatus() === 403, 'Demoted access returns 403');
  console.log('   ✓ Demoted account immediately loses administrative privilege (Live DB check).');

  // Suspend user in database
  adminUserRecord.status = 'suspended';
  const suspendedSessionReq = createMockHttp({
    method: 'GET',
    headers: { cookie: `netmentor_session=${adminToken}` },
  });
  const suspendedResult = await requireAuth(suspendedSessionReq.req, suspendedSessionReq.res);
  assert(suspendedResult === null, 'Suspended user must immediately lose all access');
  assert(suspendedSessionReq.getStatus() === 403, 'Suspended session access returns 403');
  console.log('   ✓ Suspended user immediately blocked from active sessions.');

  // Restore admin status for remaining tests
  adminUserRecord.role = 'admin';
  adminUserRecord.status = 'active';

  // 10. Logout & Server-Side Session Revocation
  console.log('\n10. Testing Logout & Database Revocation:');
  const logoutReq = createMockHttp({
    method: 'POST',
    headers: {
      'x-netmentor-request': '1',
      cookie: `netmentor_session=${adminToken}`,
    },
  });
  await logoutHandler(logoutReq.req, logoutReq.res);
  assert(logoutReq.getStatus() === 200, 'Logout must return 200');

  // Try using the logged-out token again
  const postLogoutReq = createMockHttp({
    method: 'GET',
    headers: { cookie: `netmentor_session=${adminToken}` },
  });
  const postLogoutSession = await requireAuth(postLogoutReq.req, postLogoutReq.res);
  assert(postLogoutSession === null, 'Revoked token must be rejected');
  assert(postLogoutReq.getStatus() === 401, 'Revoked session returns 401');
  console.log('   ✓ Logged-out token successfully revoked in database and rejected.');

  // 11. Production Fail-Closed on Database Failure
  console.log('\n11. Testing Production Fail-Closed Policy:');
  process.env.NODE_ENV = 'production';
  process.env.VERCEL = '1';

  // Simulate DB failure via mock store
  client.__setTestMockStore({
    findUserByUsername: async () => {
      throw new Error('Neon connection timeout');
    },
  });

  const dbFailReq = createMockHttp({
    method: 'POST',
    headers: { 'x-netmentor-request': '1' },
    body: { username: 'jenilmoradiya50@admin', passphrase: 'AdminPass2026!' },
  });
  await loginHandler(dbFailReq.req, dbFailReq.res);
  assert(dbFailReq.getStatus() === 500, 'DB failure in production must return 500 ServerError');
  assert(dbFailReq.getData()?.error === 'ServerError', 'Fails closed with ServerError');
  console.log('   ✓ Production strictly fails closed on database failure (Zero bypass).');

  // Reset environment
  process.env.NODE_ENV = 'development';
  delete process.env.VERCEL;

  console.log('\n====================================================');
  console.log('✓ ALL 11 AUTHENTICATION TEST SUITES PASSED CLEANLY!');
  console.log('====================================================\n');
}

runTests().catch((err) => {
  console.error('\n✗ TEST FAILED:', err);
  process.exit(1);
});
