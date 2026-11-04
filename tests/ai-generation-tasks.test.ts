/**
 * NetMentor Milestone 2 Test Suite: Background Task Serverless Endpoints & Executor
 *
 * Comprehensive mock-based test suite verifying:
 * 1. POST /api/ai/tasks/create: Auth, CSRF, rate limits, parameter validation, HTTP 202 response, idempotency.
 * 2. Background Task Executor: End-to-end execution for lesson, quiz, and flashcards.
 * 3. Persistence Rules:
 *    - Quizzes auto-persist to user_quizzes, returning quizId in persistedEntityId and resultData.quizId.
 *    - Lessons remain drafts (persistedEntityId is null).
 *    - Flashcards remain drafts (persistedEntityId is null).
 * 4. Zero-Leakage: Quiz resultData returned to client has answers and explanations stripped.
 * 5. GET /api/ai/tasks/[id]: Retrieval, parsed result data, browser-refresh persistence, 404 on invalid ID.
 * 6. Multi-Tenant Isolation: User B cannot view or cancel User A's tasks (strictly 404).
 * 7. Cancellation Lifecycle:
 *    - Early cancellation while queued prevents executor from running.
 *    - Mid-flight cancellation halts execution and status remains 'cancelled' (immutable).
 *    - Completed tasks cannot be cancelled (HTTP 409 Conflict).
 * 8. GET /api/ai/tasks/active: Recovery of queued/processing tasks and multi-tenant isolation.
 * 9. Provider Safety: Simulated indicator is preserved; upstream failures gracefully fail task.
 * 10. Self-Healing Timeouts: Expired tasks self-heal with queue/execution timeout distinction.
 */

import crypto from 'node:crypto';
import createTaskHandler, { generateTaskDeterministicIdempotencyKey } from '../api/ai/tasks/create.js';
import getTaskHandler from '../api/ai/tasks/[id].js';
import cancelTaskHandler from '../api/ai/tasks/[id]/cancel.js';
import getActiveTasksHandler from '../api/ai/tasks/active.js';
import { executeGenerationTask, waitForTaskExecution } from '../api/_lib/ai/task-executor.js';
import {
  __setTestMockStore,
  type GenerationTaskRecord,
} from '../api/_lib/db/client.js';
import { createSignedSessionToken } from '../api/_lib/crypto.js';
import { MockAiProvider, __setTestAiProvider, getActiveAiProvider } from '../api/_lib/ai/mock-provider.js';

process.env.SESSION_SECRET = 'test-session-secret-at-least-32-characters-long-123456';
process.env.NODE_ENV = 'development';
process.env.AI_PROVIDER = 'mock';

interface MockHttpOptions {
  method?: string;
  url?: string;
  headers?: Record<string, string>;
  body?: any;
  query?: Record<string, string>;
}

function createMockHttp(options: MockHttpOptions = {}) {
  let statusCode = 200;
  let responseData: any = null;
  const responseHeaders: Record<string, string> = {};

  const req: any = {
    method: options.method || 'GET',
    url: options.url || '/api/ai/tasks',
    headers: options.headers || {},
    body: options.body || {},
    query: options.query || {},
  };

  const res: any = {
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
    setHeader(name: string, value: string) {
      responseHeaders[name.toLowerCase()] = value;
      return this;
    },
  };

  return {
    req,
    res,
    getStatusCode: () => statusCode,
    getData: () => responseData,
    getHeader: (name: string) => responseHeaders[name.toLowerCase()],
  };
}

let testPassedCount = 0;
let testFailedCount = 0;

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`  FAIL: ${msg}`);
    testFailedCount++;
    throw new Error(`Assertion failed: ${msg}`);
  } else {
    testPassedCount++;
    console.log(`  PASS: ${msg}`);
  }
}

// In-Memory Database Mock Store
function createInMemoryStore() {
  const tasks = new Map<string, GenerationTaskRecord>();
  const quizzes = new Map<string, any>();
  const lessons = new Map<string, any>();
  const mockSessions = new Map<string, any>();

  return {
    tasks,
    quizzes,
    lessons,
    mockSessions,
    store: {
      validateDbSession: async (sessionId: string) => {
        const s = mockSessions.get(sessionId);
        if (!s) return { valid: false };
        return { valid: true, currentRole: s.role || 'user', userStatus: 'active', userId: s.userId };
      },

      createGenerationTask: async (userId: string, task: any) => {
        // Check active in-flight duplicate
        for (const t of tasks.values()) {
          if (
            t.userId === userId &&
            t.idempotencyKey === task.idempotencyKey &&
            (t.status === 'queued' || t.status === 'processing')
          ) {
            return { task: t, alreadyExists: true };
          }
        }

        const id = task.id || crypto.randomUUID();
        const queueTimeout = task.queueTimeoutSeconds || 180;
        const record: GenerationTaskRecord = {
          id,
          userId,
          taskType: task.taskType,
          status: 'queued',
          currentStage: 'queued',
          title: task.title,
          topic: task.topic,
          difficulty: task.difficulty || 'intermediate',
          idempotencyKey: task.idempotencyKey,
          inputParamsJson: JSON.stringify(task.inputParams),
          resultDataJson: null,
          persistedEntityId: null,
          errorMessage: null,
          errorCategory: null,
          isRetryable: true,
          executionDeadlineAt: new Date(Date.now() + queueTimeout * 1000).toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          completedAt: null,
        };

        tasks.set(id, record);
        return { task: { ...record }, alreadyExists: false };
      },

      startGenerationTaskProcessing: async (taskId: string, stage: any = 'prompting_ai', executionBudgetSeconds: number = 50) => {
        const task = tasks.get(taskId);
        if (!task || task.status !== 'queued') return false;
        task.status = 'processing';
        task.currentStage = stage;
        task.executionDeadlineAt = new Date(Date.now() + executionBudgetSeconds * 1000).toISOString();
        task.updatedAt = new Date().toISOString();
        return true;
      },

      getGenerationTaskById: async (userId: string, taskId: string) => {
        const task = tasks.get(taskId);
        if (!task || task.userId !== userId) return null;

        // Self-heal check
        if (
          (task.status === 'queued' || task.status === 'processing') &&
          task.executionDeadlineAt &&
          new Date(task.executionDeadlineAt) < new Date()
        ) {
          const isQueued = task.status === 'queued';
          task.status = 'failed';
          task.errorMessage = isQueued
            ? 'The generation task timed out while waiting in the queue. You may retry.'
            : 'The generation task exceeded its execution deadline and timed out. You may retry.';
          task.errorCategory = 'timeout';
          task.isRetryable = true;
          task.completedAt = new Date().toISOString();
          task.updatedAt = new Date().toISOString();
        }

        return task;
      },

      getUserActiveGenerationTasks: async (userId: string) => {
        const active: GenerationTaskRecord[] = [];
        const now = new Date();
        for (const t of tasks.values()) {
          if (t.userId === userId && (t.status === 'queued' || t.status === 'processing')) {
            if (t.executionDeadlineAt && new Date(t.executionDeadlineAt) < now) {
              t.status = 'failed';
              t.errorMessage = 'The task exceeded its execution window and timed out.';
              t.errorCategory = 'timeout';
              t.isRetryable = true;
              t.completedAt = now.toISOString();
              t.updatedAt = now.toISOString();
            } else {
              active.push(t);
            }
          }
        }
        return active;
      },

      updateGenerationTaskStage: async (taskId: string, stage: any) => {
        const task = tasks.get(taskId);
        if (!task || (task.status !== 'queued' && task.status !== 'processing')) return false;
        task.currentStage = stage;
        task.updatedAt = new Date().toISOString();
        return true;
      },

      completeGenerationTask: async (taskId: string, resultData: any, persistedEntityId?: string) => {
        const task = tasks.get(taskId);
        if (!task || (task.status !== 'queued' && task.status !== 'processing')) return false;
        task.status = 'completed';
        task.resultDataJson = typeof resultData === 'string' ? resultData : JSON.stringify(resultData);
        task.persistedEntityId = persistedEntityId || null;
        task.completedAt = new Date().toISOString();
        task.updatedAt = new Date().toISOString();
        return true;
      },

      failGenerationTask: async (taskId: string, error: any) => {
        const task = tasks.get(taskId);
        if (!task || (task.status !== 'queued' && task.status !== 'processing')) return false;
        task.status = 'failed';
        task.errorMessage = error.message;
        task.errorCategory = error.category || 'unknown';
        task.isRetryable = error.isRetryable !== false;
        task.completedAt = new Date().toISOString();
        task.updatedAt = new Date().toISOString();
        return true;
      },

      cancelGenerationTask: async (userId: string, taskId: string) => {
        const task = tasks.get(taskId);
        if (!task || task.userId !== userId || (task.status !== 'queued' && task.status !== 'processing')) {
          return false;
        }
        task.status = 'cancelled';
        task.completedAt = new Date().toISOString();
        task.updatedAt = new Date().toISOString();
        return true;
      },

      createUserQuiz: async (userId: string, quiz: any) => {
        const id = quiz.id || `quiz-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const record = {
          id,
          userId,
          lessonId: quiz.lessonId || null,
          title: quiz.title,
          topic: quiz.topic,
          difficulty: quiz.difficulty,
          questionCount: quiz.questionCount,
          questionTypes: quiz.questionTypes,
          questionsJson: quiz.questionsJson,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        quizzes.set(id, record);
        return record;
      },

      deleteUserQuiz: async (userId: string, quizId: string) => {
        const q = quizzes.get(quizId);
        if (q && q.userId === userId) {
          quizzes.delete(quizId);
          return true;
        }
        return false;
      },

      getUserGeneratedLessonById: async (userId: string, lessonId: string) => {
        const lesson = lessons.get(lessonId);
        if (!lesson || lesson.userId !== userId) return null;
        return lesson;
      },
    },
  };
}

async function runTests() {
  console.log('=== STARTING NETMENTOR MILESTONE 2: BACKGROUND TASK ENDPOINTS TEST SUITE ===\n');

  const { tasks, quizzes, lessons, mockSessions, store } = createInMemoryStore();
  __setTestMockStore(store);

  // Seed authenticated users
  const userA = 'user-uuid-alice-1111';
  const userB = 'user-uuid-bob-2222';
  const { token: sessionTokenA, payload: payloadA } = createSignedSessionToken('alice', 'user');
  const { token: sessionTokenB, payload: payloadB } = createSignedSessionToken('bob', 'user');

  mockSessions.set(payloadA.jti, { userId: userA, role: 'user' });
  mockSessions.set(payloadB.jti, { userId: userB, role: 'user' });

  // Seed sample lesson owned by User A
  const sampleLessonId = 'lesson-userA-eigrp-101';
  lessons.set(sampleLessonId, {
    id: sampleLessonId,
    userId: userA,
    title: 'EIGRP DUAL Mechanics & Feasible Distance',
    topic: 'EIGRP',
    difficulty: 'intermediate',
    description: 'Comprehensive study of EIGRP feasible successorship and DUAL finite state machine.',
    contentJson: JSON.stringify({
      sections: [
        {
          title: 'Feasible Distance vs Reported Distance',
          explanation: 'The Feasibility Condition requires that Reported Distance is strictly less than Feasible Distance.',
          commands: [{ command: 'show ip eigrp topology', description: 'Displays EIGRP topology table' }],
        },
      ],
      summary: {
        keyTerms: [{ term: 'DUAL', definition: 'Diffusing Update Algorithm' }],
        whatYouLearned: 'EIGRP loop avoidance mechanics and feasibility conditions.',
      },
    }),
  });

  const authHeadersA = {
    cookie: `netmentor_session=${sessionTokenA}`,
    'x-netmentor-request': '1',
  };

  const authHeadersB = {
    cookie: `netmentor_session=${sessionTokenB}`,
    'x-netmentor-request': '1',
  };

  // ---------------------------------------------------------------------------
  // SUITE 1: Task Creation Endpoint Security & Validation (POST /api/ai/tasks/create)
  // ---------------------------------------------------------------------------
  console.log('--- SUITE 1: Task Creation Security & Validation ---');

  // 1.1 Rejects missing CSRF header
  const noCsrfHttp = createMockHttp({
    method: 'POST',
    headers: { cookie: `netmentor_session=${sessionTokenA}` },
    body: { taskType: 'lesson', inputParams: { topic: 'BGP' } },
  });
  await createTaskHandler(noCsrfHttp.req, noCsrfHttp.res);
  assert(noCsrfHttp.getStatusCode() === 403, 'Rejects request missing CSRF header with 403 Forbidden');

  // 1.2 Rejects unauthenticated request (CSRF present, but session cookie missing)
  const unauthHttp = createMockHttp({
    method: 'POST',
    headers: { 'x-netmentor-request': '1' },
    body: { taskType: 'lesson', inputParams: { topic: 'BGP' } },
  });
  await createTaskHandler(unauthHttp.req, unauthHttp.res);
  assert(unauthHttp.getStatusCode() === 401, 'Rejects unauthenticated request with 401 Unauthorized');

  // 1.3 Rejects non-POST methods
  const getHttp = createMockHttp({
    method: 'GET',
    headers: authHeadersA,
  });
  await createTaskHandler(getHttp.req, getHttp.res);
  assert(getHttp.getStatusCode() === 405, 'Rejects GET request with 405 Method Not Allowed');

  // 1.4 Rejects invalid taskType
  const invalidTypeHttp = createMockHttp({
    method: 'POST',
    headers: authHeadersA,
    body: { taskType: 'unsupported_type', inputParams: { topic: 'BGP' } },
  });
  await createTaskHandler(invalidTypeHttp.req, invalidTypeHttp.res);
  assert(invalidTypeHttp.getStatusCode() === 400, 'Rejects unsupported taskType with 400 Bad Request');

  // 1.5 Rejects missing topic for lesson
  const missingTopicHttp = createMockHttp({
    method: 'POST',
    headers: authHeadersA,
    body: { taskType: 'lesson', inputParams: { difficulty: 'intermediate' } },
  });
  await createTaskHandler(missingTopicHttp.req, missingTopicHttp.res);
  assert(missingTopicHttp.getStatusCode() === 400, 'Rejects lesson creation missing topic with 400 Bad Request');

  // 1.6 Rejects quiz creation with unowned lessonId
  const unownedQuizLessonHttp = createMockHttp({
    method: 'POST',
    headers: authHeadersB, // User B trying to use User A's lesson
    body: { taskType: 'quiz', inputParams: { lessonId: sampleLessonId } },
  });
  await createTaskHandler(unownedQuizLessonHttp.req, unownedQuizLessonHttp.res);
  assert(unownedQuizLessonHttp.getStatusCode() === 404, 'Rejects quiz generation referencing unowned lesson with 404 Not Found');

  // ---------------------------------------------------------------------------
  // SUITE 2: Successful Task Creation & HTTP 202 Response
  // ---------------------------------------------------------------------------
  console.log('\n--- SUITE 2: Task Creation & HTTP 202 Accepted ---');

  // 2.1 Create Lesson Task
  const createLessonHttp = createMockHttp({
    method: 'POST',
    headers: authHeadersA,
    body: {
      taskType: 'lesson',
      inputParams: { topic: 'OSPF Areas & LSA Types', difficulty: 'intermediate' },
    },
  });
  await createTaskHandler(createLessonHttp.req, createLessonHttp.res);
  assert(createLessonHttp.getStatusCode() === 202, 'Creates lesson task with HTTP 202 Accepted');
  const lessonTask = createLessonHttp.getData().task;
  assert(lessonTask.status === 'queued', 'Initial task status is "queued"');
  assert(lessonTask.taskType === 'lesson', 'Task type is "lesson"');
  assert(createLessonHttp.getData().alreadyExists === false, 'New task has alreadyExists=false');

  // 2.2 Create Standalone Quiz Task
  const createQuizHttp = createMockHttp({
    method: 'POST',
    headers: authHeadersA,
    body: {
      taskType: 'quiz',
      inputParams: { topic: 'VLANs and Trunking 802.1Q', difficulty: 'medium', questionCount: 5 },
    },
  });
  await createTaskHandler(createQuizHttp.req, createQuizHttp.res);
  assert(createQuizHttp.getStatusCode() === 202, 'Creates quiz task with HTTP 202 Accepted');
  const quizTask = createQuizHttp.getData().task;
  assert(quizTask.taskType === 'quiz', 'Task type is "quiz"');

  // 2.3 Create Flashcards Task
  const createFlashcardsHttp = createMockHttp({
    method: 'POST',
    headers: authHeadersA,
    body: {
      taskType: 'flashcards',
      inputParams: { topic: 'Subnetting CIDR Calculations', cardCount: 5 },
    },
  });
  await createTaskHandler(createFlashcardsHttp.req, createFlashcardsHttp.res);
  assert(createFlashcardsHttp.getStatusCode() === 202, 'Creates flashcards task with HTTP 202 Accepted');
  const flashcardTask = createFlashcardsHttp.getData().task;
  assert(flashcardTask.taskType === 'flashcards', 'Task type is "flashcards"');

  // 2.4 Duplicate Submission Idempotency
  const duplicateHttp = createMockHttp({
    method: 'POST',
    headers: authHeadersA,
    body: {
      taskType: 'lesson',
      inputParams: { topic: 'OSPF Areas & LSA Types', difficulty: 'intermediate' },
    },
  });
  await createTaskHandler(duplicateHttp.req, duplicateHttp.res);
  assert(duplicateHttp.getStatusCode() === 200, 'Duplicate submission returns HTTP 200 OK');
  assert(duplicateHttp.getData().alreadyExists === true, 'Duplicate submission flagged alreadyExists=true');
  assert(duplicateHttp.getData().task.id === lessonTask.id, 'Duplicate returns the original in-flight task ID');

  // ---------------------------------------------------------------------------
  // SUITE 3: End-to-End Background Execution via Task Executor
  // ---------------------------------------------------------------------------
  console.log('\n--- SUITE 3: End-to-End Background Execution ---');

  // Wait for the background execution of the tasks to complete
  await waitForTaskExecution(lessonTask.id);
  await waitForTaskExecution(quizTask.id);
  await waitForTaskExecution(flashcardTask.id);

  // 3.1 Verify Lesson Generation Pipeline & Draft Invariant
  const completedLesson = tasks.get(lessonTask.id);
  assert(completedLesson?.status === 'completed', 'Lesson background task transitioned to "completed"');
  assert(completedLesson?.persistedEntityId === null, 'Lesson remains a draft (persistedEntityId is null)');
  const parsedLessonResult = JSON.parse(completedLesson!.resultDataJson!);
  assert(parsedLessonResult.success === true, 'Lesson result has success=true');
  assert(Boolean(parsedLessonResult.lesson?.lessonTitle || parsedLessonResult.lesson?.title), 'Lesson contains structured title');
  assert(Array.isArray(parsedLessonResult.lesson?.sections), 'Lesson contains structured sections array');
  assert(parsedLessonResult.isSimulated === true, 'Mock provider execution flagged isSimulated=true');

  // 3.2 Verify Quiz Generation Pipeline & Auto-Persistence Rule
  const completedQuiz = tasks.get(quizTask.id);
  assert(completedQuiz?.status === 'completed', 'Quiz background task transitioned to "completed"');
  assert(Boolean(completedQuiz?.persistedEntityId), 'Quiz auto-persisted to database and has persistedEntityId');
  const persistedQuizRecord = quizzes.get(completedQuiz!.persistedEntityId!);
  assert(Boolean(persistedQuizRecord), 'Quiz record found in user_quizzes table');
  assert(persistedQuizRecord.userId === userA, 'Quiz record owned by User A');

  // 3.3 Verify Answer Key Protection (Zero Leakage)
  const parsedQuizResult = JSON.parse(completedQuiz!.resultDataJson!);
  assert(parsedQuizResult.quizId === completedQuiz?.persistedEntityId, 'resultData.quizId matches persisted ID');
  assert(Array.isArray(parsedQuizResult.quiz?.questions), 'Quiz result contains questions array');
  for (const q of parsedQuizResult.quiz.questions) {
    assert(q.correctAnswer === undefined, 'Quiz client result does not leak correctAnswer');
    assert(q.explanation === undefined, 'Quiz client result does not leak explanation');
  }

  // 3.4 Verify Flashcards Generation Pipeline & Draft Invariant
  const completedFlashcards = tasks.get(flashcardTask.id);
  assert(completedFlashcards?.status === 'completed', 'Flashcards background task transitioned to "completed"');
  assert(completedFlashcards?.persistedEntityId === null, 'Flashcards remain a draft (persistedEntityId is null)');
  const parsedDeckResult = JSON.parse(completedFlashcards!.resultDataJson!);
  assert(Array.isArray(parsedDeckResult.deck?.cards), 'Flashcards result contains cards array');

  // ---------------------------------------------------------------------------
  // SUITE 4: Task Status Inspection Endpoint (GET /api/ai/tasks/[id])
  // ---------------------------------------------------------------------------
  console.log('\n--- SUITE 4: Task Status Inspection Endpoint ---');

  // 4.1 Inspect Completed Quiz Task
  const getQuizHttp = createMockHttp({
    method: 'GET',
    url: `/api/ai/tasks/${quizTask.id}`,
    query: { id: quizTask.id },
    headers: authHeadersA,
  });
  await getTaskHandler(getQuizHttp.req, getQuizHttp.res);
  assert(getQuizHttp.getStatusCode() === 200, 'GET /api/ai/tasks/[id] returns 200 OK');
  const fetchedQuizTask = getQuizHttp.getData().task;
  assert(fetchedQuizTask.id === quizTask.id, 'Returns matching task ID');
  assert(fetchedQuizTask.status === 'completed', 'Status is completed');
  assert(Boolean(fetchedQuizTask.resultData?.quiz), 'resultData is parsed JSON object');
  assert(fetchedQuizTask.persistedEntityId === completedQuiz?.persistedEntityId, 'Returns persisted quiz entity ID');

  // 4.2 Multi-Tenant Isolation: User B cannot access User A's task
  const userBInspectHttp = createMockHttp({
    method: 'GET',
    url: `/api/ai/tasks/${quizTask.id}`,
    query: { id: quizTask.id },
    headers: authHeadersB, // User B
  });
  await getTaskHandler(userBInspectHttp.req, userBInspectHttp.res);
  assert(userBInspectHttp.getStatusCode() === 404, 'User B access to User A task returns 404 Not Found (strictly isolated)');

  // 4.3 404 on Non-Existent Task
  const notFoundHttp = createMockHttp({
    method: 'GET',
    url: '/api/ai/tasks/unknown-task-id',
    query: { id: 'unknown-task-id' },
    headers: authHeadersA,
  });
  await getTaskHandler(notFoundHttp.req, notFoundHttp.res);
  assert(notFoundHttp.getStatusCode() === 404, 'Non-existent task ID returns 404 Not Found');

  // ---------------------------------------------------------------------------
  // SUITE 5: Task Cancellation Mechanics (POST /api/ai/tasks/[id]/cancel)
  // ---------------------------------------------------------------------------
  console.log('\n--- SUITE 5: Task Cancellation Mechanics ---');

  // 5.1 Early Cancellation while queued
  const earlyCancelHttp = createMockHttp({
    method: 'POST',
    headers: authHeadersA,
    body: {
      taskType: 'lesson',
      inputParams: { topic: 'Cancellation While Queued Test' },
    },
  });
  await createTaskHandler(earlyCancelHttp.req, earlyCancelHttp.res);
  const earlyTask = earlyCancelHttp.getData().task;

  // Immediately cancel while queued
  const cancelQueuedHttp = createMockHttp({
    method: 'POST',
    url: `/api/ai/tasks/${earlyTask.id}/cancel`,
    query: { id: earlyTask.id },
    headers: authHeadersA,
  });
  await cancelTaskHandler(cancelQueuedHttp.req, cancelQueuedHttp.res);
  assert(cancelQueuedHttp.getStatusCode() === 200, 'Cancelling queued task returns 200 OK');

  const cancelledQueuedRecord = tasks.get(earlyTask.id);
  assert(cancelledQueuedRecord?.status === 'cancelled', 'Queued task status transitioned to "cancelled"');

  // Attempt to run executor on already cancelled task: must halt without changing status
  await executeGenerationTask(earlyTask.id, userA);
  const recordAfterExecutionAttempt = tasks.get(earlyTask.id);
  assert(recordAfterExecutionAttempt?.status === 'cancelled', 'Cancelled task remains "cancelled"; executor halted safely');

  // 5.2 Attempt to cancel an already completed task
  const cancelCompletedHttp = createMockHttp({
    method: 'POST',
    url: `/api/ai/tasks/${quizTask.id}/cancel`,
    query: { id: quizTask.id },
    headers: authHeadersA,
  });
  await cancelTaskHandler(cancelCompletedHttp.req, cancelCompletedHttp.res);
  assert(cancelCompletedHttp.getStatusCode() === 409, 'Cancelling completed task returns 409 Conflict');

  // 5.3 User B cannot cancel User A's task
  const userBCancelHttp = createMockHttp({
    method: 'POST',
    url: `/api/ai/tasks/${lessonTask.id}/cancel`,
    query: { id: lessonTask.id },
    headers: authHeadersB,
  });
  await cancelTaskHandler(userBCancelHttp.req, userBCancelHttp.res);
  assert(userBCancelHttp.getStatusCode() === 404, 'User B cannot cancel User A task (404 Not Found)');

  // 5.4 Quiz Cancellation Race cleanup: ensures cancelled quiz task never leaves orphaned record in user_quizzes
  const originalCreateUserQuiz = store.createUserQuiz;
  const originalCreateGenTask = store.createGenerationTask;
  let persistedDuringRaceId: string | null = null;
  let raceTargetTaskId: string | null = null;

  store.createUserQuiz = async (userId: string, quiz: any) => {
    const res = await originalCreateUserQuiz(userId, quiz);
    persistedDuringRaceId = res.id;
    // Simulate concurrent cancel request committing right as createUserQuiz finishes
    if (raceTargetTaskId) {
      const t = tasks.get(raceTargetTaskId);
      if (t) t.status = 'cancelled';
    }
    return res;
  };

  store.createGenerationTask = async (userId: string, taskParams: any) => {
    const res = await originalCreateGenTask(userId, taskParams);
    if (taskParams.topic === 'Cancellation Race Test Protocol') {
      raceTargetTaskId = res.task.id;
    }
    return res;
  };

  const raceQuizCreateHttp = createMockHttp({
    method: 'POST',
    headers: authHeadersA,
    body: {
      taskType: 'quiz',
      inputParams: { topic: 'Cancellation Race Test Protocol', difficulty: 'medium', questionCount: 5 },
    },
  });
  await createTaskHandler(raceQuizCreateHttp.req, raceQuizCreateHttp.res);
  const raceQuizTask = raceQuizCreateHttp.getData().task;

  await waitForTaskExecution(raceQuizTask.id);
  store.createUserQuiz = originalCreateUserQuiz;
  store.createGenerationTask = originalCreateGenTask;

  const postRaceTask = tasks.get(raceQuizTask.id);
  assert(postRaceTask?.status === 'cancelled', 'Task remains in "cancelled" state');
  assert(persistedDuringRaceId !== null, 'Quiz record was initially inserted during the race');
  assert(
    !quizzes.has(persistedDuringRaceId!),
    'Orphaned quiz record was automatically deleted from user_quizzes upon detecting cancellation'
  );

  // ---------------------------------------------------------------------------
  // SUITE 6: Active Tasks Recovery Endpoint (GET /api/ai/tasks/active)
  // ---------------------------------------------------------------------------
  console.log('\n--- SUITE 6: Active Tasks Recovery Endpoint ---');

  // Create an active task for User B
  const userBTaskHttp = createMockHttp({
    method: 'POST',
    headers: authHeadersB,
    body: {
      taskType: 'quiz',
      inputParams: { topic: 'RIPv2 Routing Protocol', difficulty: 'easy', questionCount: 5 },
    },
  });
  await createTaskHandler(userBTaskHttp.req, userBTaskHttp.res);
  const userBActiveTask = userBTaskHttp.getData().task;

  // Retrieve active tasks for User B
  const getActiveBHttp = createMockHttp({
    method: 'GET',
    headers: authHeadersB,
  });
  await getActiveTasksHandler(getActiveBHttp.req, getActiveBHttp.res);
  assert(getActiveBHttp.getStatusCode() === 200, 'GET /api/ai/tasks/active returns 200 OK');
  const userBTasks = getActiveBHttp.getData().tasks;
  assert(userBTasks.some((t: any) => t.id === userBActiveTask.id), 'Active task recovered in active list');
  assert(!userBTasks.some((t: any) => t.userId === userA), 'User B does NOT receive User A tasks in active list');

  // ---------------------------------------------------------------------------
  // SUITE 7: Upstream Provider Error & Failure Handling
  // ---------------------------------------------------------------------------
  console.log('\n--- SUITE 7: Upstream Provider Failure Handling ---');

  // Mock AI provider throwing simulated upstream failure
  class FailingAiProvider extends MockAiProvider {
    async generateResponse(): Promise<any> {
      throw new Error('Upstream provider timeout: Connection reset by peer with key secret_token_12345');
    }
  }

  const failingProvider = new FailingAiProvider();
  __setTestAiProvider(failingProvider);

  try {
    const errorTaskHttp = createMockHttp({
      method: 'POST',
      headers: authHeadersA,
      body: {
        taskType: 'lesson',
        inputParams: { topic: 'Provider Error Resilience' },
      },
    });
    await createTaskHandler(errorTaskHttp.req, errorTaskHttp.res);
    const errorTask = errorTaskHttp.getData().task;

    await waitForTaskExecution(errorTask.id);

    const failedRecord = tasks.get(errorTask.id);
    assert(failedRecord?.status === 'failed', 'Upstream failure transitions task to "failed"');
    assert(failedRecord?.errorCategory === 'provider_failure', 'Error category is "provider_failure"');
    assert(failedRecord?.isRetryable === true, 'Task is flagged isRetryable=true');
    assert(!failedRecord?.errorMessage?.includes('secret_token_12345'), 'Secrets are strictly redacted from error message');
  } finally {
    // Restore default mock provider
    __setTestAiProvider(null);
  }

  // ---------------------------------------------------------------------------
  // SUITE 8: Self-Healing Timeout Behavior
  // ---------------------------------------------------------------------------
  console.log('\n--- SUITE 8: Self-Healing Timeout Verification ---');

  // Create an expired queued task
  const expiredId = crypto.randomUUID();
  tasks.set(expiredId, {
    id: expiredId,
    userId: userA,
    taskType: 'quiz',
    status: 'queued',
    currentStage: 'queued',
    title: 'Expired Quiz Test',
    topic: 'BGP',
    difficulty: 'hard',
    idempotencyKey: 'expired-key-1234',
    inputParamsJson: JSON.stringify({ topic: 'BGP' }),
    resultDataJson: null,
    persistedEntityId: null,
    errorMessage: null,
    errorCategory: null,
    isRetryable: true,
    executionDeadlineAt: new Date(Date.now() - 10000).toISOString(), // 10s ago
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completedAt: null,
  });

  const getExpiredHttp = createMockHttp({
    method: 'GET',
    url: `/api/ai/tasks/${expiredId}`,
    query: { id: expiredId },
    headers: authHeadersA,
  });
  await getTaskHandler(getExpiredHttp.req, getExpiredHttp.res);
  const selfHealed = getExpiredHttp.getData().task;
  assert(selfHealed.status === 'failed', 'Expired task self-healed to "failed" upon retrieval');
  assert(selfHealed.errorCategory === 'timeout', 'Category is "timeout"');
  assert(selfHealed.errorMessage.includes('queue'), 'Queue timeout message identifies queue abandonment');

  // Reset test store
  __setTestMockStore(null);

  console.log('\n============================================================');
  console.log(`✓ ALL ${testPassedCount} MILESTONE 2 BACKGROUND TASK TESTS PASSED CLEANLY! (${testFailedCount} failures)`);
  console.log('============================================================\n');

  if (testFailedCount > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal unhandled error in Milestone 2 test suite:', err);
  process.exit(1);
});
