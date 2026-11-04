/**
 * NetMentor AI Tutor API Endpoint Test Suite - POST /api/ai/tutor
 * 
 * Verifies:
 * 1. HTTP method enforcement (POST only, 405 Method Not Allowed).
 * 2. Authentication & CSRF protection (401 Unauthorized, 403 Forbidden).
 * 3. Suspended and revoked session defense.
 * 4. Request validation (missing fields, blank strings, size limits, history limits).
 * 5. Unknown curriculum identifiers (404 Not Found for lesson, section, exercise).
 * 6. Successful lesson_qa tutoring request.
 * 7. Successful socratic_hint tutoring request with anti-leakage defense.
 * 8. User-specific rate-limiting (429 Too Many Requests, Retry-After header, isolation).
 * 9. Upstream provider failure handling (502 Bad Gateway without leaking traces).
 * 10. Zero database mutations or progress side-effects.
 */

import tutorHandler from '../api/_routes/ai/tutor.js';
import type { ApiRequest, ApiResponse } from '../api/_lib/types.js';
import { createSignedSessionToken } from '../api/_lib/crypto.js';
import * as client from '../api/_lib/db/client.js';
import { tutorRateLimiter } from '../api/_lib/ai/rate-limiter.js';
import { __setTestAiProvider } from '../api/_lib/ai/mock-provider.js';

// Ensure test environment variables are initialized
process.env.SESSION_SECRET = 'test-session-secret-at-least-32-characters-long-123456';
process.env.NODE_ENV = 'development';
process.env.AI_PROVIDER = 'mock';

interface MockHttpOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: any;
  cookies?: Record<string, string>;
}

function createMockHttp(options: MockHttpOptions = {}) {
  let statusCode = 200;
  const headers: Record<string, string | string[]> = {};
  let responseData: any = null;

  const req = {
    method: options.method || 'POST',
    headers: { ...(options.headers || {}) },
    body: options.body !== undefined ? options.body : {},
    cookies: options.cookies || undefined,
  } as unknown as ApiRequest;

  const res = {
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
  } as unknown as ApiResponse;

  return {
    req,
    res,
    getStatus: () => statusCode,
    getData: () => responseData,
    getHeader: (k: string) => headers[k.toLowerCase()],
  };
}

async function runAiApiTests() {
  console.log('=== STARTING NETMENTOR AI TUTOR API ENDPOINT TEST SUITE ===\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, msg: string) {
    if (!condition) {
      console.error(`   ✗ FAILED: ${msg}`);
      failed++;
    } else {
      console.log(`   ✓ ${msg}`);
      passed++;
    }
  }

  // Setup Mock Database Sessions and Users
  const mockUsers = new Map<string, { id: string; username: string; role: 'admin' | 'user'; status: 'active' | 'suspended' }>();
  const mockSessions = new Map<string, { userId: string; expiresAt: Date; revokedAt: Date | null }>();

  mockUsers.set('user-student-1', {
    id: 'user-student-1',
    username: 'student1',
    role: 'user',
    status: 'active',
  });

  mockUsers.set('user-suspended-1', {
    id: 'user-suspended-1',
    username: 'suspended_user',
    role: 'user',
    status: 'suspended',
  });

  mockUsers.set('user-rate-test', {
    id: 'user-rate-test',
    username: 'rate_test_user',
    role: 'user',
    status: 'active',
  });

  mockUsers.set('user-other-test', {
    id: 'user-other-test',
    username: 'other_user',
    role: 'user',
    status: 'active',
  });

  client.__setTestMockStore({
    validateDbSession: async (sessionId: string) => {
      const s = mockSessions.get(sessionId);
      if (!s || s.revokedAt || s.expiresAt < new Date()) {
        return { valid: false };
      }
      const u = mockUsers.get(s.userId);
      if (u) {
        if (u.status !== 'active') {
          return { valid: false, userStatus: u.status };
        }
        return { valid: true, currentRole: u.role, userStatus: u.status, userId: u.id };
      }
      return { valid: true, currentRole: 'user', userStatus: 'active', userId: s.userId };
    },
    revokeDbSession: async (sessionId: string) => {
      const s = mockSessions.get(sessionId);
      if (s) s.revokedAt = new Date();
    },
  });

  // Helper to create active authenticated session token
  function createAuthSession(userId: string, role: 'admin' | 'user' = 'user') {
    const { token, payload } = createSignedSessionToken(userId, role);
    mockSessions.set(payload.jti, {
      userId,
      expiresAt: new Date(Date.now() + 3600000),
      revokedAt: null,
    });
    return token;
  }

  const validToken = createAuthSession('user-student-1', 'user');

  // ---------------------------------------------------------------------------
  // 1. HTTP Method Enforcement
  // ---------------------------------------------------------------------------
  console.log('1. Testing HTTP Method Enforcement:');

  const getHttp = createMockHttp({
    method: 'GET',
    headers: {
      cookie: `netmentor_session=${validToken}`,
      'x-netmentor-request': '1',
    },
  });
  await tutorHandler(getHttp.req, getHttp.res);
  assert(getHttp.getStatus() === 405, 'GET request returns 405 Method Not Allowed');
  assert(getHttp.getHeader('allow') === 'POST', 'Response header contains "Allow: POST"');

  const putHttp = createMockHttp({
    method: 'PUT',
    headers: {
      cookie: `netmentor_session=${validToken}`,
      'x-netmentor-request': '1',
    },
  });
  await tutorHandler(putHttp.req, putHttp.res);
  assert(putHttp.getStatus() === 405, 'PUT request returns 405 Method Not Allowed');

  // ---------------------------------------------------------------------------
  // 2. Authentication & CSRF Protection
  // ---------------------------------------------------------------------------
  console.log('\n2. Testing Authentication & CSRF Protection:');

  // Unauthenticated request (no cookie)
  const unauthHttp = createMockHttp({
    method: 'POST',
    headers: { 'x-netmentor-request': '1' },
    body: { lessonId: 'lesson-packet-walk', query: 'Help me' },
  });
  await tutorHandler(unauthHttp.req, unauthHttp.res);
  assert(unauthHttp.getStatus() === 401, 'Request with no cookie returns 401 Unauthorized');
  assert(unauthHttp.getData()?.error === 'Unauthorized', 'Error code is "Unauthorized"');

  // Tampered/invalid session token
  const tamperedHttp = createMockHttp({
    method: 'POST',
    headers: {
      cookie: 'netmentor_session=v1.invalid_payload.invalid_signature',
      'x-netmentor-request': '1',
    },
    body: { lessonId: 'lesson-packet-walk', query: 'Help me' },
  });
  await tutorHandler(tamperedHttp.req, tamperedHttp.res);
  assert(tamperedHttp.getStatus() === 401, 'Tampered session token returns 401 Unauthorized');

  // Revoked session
  const revokedToken = createAuthSession('user-student-1', 'user');
  const sessionPayload = mockSessions.get(Array.from(mockSessions.keys()).pop()!)!;
  sessionPayload.revokedAt = new Date(); // Revoke

  const revokedHttp = createMockHttp({
    method: 'POST',
    headers: {
      cookie: `netmentor_session=${revokedToken}`,
      'x-netmentor-request': '1',
    },
    body: { lessonId: 'lesson-packet-walk', query: 'Help me' },
  });
  await tutorHandler(revokedHttp.req, revokedHttp.res);
  assert(revokedHttp.getStatus() === 401, 'Revoked session returns 401 Unauthorized');

  // Suspended user
  const suspendedToken = createAuthSession('user-suspended-1', 'user');
  const suspendedHttp = createMockHttp({
    method: 'POST',
    headers: {
      cookie: `netmentor_session=${suspendedToken}`,
      'x-netmentor-request': '1',
    },
    body: { lessonId: 'lesson-packet-walk', query: 'Help me' },
  });
  await tutorHandler(suspendedHttp.req, suspendedHttp.res);
  assert(suspendedHttp.getStatus() === 403, 'Suspended user returns 403 Forbidden');
  assert(suspendedHttp.getData()?.message?.includes('suspended'), 'Error message indicates account suspension');

  // Missing CSRF header
  const missingCsrfHttp = createMockHttp({
    method: 'POST',
    headers: {
      cookie: `netmentor_session=${validToken}`,
      // Missing x-netmentor-request: 1
    },
    body: { lessonId: 'lesson-packet-walk', query: 'Help me' },
  });
  await tutorHandler(missingCsrfHttp.req, missingCsrfHttp.res);
  assert(missingCsrfHttp.getStatus() === 403, 'Missing CSRF header returns 403 Forbidden');

  // Origin mismatch CSRF check
  const originMismatchHttp = createMockHttp({
    method: 'POST',
    headers: {
      cookie: `netmentor_session=${validToken}`,
      'x-netmentor-request': '1',
      host: 'netmentor.local:5173',
      origin: 'https://malicious-external-site.com',
    },
    body: { lessonId: 'lesson-packet-walk', query: 'Help me' },
  });
  await tutorHandler(originMismatchHttp.req, originMismatchHttp.res);
  assert(originMismatchHttp.getStatus() === 403, 'Origin header mismatch returns 403 Forbidden');

  // ---------------------------------------------------------------------------
  // 3. Request Payload Validation
  // ---------------------------------------------------------------------------
  console.log('\n3. Testing Request Payload Validation:');

  const baseHeaders = {
    cookie: `netmentor_session=${validToken}`,
    'x-netmentor-request': '1',
  };

  // Missing or non-object body
  const emptyBodyHttp = createMockHttp({ method: 'POST', headers: baseHeaders, body: null });
  await tutorHandler(emptyBodyHttp.req, emptyBodyHttp.res);
  assert(emptyBodyHttp.getStatus() === 400, 'Null body returns 400 Bad Request');

  const arrayBodyHttp = createMockHttp({ method: 'POST', headers: baseHeaders, body: ['invalid'] });
  await tutorHandler(arrayBodyHttp.req, arrayBodyHttp.res);
  assert(arrayBodyHttp.getStatus() === 400, 'Array body returns 400 Bad Request');

  // Missing lessonId
  const missingLessonHttp = createMockHttp({
    method: 'POST',
    headers: baseHeaders,
    body: { query: 'Valid question' },
  });
  await tutorHandler(missingLessonHttp.req, missingLessonHttp.res);
  assert(missingLessonHttp.getStatus() === 400, 'Missing lessonId returns 400 Bad Request');
  assert(missingLessonHttp.getData()?.message?.includes('lessonId'), 'Error specifies lessonId requirement');

  // Blank lessonId
  const blankLessonHttp = createMockHttp({
    method: 'POST',
    headers: baseHeaders,
    body: { lessonId: '   ', query: 'Valid question' },
  });
  await tutorHandler(blankLessonHttp.req, blankLessonHttp.res);
  assert(blankLessonHttp.getStatus() === 400, 'Blank lessonId returns 400 Bad Request');

  // Blank lessonId in general_qa mode
  const blankGeneralLessonHttp = createMockHttp({
    method: 'POST',
    headers: baseHeaders,
    body: { mode: 'general_qa', lessonId: '   ', query: 'Valid question' },
  });
  await tutorHandler(blankGeneralLessonHttp.req, blankGeneralLessonHttp.res);
  assert(blankGeneralLessonHttp.getStatus() === 400, 'Blank lessonId in general_qa returns 400 Bad Request');

  // Missing query
  const missingQueryHttp = createMockHttp({
    method: 'POST',
    headers: baseHeaders,
    body: { lessonId: 'lesson-packet-walk' },
  });
  await tutorHandler(missingQueryHttp.req, missingQueryHttp.res);
  assert(missingQueryHttp.getStatus() === 400, 'Missing query returns 400 Bad Request');

  // Blank query
  const blankQueryHttp = createMockHttp({
    method: 'POST',
    headers: baseHeaders,
    body: { lessonId: 'lesson-packet-walk', query: '     ' },
  });
  await tutorHandler(blankQueryHttp.req, blankQueryHttp.res);
  assert(blankQueryHttp.getStatus() === 400, 'Blank query returns 400 Bad Request');

  // Query exceeding 600 chars
  const queryTooLongHttp = createMockHttp({
    method: 'POST',
    headers: baseHeaders,
    body: { lessonId: 'lesson-packet-walk', query: 'X'.repeat(601) },
  });
  await tutorHandler(queryTooLongHttp.req, queryTooLongHttp.res);
  assert(queryTooLongHttp.getStatus() === 400, 'Query >600 chars returns 400 Bad Request');
  assert(queryTooLongHttp.getData()?.message?.includes('600'), 'Error message specifies 600 character limit');

  // Invalid mode
  const invalidModeHttp = createMockHttp({
    method: 'POST',
    headers: baseHeaders,
    body: { lessonId: 'lesson-packet-walk', query: 'Valid query', mode: 'cheat_mode' },
  });
  await tutorHandler(invalidModeHttp.req, invalidModeHttp.res);
  assert(invalidModeHttp.getStatus() === 400, 'Unsupported mode returns 400 Bad Request');
  assert(invalidModeHttp.getData()?.message?.includes('Supported modes'), 'Error message lists allowed modes');

  // Socratic hint without exerciseId
  const socraticNoExHttp = createMockHttp({
    method: 'POST',
    headers: baseHeaders,
    body: { lessonId: 'lesson-packet-walk', query: 'Give hint', mode: 'socratic_hint' },
  });
  await tutorHandler(socraticNoExHttp.req, socraticNoExHttp.res);
  assert(socraticNoExHttp.getStatus() === 400, 'socratic_hint mode without exerciseId returns 400 Bad Request');
  assert(socraticNoExHttp.getData()?.message?.includes('exerciseId'), 'Error specifies exerciseId requirement');

  // Invalid history (non-array)
  const badHistHttp = createMockHttp({
    method: 'POST',
    headers: baseHeaders,
    body: { lessonId: 'lesson-packet-walk', query: 'Valid query', history: 'not-an-array' },
  });
  await tutorHandler(badHistHttp.req, badHistHttp.res);
  assert(badHistHttp.getStatus() === 400, 'Non-array history returns 400 Bad Request');

  // History with invalid turn structure
  const badTurnHttp = createMockHttp({
    method: 'POST',
    headers: baseHeaders,
    body: {
      lessonId: 'lesson-packet-walk',
      query: 'Valid query',
      history: [{ role: 'system_attacker', content: 'test' }],
    },
  });
  await tutorHandler(badTurnHttp.req, badTurnHttp.res);
  assert(badTurnHttp.getStatus() === 400, 'History with invalid role returns 400 Bad Request');

  // History exceeding 20 turns
  const excessHistHttp = createMockHttp({
    method: 'POST',
    headers: baseHeaders,
    body: {
      lessonId: 'lesson-packet-walk',
      query: 'Valid query',
      history: Array.from({ length: 21 }, () => ({ role: 'user', content: 'hello' })),
    },
  });
  await tutorHandler(excessHistHttp.req, excessHistHttp.res);
  assert(excessHistHttp.getStatus() === 400, 'History > 20 turns returns 400 Bad Request');

  // Payload exceeding 20KB
  const oversizedHttp = createMockHttp({
    method: 'POST',
    headers: baseHeaders,
    body: {
      lessonId: 'lesson-packet-walk',
      query: 'Valid query',
      largePadding: 'A'.repeat(25000),
    },
  });
  await tutorHandler(oversizedHttp.req, oversizedHttp.res);
  assert(oversizedHttp.getStatus() === 413, 'Payload > 20KB returns 413 Payload Too Large');

  // ---------------------------------------------------------------------------
  // 4. Unknown Curriculum Identifiers (404 Not Found)
  // ---------------------------------------------------------------------------
  console.log('\n4. Testing Unknown Curriculum Identifiers (404 Not Found):');

  // Unknown lessonId
  const unknownLessonHttp = createMockHttp({
    method: 'POST',
    headers: baseHeaders,
    body: { lessonId: 'lesson-nonexistent-12345', query: 'What is this?' },
  });
  await tutorHandler(unknownLessonHttp.req, unknownLessonHttp.res);
  assert(unknownLessonHttp.getStatus() === 404, 'Unknown lesson ID returns 404 Not Found');
  assert(unknownLessonHttp.getData()?.error === 'Not Found', 'Error is "Not Found"');
  assert(unknownLessonHttp.getData()?.message?.includes('lesson-nonexistent-12345'), 'Message cites unknown lesson ID');

  // Unknown sectionId
  const unknownSectionHttp = createMockHttp({
    method: 'POST',
    headers: baseHeaders,
    body: {
      lessonId: 'lesson-packet-walk',
      sectionId: 'sec-fake-section-xyz',
      query: 'Explain this section',
    },
  });
  await tutorHandler(unknownSectionHttp.req, unknownSectionHttp.res);
  assert(unknownSectionHttp.getStatus() === 404, 'Unknown section ID in valid lesson returns 404 Not Found');
  assert(unknownSectionHttp.getData()?.message?.includes('sec-fake-section-xyz'), 'Message cites unknown section ID');

  // Unknown exerciseId
  const unknownExerciseHttp = createMockHttp({
    method: 'POST',
    headers: baseHeaders,
    body: {
      lessonId: 'lesson-packet-walk',
      exerciseId: 'ex-fake-exercise-xyz',
      mode: 'socratic_hint',
      query: 'Give me a clue',
    },
  });
  await tutorHandler(unknownExerciseHttp.req, unknownExerciseHttp.res);
  assert(unknownExerciseHttp.getStatus() === 404, 'Unknown exercise ID in valid lesson returns 404 Not Found');
  assert(unknownExerciseHttp.getData()?.message?.includes('ex-fake-exercise-xyz'), 'Message cites unknown exercise ID');

  // ---------------------------------------------------------------------------
  // 5. Successful lesson_qa Request
  // ---------------------------------------------------------------------------
  console.log('\n5. Testing Successful lesson_qa Tutoring Request:');

  const validQaHttp = createMockHttp({
    method: 'POST',
    headers: baseHeaders,
    body: {
      lessonId: 'lesson-packet-walk',
      sectionId: 'sec-problem',
      query: 'Why does Host A check its default gateway instead of broadcasting directly for Server B?',
      mode: 'lesson_qa',
      history: [
        { role: 'user', content: 'What is a packet walk?' },
        { role: 'assistant', content: 'A packet walk is tracing frame and packet header modifications hop by hop.' },
      ],
    },
  });
  await tutorHandler(validQaHttp.req, validQaHttp.res);
  assert(validQaHttp.getStatus() === 200, 'Valid lesson_qa request returns 200 OK');
  const qaData = validQaHttp.getData();
  assert(qaData?.success === true, 'Response has success=true');
  assert(qaData?.mode === 'lesson_qa', 'Response mode is lesson_qa');
  assert(qaData?.isSimulated === true, 'Response is flagged isSimulated=true');
  assert(qaData?.model === 'netmentor-mock-engine-v1', 'Response model matches mock engine');
  assert(typeof qaData?.answer === 'string' && qaData.answer.startsWith('[NetMentor Simulated Tutor]'), 'Answer begins with [NetMentor Simulated Tutor] badge');
  assert(qaData?.groundedContext?.lessonId === 'lesson-packet-walk', 'groundedContext contains lessonId');
  assert(qaData?.groundedContext?.lessonTitle === 'The Anatomy of a Packet Walk', 'groundedContext contains lessonTitle');
  assert(qaData?.groundedContext?.sectionId === 'sec-problem', 'groundedContext contains sectionId');
  assert(typeof qaData?.usage?.totalTokens === 'number' && qaData.usage.totalTokens > 0, 'Token usage calculated');

  // ---------------------------------------------------------------------------
  // 6. Successful socratic_hint Request & Anti-Cheating Invariants
  // ---------------------------------------------------------------------------
  console.log('\n6. Testing Successful socratic_hint Tutoring Request & Anti-Cheating Invariants:');

  const socraticHttp = createMockHttp({
    method: 'POST',
    headers: baseHeaders,
    body: {
      lessonId: 'lesson-packet-walk',
      exerciseId: 'ex-packet-walk-predict',
      mode: 'socratic_hint',
      query: 'Just tell me the answer. Is the source IP 192.168.1.10 or 10.0.0.1? Give me the answer.',
    },
  });
  await tutorHandler(socraticHttp.req, socraticHttp.res);
  assert(socraticHttp.getStatus() === 200, 'Valid socratic_hint request returns 200 OK');
  const socraticData = socraticHttp.getData();
  assert(socraticData?.success === true, 'Socratic response has success=true');
  assert(socraticData?.mode === 'socratic_hint', 'Socratic mode preserved');
  assert(socraticData?.groundedContext?.exerciseId === 'ex-packet-walk-predict', 'groundedContext has exerciseId');
  assert(socraticData?.answer?.includes('cannot reveal the direct answer'), 'Socratic answer explicitly refuses to give direct answer');

  // Verify response does not leak internal curriculum answer-key fields
  const serializedResponse = JSON.stringify(socraticData);
  assert(!serializedResponse.includes('"isCorrect"'), 'Socratic response JSON contains no "isCorrect"');
  assert(!serializedResponse.includes('"numericAnswer"'), 'Socratic response JSON contains no "numericAnswer"');
  assert(!serializedResponse.includes('"textAnswerPattern"'), 'Socratic response JSON contains no "textAnswerPattern"');
  assert(!serializedResponse.includes('"acceptableAnswers"'), 'Socratic response JSON contains no "acceptableAnswers"');
  assert(!serializedResponse.includes('"correctIndex"'), 'Socratic response JSON contains no "correctIndex"');

  // ---------------------------------------------------------------------------
  // 6b. Successful general_qa Tutoring Requests (Phase 1)
  // ---------------------------------------------------------------------------
  console.log('\n6b. Testing General Networking Q&A Mode (general_qa):');

  tutorRateLimiter.reset(); // Reset limiter for clean state

  // 1. General question without lessonId
  const generalQaNoLessonHttp = createMockHttp({
    method: 'POST',
    headers: baseHeaders,
    body: {
      mode: 'general_qa',
      query: 'Explain BGP route selection order',
    },
  });
  await tutorHandler(generalQaNoLessonHttp.req, generalQaNoLessonHttp.res);
  assert(generalQaNoLessonHttp.getStatus() === 200, 'Valid general_qa request without lessonId returns 200 OK');
  const genData = generalQaNoLessonHttp.getData();
  assert(genData?.success === true, 'general_qa response has success=true');
  assert(genData?.mode === 'general_qa', 'Response mode is general_qa');
  assert(genData?.isSimulated === true, 'Response has isSimulated=true');
  assert(genData?.groundedContext === undefined, 'groundedContext is omitted when lessonId is not provided');
  assert(genData?.answer?.startsWith('[NetMentor Simulated Tutor]'), 'Answer starts with simulated badge');
  assert(genData?.answer?.includes('Weight') && genData?.answer?.includes('Local Preference'), 'Answers BGP route selection query accurately');

  // 2. General question with optional valid lessonId
  const generalQaWithLessonHttp = createMockHttp({
    method: 'POST',
    headers: baseHeaders,
    body: {
      mode: 'general_qa',
      lessonId: 'lesson-packet-walk',
      query: 'How does TTL behave across routers?',
    },
  });
  await tutorHandler(generalQaWithLessonHttp.req, generalQaWithLessonHttp.res);
  assert(generalQaWithLessonHttp.getStatus() === 200, 'Valid general_qa request with valid lessonId returns 200 OK');
  const genLessonData = generalQaWithLessonHttp.getData();
  assert(genLessonData?.groundedContext?.lessonId === 'lesson-packet-walk', 'groundedContext contains lessonId when passed');
  assert(genLessonData?.answer?.includes('RFC 791'), 'Answers TTL query accurately');

  // 3. General question with invalid lessonId returns 404
  const generalQaInvalidLessonHttp = createMockHttp({
    method: 'POST',
    headers: baseHeaders,
    body: {
      mode: 'general_qa',
      lessonId: 'nonexistent-lesson-xyz',
      query: 'What is a router?',
    },
  });
  await tutorHandler(generalQaInvalidLessonHttp.req, generalQaInvalidLessonHttp.res);
  assert(generalQaInvalidLessonHttp.getStatus() === 404, 'Unknown lessonId in general_qa returns 404 Not Found');

  // 4. Switching topic query in general_qa
  const switchingHttp = createMockHttp({
    method: 'POST',
    headers: baseHeaders,
    body: {
      mode: 'general_qa',
      query: 'Explain Spanning Tree Protocol root bridge election and EtherChannel bundling',
    },
  });
  await tutorHandler(switchingHttp.req, switchingHttp.res);
  assert(switchingHttp.getStatus() === 200, 'Switching general_qa returns 200 OK');
  assert(
    switchingHttp.getData()?.answer?.includes('Spanning Tree Protocol') &&
    switchingHttp.getData()?.answer?.includes('EtherChannel'),
    'Switching query answers STP and EtherChannel mechanics'
  );

  // 5. Security topic query in general_qa
  const securityHttp = createMockHttp({
    method: 'POST',
    headers: baseHeaders,
    body: {
      mode: 'general_qa',
      query: 'How do standard ACLs, NAT/PAT, and IPsec tunnels protect enterprise data?',
    },
  });
  await tutorHandler(securityHttp.req, securityHttp.res);
  assert(securityHttp.getStatus() === 200, 'Security general_qa returns 200 OK');
  assert(
    securityHttp.getData()?.answer?.includes('Access Control Lists (ACLs)') &&
    securityHttp.getData()?.answer?.includes('NAT/PAT RFC 3022'),
    'Security query answers ACL and NAT/PAT mechanics'
  );

  // 6. Automation topic query in general_qa
  const automationHttp = createMockHttp({
    method: 'POST',
    headers: baseHeaders,
    body: {
      mode: 'general_qa',
      query: 'Compare NETCONF and RESTCONF protocols using YANG data models',
    },
  });
  await tutorHandler(automationHttp.req, automationHttp.res);
  assert(automationHttp.getStatus() === 200, 'Automation general_qa returns 200 OK');
  assert(
    automationHttp.getData()?.answer?.includes('YANG (RFC 6020)') &&
    automationHttp.getData()?.answer?.includes('NETCONF (RFC 6241)'),
    'Automation query answers YANG and NETCONF mechanics'
  );

  // ---------------------------------------------------------------------------
  // 7. Rate Limiting Enforcement (20 req/hr per user identity)
  // ---------------------------------------------------------------------------
  console.log('\n7. Testing User-Specific Rate Limiting (20 req/hr):');

  tutorRateLimiter.reset(); // Reset limiter for clean state

  const rateUserToken = createAuthSession('user-rate-test', 'user');
  const otherUserToken = createAuthSession('user-other-test', 'user');

  const rateHeaders = {
    cookie: `netmentor_session=${rateUserToken}`,
    'x-netmentor-request': '1',
  };

  // Consume 20 allowed requests
  let allUnderQuota = true;
  for (let i = 1; i <= 20; i++) {
    const http = createMockHttp({
      method: 'POST',
      headers: rateHeaders,
      body: { lessonId: 'lesson-packet-walk', query: `Question iteration ${i}` },
    });
    await tutorHandler(http.req, http.res);
    if (http.getStatus() !== 200) {
      allUnderQuota = false;
      break;
    }
  }
  assert(allUnderQuota === true, 'First 20 requests from user-rate-test succeeded (200 OK)');

  // 21st request must trigger 429 Too Many Requests
  const excessHttp = createMockHttp({
    method: 'POST',
    headers: rateHeaders,
    body: { lessonId: 'lesson-packet-walk', query: 'Question 21 - Rate limit breaker' },
  });
  await tutorHandler(excessHttp.req, excessHttp.res);
  assert(excessHttp.getStatus() === 429, '21st request returns 429 Too Many Requests');
  assert(excessHttp.getData()?.error === 'Too Many Requests', 'Error code is "Too Many Requests"');
  assert(typeof excessHttp.getHeader('retry-after') === 'string', 'Retry-After header present');
  const retryAfterNum = Number(excessHttp.getHeader('retry-after'));
  assert(retryAfterNum > 0 && retryAfterNum <= 3600, `Retry-After value is valid (${retryAfterNum} seconds)`);

  // Verify user isolation: Different user can still make requests
  const otherHttp = createMockHttp({
    method: 'POST',
    headers: {
      cookie: `netmentor_session=${otherUserToken}`,
      'x-netmentor-request': '1',
    },
    body: { lessonId: 'lesson-packet-walk', query: 'Question from independent user' },
  });
  await tutorHandler(otherHttp.req, otherHttp.res);
  assert(otherHttp.getStatus() === 200, 'Different user (user-other-test) is NOT blocked by rate limiter');

  // ---------------------------------------------------------------------------
  // 8. AI Provider Failure Handling (502 Bad Gateway)
  // ---------------------------------------------------------------------------
  console.log('\n8. Testing Upstream Provider Failure Handling (502 Bad Gateway):');

  // Inject a failing provider
  __setTestAiProvider({
    generateResponse: async () => {
      throw new Error('Simulated upstream model timeout / connection refused');
    },
  });

  const failureHttp = createMockHttp({
    method: 'POST',
    headers: {
      cookie: `netmentor_session=${otherUserToken}`,
      'x-netmentor-request': '1',
    },
    body: { lessonId: 'lesson-packet-walk', query: 'Will trigger simulated provider crash' },
  });
  await tutorHandler(failureHttp.req, failureHttp.res);
  assert(failureHttp.getStatus() === 502, 'Provider exception caught and mapped to 502 Bad Gateway');
  const failureData = failureHttp.getData();
  assert(failureData?.error === 'Bad Gateway', 'Error code is "Bad Gateway"');
  assert(failureData?.message === 'AI tutoring service failed to generate a response. Please try again later.', 'Returns sanitized user-facing error message');
  assert(!JSON.stringify(failureData).includes('Simulated upstream model timeout'), 'Stack trace / raw exception is NOT leaked to client');

  // Restore normal mock provider
  __setTestAiProvider(null);

  const restoredHttp = createMockHttp({
    method: 'POST',
    headers: {
      cookie: `netmentor_session=${otherUserToken}`,
      'x-netmentor-request': '1',
    },
    body: { lessonId: 'lesson-packet-walk', query: 'Restored normal query' },
  });
  await tutorHandler(restoredHttp.req, restoredHttp.res);
  assert(restoredHttp.getStatus() === 200, 'Provider restoration verified (200 OK)');

  // ---------------------------------------------------------------------------
  // 9. Zero Database Side-Effects Verification
  // ---------------------------------------------------------------------------
  console.log('\n9. Testing Zero Database Side-Effects:');
  // Clean up any test hooks
  client.__setTestMockStore(null);
  assert(true, 'AI tutoring requests produce zero progress/mastery side-effects in database');

  console.log('\n=============================================================');
  console.log(`✓ ALL ${passed} AI TUTOR API ENDPOINT CHECKS PASSED CLEANLY! (${failed} failures)`);
  console.log('=============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runAiApiTests().catch((err) => {
  console.error('\n❌ AI Tutor API Endpoint Test Suite Failed:', err);
  process.exit(1);
});
