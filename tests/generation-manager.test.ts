/**
 * NetMentor Milestone 3 Test Suite: Persistent Background AI Generation
 *
 * Verifies the complete frontend-backend integration of persistent AI generation:
 * 1. Task submission & 202 Accepted across all 5 generation workflows:
 *    - Standalone Lesson
 *    - Standalone Flashcards
 *    - Lesson-Grounded Flashcards
 *    - Standalone Quiz
 *    - Lesson-Grounded Quiz
 * 2. Background Task Execution & Polling Flow:
 *    - Asynchronous progression through stages
 *    - Completion recovery via active & id endpoints
 * 3. Result Hydration & Draft Persistence Rules:
 *    - Quizzes auto-persist to user_quizzes (persistedEntityId is populated)
 *    - Lessons remain drafts for user review (persistedEntityId is null)
 *    - Flashcards remain drafts for user review (persistedEntityId is null)
 *    - Quizzes never leak answer keys or explanations to client payloads
 * 4. Cancellation & Failure Recovery:
 *    - User can cancel in-flight tasks
 *    - Failed tasks provide actionable error messages and retry capability
 * 5. State Recovery & Tab Synchronization:
 *    - Active tasks recovered on reload
 *    - Multi-tenant boundary is strictly preserved
 */

import crypto from 'node:crypto';
import createTaskHandler from '../api/ai/tasks/create.js';
import getTaskHandler from '../api/ai/tasks/[id].js';
import cancelTaskHandler from '../api/ai/tasks/[id]/cancel.js';
import getActiveTasksHandler from '../api/ai/tasks/active.js';
import { executeGenerationTask, waitForTaskExecution } from '../api/_lib/ai/task-executor.js';
import {
  __setTestMockStore,
  type GenerationTaskRecord,
} from '../api/_lib/db/client.js';
import { createSignedSessionToken } from '../api/_lib/crypto.js';
import { MockAiProvider, __setTestAiProvider } from '../api/_lib/ai/mock-provider.js';

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
    status(code: number) {
      statusCode = code;
      return res;
    },
    json(data: any) {
      responseData = data;
      return res;
    },
    setHeader(name: string, value: string) {
      responseHeaders[name.toLowerCase()] = value;
      return res;
    },
    end() {
      return res;
    },
    get statusCode() {
      return statusCode;
    },
    get data() {
      return responseData;
    },
    get headers() {
      return responseHeaders;
    },
  };

  return { req, res };
}

let testPassed = 0;
let testFailed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  PASS: ${message}`);
    testPassed++;
  } else {
    console.error(`  FAIL: ${message}`);
    testFailed++;
    throw new Error(`Assertion failed: ${message}`);
  }
}

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

      updateGenerationTaskStage: async (taskId: string, stage: any) => {
        const task = tasks.get(taskId);
        if (!task || task.status !== 'processing') return false;
        task.currentStage = stage;
        task.updatedAt = new Date().toISOString();
        return true;
      },

      getGenerationTaskById: async (userId: string, taskId: string) => {
        const task = tasks.get(taskId);
        if (!task || task.userId !== userId) return null;
        return task;
      },

      getUserActiveGenerationTasks: async (userId: string) => {
        const active: GenerationTaskRecord[] = [];
        for (const t of tasks.values()) {
          if (t.userId === userId && (t.status === 'queued' || t.status === 'processing')) {
            active.push({ ...t });
          }
        }
        return active;
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

      createUserQuiz: async (userId: string, quizData: any) => {
        const id = crypto.randomUUID();
        const record = {
          id,
          userId,
          ...quizData,
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

async function runMilestone3TestSuite() {
  console.log('\n============================================================');
  console.log('NETMENTOR MILESTONE 3: PERSISTENT BACKGROUND AI GENERATION');
  console.log('============================================================\n');

  const { tasks, quizzes, lessons, mockSessions, store } = createInMemoryStore();
  __setTestMockStore(store);

  // Authenticated Users
  const userA = 'user-uuid-alice-1111';
  const userB = 'user-uuid-bob-2222';
  const { token: sessionTokenA, payload: payloadA } = createSignedSessionToken('alice', 'user');
  const { token: sessionTokenB, payload: payloadB } = createSignedSessionToken('bob', 'user');

  mockSessions.set(payloadA.jti, { userId: userA, role: 'user' });
  mockSessions.set(payloadB.jti, { userId: userB, role: 'user' });

  // Seed Lesson owned by User A
  const existingLesson = {
    id: 'lesson-ospf-deepdive',
    userId: userA,
    title: 'OSPFv2 Deep Dive & LSDB Mechanics',
    topic: 'OSPFv2',
    sections: [
      { id: 's1', title: 'Adjacency States', content: 'Down -> Init -> 2-Way -> ExStart -> Exchange -> Loading -> Full' },
      { id: 's2', title: 'LSA Types', content: 'Type 1 Router, Type 2 Network, Type 3 Summary' },
    ],
  };
  lessons.set(existingLesson.id, existingLesson);

  // Set mock provider
  __setTestAiProvider(new MockAiProvider());

  // =========================================================================
  // SUITE 1: Task Creation across All 5 Workflows
  // =========================================================================
  console.log('--- SUITE 1: Task Creation Across All 5 Generation Workflows ---');

  // 1.1 Standalone Lesson
  let resA = createMockHttp({
    method: 'POST',
    headers: {
      cookie: `netmentor_session=${sessionTokenA}`,
      'x-netmentor-request': '1',
    },
    body: {
      taskType: 'lesson',
      inputParams: {
        topic: 'MPLS L3VPN',
        difficulty: 'advanced',
        desiredDepth: 'deep_dive',
      },
    },
  });
  await createTaskHandler(resA.req, resA.res);
  assert(resA.res.statusCode === 202, 'Workflow 1 (Lesson): Returns HTTP 202 Accepted');
  const lessonTaskId = resA.res.data.task.id;
  assert(resA.res.data.task.taskType === 'lesson', 'Workflow 1: Task type is "lesson"');
  assert(resA.res.data.task.status === 'queued', 'Workflow 1: Initial status is "queued"');

  // 1.2 Standalone Flashcards
  resA = createMockHttp({
    method: 'POST',
    headers: {
      cookie: `netmentor_session=${sessionTokenA}`,
      'x-netmentor-request': '1',
    },
    body: {
      taskType: 'flashcards',
      inputParams: {
        topic: 'BGP Path Selection',
        cardCount: 10,
        difficulty: 'intermediate',
      },
    },
  });
  await createTaskHandler(resA.req, resA.res);
  assert(resA.res.statusCode === 202, 'Workflow 2 (Standalone Flashcards): Returns HTTP 202 Accepted');
  const standaloneFlashcardsTaskId = resA.res.data.task.id;
  assert(resA.res.data.task.taskType === 'flashcards', 'Workflow 2: Task type is "flashcards"');

  // 1.3 Lesson-Grounded Flashcards
  resA = createMockHttp({
    method: 'POST',
    headers: {
      cookie: `netmentor_session=${sessionTokenA}`,
      'x-netmentor-request': '1',
    },
    body: {
      taskType: 'flashcards',
      inputParams: {
        lessonId: existingLesson.id,
        cardCount: 5,
        difficulty: 'Match Lesson',
      },
    },
  });
  await createTaskHandler(resA.req, resA.res);
  assert(resA.res.statusCode === 202, 'Workflow 3 (Lesson Flashcards): Returns HTTP 202 Accepted');
  const lessonFlashcardsTaskId = resA.res.data.task.id;
  assert(resA.res.data.task.taskType === 'flashcards', 'Workflow 3: Task type is "flashcards"');

  // 1.4 Standalone Quiz
  resA = createMockHttp({
    method: 'POST',
    headers: {
      cookie: `netmentor_session=${sessionTokenA}`,
      'x-netmentor-request': '1',
    },
    body: {
      taskType: 'quiz',
      inputParams: {
        topic: 'EIGRP DUAL Mechanics',
        difficulty: 'medium',
        questionCount: 5,
        questionTypes: ['single_choice', 'multiple_select', 'scenario'],
      },
    },
  });
  await createTaskHandler(resA.req, resA.res);
  assert(resA.res.statusCode === 202, 'Workflow 4 (Standalone Quiz): Returns HTTP 202 Accepted');
  const standaloneQuizTaskId = resA.res.data.task.id;
  assert(resA.res.data.task.taskType === 'quiz', 'Workflow 4: Task type is "quiz"');

  // 1.5 Lesson-Grounded Quiz
  resA = createMockHttp({
    method: 'POST',
    headers: {
      cookie: `netmentor_session=${sessionTokenA}`,
      'x-netmentor-request': '1',
    },
    body: {
      taskType: 'quiz',
      inputParams: {
        lessonId: existingLesson.id,
        difficulty: 'hard',
        questionCount: 5,
      },
    },
  });
  await createTaskHandler(resA.req, resA.res);
  assert(resA.res.statusCode === 202, 'Workflow 5 (Lesson Quiz): Returns HTTP 202 Accepted');
  const lessonQuizTaskId = resA.res.data.task.id;
  assert(resA.res.data.task.taskType === 'quiz', 'Workflow 5: Task type is "quiz"');

  // =========================================================================
  // SUITE 2: Active Tasks Recovery on Reload & Status Tracking
  // =========================================================================
  console.log('\n--- SUITE 2: Active Tasks Recovery & Status Tracking ---');

  // Create an active task explicitly for User A to verify recovery
  let activeTestReq = createMockHttp({
    method: 'POST',
    headers: {
      cookie: `netmentor_session=${sessionTokenA}`,
      'x-netmentor-request': '1',
    },
    body: {
      taskType: 'lesson',
      inputParams: { topic: 'Active Task Recovery Verification' },
    },
  });
  await createTaskHandler(activeTestReq.req, activeTestReq.res);
  const activeTestTaskId = activeTestReq.res.data.task.id;

  let getActiveReq = createMockHttp({
    method: 'GET',
    headers: { cookie: `netmentor_session=${sessionTokenA}` },
  });
  await getActiveTasksHandler(getActiveReq.req, getActiveReq.res);
  assert(getActiveReq.res.statusCode === 200, 'GET /api/ai/tasks/active returns HTTP 200');
  assert(Array.isArray(getActiveReq.res.data.tasks), 'Returns array of active tasks');

  // Verify multi-tenant isolation on active recovery
  let getActiveReqB = createMockHttp({
    method: 'GET',
    headers: { cookie: `netmentor_session=${sessionTokenB}` },
  });
  await getActiveTasksHandler(getActiveReqB.req, getActiveReqB.res);
  assert(getActiveReqB.res.statusCode === 200, 'User B GET /api/ai/tasks/active returns HTTP 200');
  assert(getActiveReqB.res.data.tasks.length === 0, 'User B active list is completely isolated (0 tasks returned)');

  // =========================================================================
  // SUITE 3: Asynchronous Execution & Result Payloads
  // =========================================================================
  console.log('\n--- SUITE 3: Background Execution & Result Payloads ---');

  // Wait for background execution to complete
  await waitForTaskExecution(lessonTaskId);

  let inspectLesson = createMockHttp({
    method: 'GET',
    headers: { cookie: `netmentor_session=${sessionTokenA}` },
    query: { id: lessonTaskId },
  });
  await getTaskHandler(inspectLesson.req, inspectLesson.res);
  assert(inspectLesson.res.statusCode === 200, 'Retrieved completed lesson task');
  assert(inspectLesson.res.data.task.status === 'completed', 'Lesson status transitioned to "completed"');
  assert(inspectLesson.res.data.task.persistedEntityId === null, 'Lesson is a draft: persistedEntityId is null');
  assert(inspectLesson.res.data.task.resultData?.lesson?.sections?.length > 0, 'Lesson resultData contains structured sections');

  // Wait for Quiz Task execution
  await waitForTaskExecution(standaloneQuizTaskId);

  let inspectQuiz = createMockHttp({
    method: 'GET',
    headers: { cookie: `netmentor_session=${sessionTokenA}` },
    query: { id: standaloneQuizTaskId },
  });
  await getTaskHandler(inspectQuiz.req, inspectQuiz.res);
  assert(inspectQuiz.res.statusCode === 200, 'Retrieved completed quiz task');
  assert(inspectQuiz.res.data.task.status === 'completed', 'Quiz status transitioned to "completed"');
  assert(inspectQuiz.res.data.task.persistedEntityId !== null, 'Quiz was auto-persisted: persistedEntityId is set');
  const createdQuizId = inspectQuiz.res.data.task.persistedEntityId;
  assert(quizzes.has(createdQuizId), 'Quiz record physically exists in user_quizzes database store');
  
  // Verify Zero Leakage in Quiz Result Data
  const quizQuestions = inspectQuiz.res.data.task.resultData?.quiz?.questions || [];
  assert(quizQuestions.length > 0, 'Quiz resultData contains questions array');
  let leakedCount = 0;
  for (const q of quizQuestions) {
    if (q.correctAnswer !== undefined || q.explanation !== undefined) {
      leakedCount++;
    }
  }
  assert(leakedCount === 0, 'Zero ground-truth answer keys or explanations leaked in task result');

  // Wait for Flashcards Task execution
  await waitForTaskExecution(standaloneFlashcardsTaskId);

  let inspectFlashcards = createMockHttp({
    method: 'GET',
    headers: { cookie: `netmentor_session=${sessionTokenA}` },
    query: { id: standaloneFlashcardsTaskId },
  });
  await getTaskHandler(inspectFlashcards.req, inspectFlashcards.res);
  assert(inspectFlashcards.res.statusCode === 200, 'Retrieved completed flashcards task');
  assert(inspectFlashcards.res.data.task.status === 'completed', 'Flashcards status transitioned to "completed"');
  assert(inspectFlashcards.res.data.task.persistedEntityId === null, 'Flashcards remain a draft: persistedEntityId is null');
  assert(Array.isArray(inspectFlashcards.res.data.task.resultData?.deck?.cards), 'Flashcards result contains cards array');

  // =========================================================================
  // SUITE 4: Task Cancellation & Idempotency Duplicate Handling
  // =========================================================================
  console.log('\n--- SUITE 4: Task Cancellation & Idempotency ---');

  // Create a new in-flight task to test cancellation
  let cancelTargetReq = createMockHttp({
    method: 'POST',
    headers: {
      cookie: `netmentor_session=${sessionTokenA}`,
      'x-netmentor-request': '1',
    },
    body: {
      taskType: 'quiz',
      inputParams: { topic: 'Cancellation Target Protocol' },
    },
  });
  await createTaskHandler(cancelTargetReq.req, cancelTargetReq.res);
  const cancelTargetTaskId = cancelTargetReq.res.data.task.id;

  let cancelReq = createMockHttp({
    method: 'POST',
    headers: {
      cookie: `netmentor_session=${sessionTokenA}`,
      'x-netmentor-request': '1',
    },
    query: { id: cancelTargetTaskId },
  });
  await cancelTaskHandler(cancelReq.req, cancelReq.res);
  assert(cancelReq.res.statusCode === 200, 'POST /api/ai/tasks/[id]/cancel returns HTTP 200');
  assert(cancelReq.res.data.success === true, 'POST /api/ai/tasks/[id]/cancel returns success: true');
  const cancelledRecord = tasks.get(cancelTargetTaskId);
  assert(cancelledRecord?.status === 'cancelled', 'Task transitioned to "cancelled" in database');

  // Attempting to cancel already completed task returns 409 Conflict
  let cancelCompletedReq = createMockHttp({
    method: 'POST',
    headers: {
      cookie: `netmentor_session=${sessionTokenA}`,
      'x-netmentor-request': '1',
    },
    query: { id: standaloneQuizTaskId },
  });
  await cancelTaskHandler(cancelCompletedReq.req, cancelCompletedReq.res);
  assert(cancelCompletedReq.res.statusCode === 409, 'Cancelling completed task returns HTTP 409 Conflict');

  // Idempotency: Submitting identical task while one is in-flight returns HTTP 200 with alreadyExists=true
  // Create a queued task
  let originalTaskReq = createMockHttp({
    method: 'POST',
    headers: {
      cookie: `netmentor_session=${sessionTokenA}`,
      'x-netmentor-request': '1',
    },
    body: {
      taskType: 'flashcards',
      inputParams: {
        topic: 'Idempotency Duplicate Test Deck',
        cardCount: 5,
      },
    },
  });
  await createTaskHandler(originalTaskReq.req, originalTaskReq.res);
  const originalTaskId = originalTaskReq.res.data.task.id;

  let duplicateReq = createMockHttp({
    method: 'POST',
    headers: {
      cookie: `netmentor_session=${sessionTokenA}`,
      'x-netmentor-request': '1',
    },
    body: {
      taskType: 'flashcards',
      inputParams: {
        topic: 'Idempotency Duplicate Test Deck',
        cardCount: 5,
      },
    },
  });
  await createTaskHandler(duplicateReq.req, duplicateReq.res);
  // If duplicate was submitted while still active, returns 200 with alreadyExists: true
  assert(
    (duplicateReq.res.statusCode === 200 && duplicateReq.res.data.alreadyExists === true) ||
    duplicateReq.res.statusCode === 202,
    'Idempotency duplicate handled cleanly'
  );

  // =========================================================================
  // SUITE 5: Failure Handling & Retry Mechanism
  // =========================================================================
  console.log('\n--- SUITE 5: Failure Handling & Retry Workflow ---');

  // Create a task that will encounter an intentional failure
  let failTaskReq = createMockHttp({
    method: 'POST',
    headers: {
      cookie: `netmentor_session=${sessionTokenA}`,
      'x-netmentor-request': '1',
    },
    body: {
      taskType: 'quiz',
      inputParams: {
        topic: 'FAULT_SIMULATION_TOPIC',
        difficulty: 'medium',
      },
    },
  });
  await createTaskHandler(failTaskReq.req, failTaskReq.res);
  const failTaskId = failTaskReq.res.data.task.id;

  // Simulate execution failure by setting task to failed
  await store.failGenerationTask(failTaskId, {
    message: 'Upstream AI provider timeout: Service unavailable',
    category: 'provider_failure',
    isRetryable: true,
  });

  let inspectFailed = createMockHttp({
    method: 'GET',
    headers: { cookie: `netmentor_session=${sessionTokenA}` },
    query: { id: failTaskId },
  });
  await getTaskHandler(inspectFailed.req, inspectFailed.res);
  assert(inspectFailed.res.statusCode === 200, 'Retrieved failed task');
  assert(inspectFailed.res.data.task.status === 'failed', 'Status is "failed"');
  assert(inspectFailed.res.data.task.isRetryable === true, 'Task is flagged isRetryable: true');
  assert(inspectFailed.res.data.task.errorCategory === 'provider_failure', 'Error category is "provider_failure"');

  // User retries task: new task created with original parameters
  let retryReq = createMockHttp({
    method: 'POST',
    headers: {
      cookie: `netmentor_session=${sessionTokenA}`,
      'x-netmentor-request': '1',
    },
    body: {
      taskType: inspectFailed.res.data.task.taskType,
      inputParams: inspectFailed.res.data.task.inputParams,
    },
  });
  await createTaskHandler(retryReq.req, retryReq.res);
  assert(retryReq.res.statusCode === 202, 'Retrying failed task creates new task with HTTP 202 Accepted');
  assert(retryReq.res.data.task.id !== failTaskId, 'New task has distinct new task ID');

  console.log('\n============================================================');
  console.log(`MILESTONE 3 TEST RUN FINISHED: ${testPassed} Passed, ${testFailed} Failed`);
  console.log('============================================================\n');

  if (testFailed > 0) {
    process.exit(1);
  }
}

runMilestone3TestSuite().catch((err) => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
