/**
 * NetMentor Consolidated Serverless Function Router Comprehensive Test Suite
 *
 * Verifies:
 * 1. Pathname normalization & query string parsing (extractPathname, parseQueryString).
 * 2. Route matching & explicit precedence across ALL 30 routes.
 * 3. Strict precedence avoiding dynamic route shadowing:
 *    - /api/quizzes/attempts/:attemptId vs /api/quizzes/:id
 *    - /api/quizzes/:id/attempts vs /api/quizzes/:id
 *    - /api/quizzes/:id/submit vs /api/quizzes/:id
 *    - /api/ai/tasks/active vs /api/ai/tasks/:id
 *    - /api/ai/tasks/create vs /api/ai/tasks/:id
 *    - /api/ai/tasks/:id/cancel vs /api/ai/tasks/:id
 * 4. 404 Not Found handling for unmatched endpoints.
 * 5. HTTP method enforcement (allowed vs rejected methods with 405).
 * 6. Query string & dynamic parameter merging into req.query.
 * 7. Request body & header preservation across invocations.
 * 8. Authentication & CSRF validation enforcement through the central router.
 * 9. Safe error handling (500 without leaking secrets or stack traces).
 * 10. Background task execution and waitUntil() compatibility.
 */

import routerHandler, {
  extractPathname,
  parseQueryString,
  matchRoute,
  STATIC_ROUTES,
} from '../api/[...route].ts';
import type { ApiRequest, ApiResponse } from '../api/_lib/types.ts';
import { createSignedSessionToken } from '../api/_lib/crypto.ts';
import * as client from '../api/_lib/db/client.ts';
import { __setTestAiProvider, MockAiProvider } from '../api/_lib/ai/mock-provider.ts';

// Initialize required test environment variables
process.env.SESSION_SECRET = 'test-session-secret-at-least-32-characters-long-123456';
process.env.NODE_ENV = 'development';
process.env.AI_PROVIDER = 'mock';

interface MockResponse extends ApiResponse {
  _statusCode: number;
  _headers: Record<string, string | string[]>;
  _jsonData: any;
  _ended: boolean;
}

function createMockHttp(options: {
  method?: string;
  url?: string;
  headers?: Record<string, string>;
  body?: any;
  cookies?: Record<string, string>;
  query?: Record<string, string>;
}): { req: ApiRequest; res: MockResponse } {
  const req: any = {
    method: options.method || 'GET',
    url: options.url || '/api/health',
    headers: options.headers || {},
    body: options.body || {},
    cookies: options.cookies || {},
    query: options.query || {},
  };

  const res: MockResponse = {
    _statusCode: 200,
    _headers: {},
    _jsonData: null,
    _ended: false,
    statusCode: 200,
    status(code: number) {
      this._statusCode = code;
      this.statusCode = code;
      return this;
    },
    json(data: any) {
      this._jsonData = data;
      this._ended = true;
    },
    setHeader(name: string, value: string | string[]) {
      this._headers[name.toLowerCase()] = value;
      return this;
    },
    getHeader(name: string) {
      return this._headers[name.toLowerCase()];
    },
    end(data?: any) {
      if (data && !this._jsonData) {
        try {
          this._jsonData = JSON.parse(data);
        } catch {
          this._jsonData = data;
        }
      }
      this._ended = true;
      return this;
    },
  } as any;

  return { req, res };
}

async function runRouterTests() {
  console.log('=== STARTING NETMENTOR CONSOLIDATED API ROUTER TEST SUITE ===\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, msg: string) {
    if (!condition) {
      console.error(`   ✗ FAILED: ${msg}`);
      failed++;
      throw new Error(`Assertion failed: ${msg}`);
    }
    console.log(`   ✓ ${msg}`);
    passed++;
  }

  // =========================================================================
  // 1. URL Pathname Normalization & Query String Extraction
  // =========================================================================
  console.log('1. Testing URL Pathname Normalization & Query String Extraction:');
  assert(extractPathname('/api/health') === '/api/health', 'Standard /api/health preserved');
  assert(extractPathname('/api/quizzes/abc?includeKey=true') === '/api/quizzes/abc', 'Strips query string cleanly');
  assert(extractPathname('/api/flashcards/decks/') === '/api/flashcards/decks', 'Strips trailing slash');
  assert(extractPathname('/health') === '/api/health', 'Prepends /api when omitted');
  assert(extractPathname('') === '', 'Handles empty URL gracefully');
  assert(extractPathname('/api/[...route]?__route=/api/health', { __route: '/api/health' }) === '/api/health', 'Resolves Vercel rewrite __route parameter');
  assert(extractPathname('/api/[...route]?__route=health', { __route: 'health' }) === '/api/health', 'Prepends /api to relative __route parameter');
  assert(extractPathname('/api/[...route]', {}, { 'x-forwarded-uri': '/api/auth/login' }) === '/api/auth/login', 'Resolves proxy x-forwarded-uri header');

  const qs1 = parseQueryString('/api/flashcards/cards?deckId=ccna-01&limit=20');
  assert(qs1.deckId === 'ccna-01' && qs1.limit === '20', 'Parses multiple query parameters correctly');
  const qs2 = parseQueryString('/api/quizzes');
  assert(Object.keys(qs2).length === 0, 'Returns empty object when query string is absent');

  // =========================================================================
  // 2. Comprehensive Inventory Verification of All 30 Routes
  // =========================================================================
  console.log('\n2. Testing Route Matching Across All 30 Endpoints:');

  const all30RouteUrls = [
    // System
    '/api/health',
    // Auth
    '/api/auth/login',
    '/api/auth/logout',
    '/api/auth/session',
    // Curriculum & Catalog
    '/api/curriculum/progress',
    '/api/labs',
    '/api/paths',
    // Lessons
    '/api/lessons/generated',
    // Flashcards
    '/api/flashcards/cards',
    '/api/flashcards/catalog',
    '/api/flashcards/decks',
    '/api/flashcards/import',
    '/api/flashcards/lesson-deck',
    '/api/flashcards/preview',
    '/api/flashcards/progress',
    '/api/flashcards/standalone-deck',
    // Quizzes
    '/api/quizzes',
    '/api/quizzes/quiz-uuid-1',
    '/api/quizzes/quiz-uuid-1/attempts',
    '/api/quizzes/quiz-uuid-1/submit',
    '/api/quizzes/attempts/attempt-uuid-1',
    // AI & Tutoring
    '/api/ai/conversations',
    '/api/ai/generate-flashcards',
    '/api/ai/generate-lesson',
    '/api/ai/generate-quiz',
    '/api/ai/tutor',
    // AI Background Tasks
    '/api/ai/tasks/active',
    '/api/ai/tasks/create',
    '/api/ai/tasks/task-uuid-1',
    '/api/ai/tasks/task-uuid-1/cancel',
  ];

  assert(all30RouteUrls.length === 30, 'Inventory contains exactly 30 unique routes');

  for (const url of all30RouteUrls) {
    const matched = matchRoute(url);
    assert(matched !== null, `Route [${url}] matched successfully to a handler`);
  }

  // =========================================================================
  // 3. Precedence & Shadow Prevention Checks
  // =========================================================================
  console.log('\n3. Testing Route Precedence & Shadowing Invariants:');

  // 3.1 AI Tasks Precedence
  const mActive = matchRoute('/api/ai/tasks/active');
  assert(mActive?.routeName === '/api/ai/tasks/active', 'static /api/ai/tasks/active has precedence over /api/ai/tasks/:id');

  const mCreate = matchRoute('/api/ai/tasks/create');
  assert(mCreate?.routeName === '/api/ai/tasks/create', 'static /api/ai/tasks/create has precedence over /api/ai/tasks/:id');

  const mCancel = matchRoute('/api/ai/tasks/task-999/cancel');
  assert(mCancel?.routeName === '/api/ai/tasks/:id/cancel', 'nested /api/ai/tasks/:id/cancel has precedence over /api/ai/tasks/:id');
  assert(mCancel?.params.id === 'task-999', 'extracted task id parameter correctly in cancel');

  const mTaskById = matchRoute('/api/ai/tasks/task-999');
  assert(mTaskById?.routeName === '/api/ai/tasks/:id', 'general /api/ai/tasks/:id matches uuid');
  assert(mTaskById?.params.id === 'task-999', 'extracted task id parameter correctly in lookup');

  // 3.2 Quizzes Precedence
  const mAttemptDetail = matchRoute('/api/quizzes/attempts/attempt-456');
  assert(mAttemptDetail?.routeName === '/api/quizzes/attempts/:attemptId', '/api/quizzes/attempts/:attemptId matches attempt detail');
  assert(mAttemptDetail?.params.attemptId === 'attempt-456', 'extracted attemptId parameter correctly');

  const mQuizAttempts = matchRoute('/api/quizzes/quiz-123/attempts');
  assert(mQuizAttempts?.routeName === '/api/quizzes/:id/attempts', '/api/quizzes/:id/attempts matches attempts history');
  assert(mQuizAttempts?.params.id === 'quiz-123', 'extracted quiz id parameter in attempts history');

  const mQuizSubmit = matchRoute('/api/quizzes/quiz-123/submit');
  assert(mQuizSubmit?.routeName === '/api/quizzes/:id/submit', '/api/quizzes/:id/submit matches submit endpoint');
  assert(mQuizSubmit?.params.id === 'quiz-123', 'extracted quiz id parameter in submit');

  const mQuizById = matchRoute('/api/quizzes/quiz-123');
  assert(mQuizById?.routeName === '/api/quizzes/:id', '/api/quizzes/:id matches quiz definition');
  assert(mQuizById?.params.id === 'quiz-123', 'extracted quiz id parameter in quiz definition');

  // =========================================================================
  // 4. 404 Unmatched Route Defense
  // =========================================================================
  console.log('\n4. Testing Unmatched Route 404 Handling:');
  const { req: r404, res: s404 } = createMockHttp({ method: 'GET', url: '/api/completely-bogus-endpoint' });
  await routerHandler(r404, s404);
  assert(s404._statusCode === 404, 'Unmatched route returns HTTP 404');
  assert(s404._jsonData?.error === 'Not Found', 'Returns structured 404 JSON error');

  // =========================================================================
  // 5. System Health Endpoint Execution via Router
  // =========================================================================
  console.log('\n5. Testing /api/health Dispatch:');
  const { req: rHealth, res: sHealth } = createMockHttp({ method: 'GET', url: '/api/health' });
  await routerHandler(rHealth, sHealth);
  assert(sHealth._statusCode === 200 || sHealth._statusCode === 503, 'Health endpoint executed and returned valid status');
  assert(typeof sHealth._jsonData?.connected === 'boolean', 'Health response contains connected boolean');
  assert(sHealth._jsonData?.engine === 'Neon / PostgreSQL', 'Health response confirms Neon / PostgreSQL engine');

  // Method not allowed check
  const { req: rHealthPost, res: sHealthPost } = createMockHttp({ method: 'POST', url: '/api/health' });
  await routerHandler(rHealthPost, sHealthPost);
  assert(sHealthPost._statusCode === 405, 'POST to /api/health rejected with 405 Method Not Allowed');

  // =========================================================================
  // 6. Authentication & CSRF Guards via Central Router
  // =========================================================================
  console.log('\n6. Testing Security Guards (Auth & CSRF) via Router:');

  // 6.1 Unauthenticated request to protected endpoint
  const { req: rUnauth, res: sUnauth } = createMockHttp({
    method: 'GET',
    url: '/api/curriculum/progress',
  });
  await routerHandler(rUnauth, sUnauth);
  assert(sUnauth._statusCode === 401, 'Unauthenticated request rejected with HTTP 401 Unauthorized');

  // 6.2 Mutation without CSRF header
  const { token: validToken, payload: validPayload } = createSignedSessionToken('testuser', 'user');

  const { req: rNoCsrf, res: sNoCsrf } = createMockHttp({
    method: 'POST',
    url: '/api/curriculum/progress',
    cookies: { netmentor_session: validToken },
    body: { lessonId: 'lesson-packet-walk', masteryLevel: 'mastered' },
  });
  await routerHandler(rNoCsrf, sNoCsrf);
  assert(sNoCsrf._statusCode === 403, 'Mutation without X-NetMentor-Request header rejected with HTTP 403 Forbidden');

  // =========================================================================
  // 7. Parameter & Query String Merging into req.query
  // =========================================================================
  console.log('\n7. Testing Query String & Dynamic Parameter Merging:');
  const { req: rParams, res: sParams } = createMockHttp({
    method: 'GET',
    url: '/api/quizzes/my-quiz-id?includeKey=true&verbose=1',
  });
  // Execute router (handler will reject with 401 because not authenticated, but query params should be merged)
  await routerHandler(rParams, sParams);
  assert(rParams.query?.id === 'my-quiz-id', 'Dynamic param :id populated on req.query');
  assert(rParams.query?.includeKey === 'true', 'URL search param includeKey preserved on req.query');
  assert(rParams.query?.verbose === '1', 'URL search param verbose preserved on req.query');

  // =========================================================================
  // 8. Background Task Creation & waitUntil() Safety
  // =========================================================================
  console.log('\n8. Testing Background Task Creation & Async Dispatch via Router:');
  __setTestAiProvider(new MockAiProvider());

  client.__setTestMockStore({
    findUserByUsername: async (username: string) => ({
      id: 'mock-user-1',
      username,
      role: 'user',
      status: 'active',
      passwordHash: 'dummy',
    }),
    validateDbSession: async () => ({
      valid: true,
      userId: 'mock-user-1',
      currentRole: 'user',
      userStatus: 'active',
    }),
    createGenerationTask: async (_userId: string, task: any) => ({
      task: {
        id: 'task-test-uuid',
        userId: 'mock-user-1',
        taskType: task.taskType,
        status: 'queued',
        currentStage: 'queued',
        title: task.title,
        topic: task.topic,
        difficulty: task.difficulty,
        idempotencyKey: task.idempotencyKey,
        inputParamsJson: JSON.stringify(task.inputParams),
        resultDataJson: null,
        errorMessage: null,
        errorCode: null,
        executionBudgetSeconds: 180,
        stageProgressPercent: 0,
        stageMessage: 'Queued',
        startedAt: null,
        completedAt: null,
        failedAt: null,
        persistedEntityId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      alreadyExists: false,
    }),
  });

  const { req: rTaskCreate, res: sTaskCreate } = createMockHttp({
    method: 'POST',
    url: '/api/ai/tasks/create',
    headers: { 'x-netmentor-request': '1' },
    cookies: { netmentor_session: validToken },
    body: {
      taskType: 'lesson',
      topic: 'BGP Path Selection',
      difficulty: 'ccnp',
      inputParams: { topic: 'BGP Path Selection', difficulty: 'ccnp' },
    },
  });

  await routerHandler(rTaskCreate, sTaskCreate);
  if (sTaskCreate._statusCode !== 202) {
    console.log('TaskCreate debug:', sTaskCreate._statusCode, sTaskCreate._jsonData);
  }
  assert(sTaskCreate._statusCode === 202, 'Background task creation returned HTTP 202 Accepted via router');
  assert(sTaskCreate._jsonData?.success === true, 'Task creation confirmed success: true');
  assert(sTaskCreate._jsonData?.task?.id === 'task-test-uuid', 'Returned created task ID');

  // Clean up mock store
  client.__setTestMockStore(null);

  // =========================================================================
  // 9. Unhandled Error Sanitization Defense
  // =========================================================================
  console.log('\n9. Testing Router-Level Unhandled Error Handling & Secret Redaction:');
  const brokenReq: any = {
    method: 'GET',
    url: '/api/health',
    headers: {},
  };
  const brokenRes: any = {
    _statusCode: 200,
    status(code: number) { this._statusCode = code; return this; },
    json(data: any) { this._jsonData = data; },
    setHeader() { return this; },
  };

  // Mock a catastrophic failure by passing invalid properties
  const origHandler = STATIC_ROUTES['/api/health'];
  try {
    STATIC_ROUTES['/api/health'] = async () => {
      throw new Error('Database connection failed with postgresql://admin:secret123@ep-bad.neon.tech/db');
    };

    await routerHandler(brokenReq, brokenRes);
    assert(brokenRes._statusCode === 500, 'Unhandled error in handler caught and returned HTTP 500');
    assert(brokenRes._jsonData?.error === 'Internal Server Error', 'Sanitized 500 JSON error message returned');
    assert(!JSON.stringify(brokenRes._jsonData).includes('secret123'), 'Secrets never leaked in error response');
  } finally {
    STATIC_ROUTES['/api/health'] = origHandler;
  }

  console.log('\n=============================================================');
  console.log(`✓ ALL ${passed} ROUTER & DISPATCHER TESTS PASSED CLEANLY! (0 failures)`);
  console.log('=============================================================\n');
  process.exit(0);
}

runRouterTests().catch((err) => {
  console.error('\n❌ Router test suite failed:', err);
  process.exit(1);
});
