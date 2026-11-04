import assert from 'node:assert';
import crypto from 'node:crypto';
import {
  createGenerationTask,
  startGenerationTaskProcessing,
  getGenerationTaskById,
  getUserActiveGenerationTasks,
  updateGenerationTaskStage,
  completeGenerationTask,
  failGenerationTask,
  cancelGenerationTask,
  cleanupStaleGenerationTasks,
  getTaskExecutionDeadlineSeconds,
  __setTestMockStore,
  type GenerationTaskRecord,
} from '../api/_lib/db/client.ts';

console.log('=== STARTING NETMENTOR GENERATION TASKS DATABASE LAYER TEST SUITE ===');

async function runTests() {
  // Use in-memory mock store for deterministic unit testing
  const mockTasks = new Map<string, GenerationTaskRecord>();

  __setTestMockStore({
    createGenerationTask: async (userId: string, task: any) => {
      // Check existing active
      for (const t of mockTasks.values()) {
        if (
          t.userId === userId &&
          t.idempotencyKey === task.idempotencyKey &&
          (t.status === 'queued' || t.status === 'processing')
        ) {
          return { task: t, alreadyExists: true };
        }
      }

      const id = task.id || crypto.randomUUID();
      const queueTimeoutSeconds = task.queueTimeoutSeconds || 180;
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
        executionDeadlineAt: new Date(Date.now() + queueTimeoutSeconds * 1000).toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        completedAt: null,
      };

      mockTasks.set(id, record);
      return { task: record, alreadyExists: false };
    },

    startGenerationTaskProcessing: async (
      taskId: string,
      stage: any = 'prompting_ai',
      executionBudgetSeconds: number = getTaskExecutionDeadlineSeconds()
    ) => {
      const task = mockTasks.get(taskId);
      if (!task || task.status !== 'queued') return false;
      task.status = 'processing';
      task.currentStage = stage;
      task.executionDeadlineAt = new Date(Date.now() + executionBudgetSeconds * 1000).toISOString();
      task.updatedAt = new Date().toISOString();
      return true;
    },

    getGenerationTaskById: async (userId: string, taskId: string) => {
      const task = mockTasks.get(taskId);
      if (!task || task.userId !== userId) return null;

      // Self-heal check: only self-heal if still in queued or processing and deadline passed
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
      for (const t of mockTasks.values()) {
        if (
          t.userId === userId &&
          (t.status === 'queued' || t.status === 'processing') &&
          (!t.executionDeadlineAt || new Date(t.executionDeadlineAt) > now)
        ) {
          active.push(t);
        }
      }
      return active;
    },

    updateGenerationTaskStage: async (taskId: string, stage: any) => {
      const task = mockTasks.get(taskId);
      if (!task || task.status !== 'processing') return false;
      task.currentStage = stage;
      task.updatedAt = new Date().toISOString();
      return true;
    },

    completeGenerationTask: async (taskId: string, resultData: any, persistedEntityId?: string) => {
      const task = mockTasks.get(taskId);
      // Atomic guard: ONLY succeed if still in processing status
      if (!task || task.status !== 'processing') return false;
      task.status = 'completed';
      task.currentStage = 'persisting';
      task.resultDataJson = typeof resultData === 'string' ? resultData : JSON.stringify(resultData);
      task.persistedEntityId = persistedEntityId || null;
      task.completedAt = new Date().toISOString();
      task.updatedAt = new Date().toISOString();
      return true;
    },

    failGenerationTask: async (taskId: string, error: any) => {
      const task = mockTasks.get(taskId);
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
      const task = mockTasks.get(taskId);
      if (!task || task.userId !== userId || (task.status !== 'queued' && task.status !== 'processing')) {
        return false;
      }
      task.status = 'cancelled';
      task.completedAt = new Date().toISOString();
      task.updatedAt = new Date().toISOString();
      return true;
    },

    cleanupStaleGenerationTasks: async (graceBufferSeconds: number = 5) => {
      let count = 0;
      const thresholdTime = Date.now() - (graceBufferSeconds * 1000);
      for (const task of mockTasks.values()) {
        if (task.status === 'queued' || task.status === 'processing') {
          // Strictly requires execution deadline to have passed with grace buffer
          if (task.executionDeadlineAt && new Date(task.executionDeadlineAt).getTime() < thresholdTime) {
            task.status = 'failed';
            task.errorMessage = 'The task exceeded its permitted execution deadline and timed out.';
            task.errorCategory = 'timeout';
            task.isRetryable = true;
            task.completedAt = new Date().toISOString();
            task.updatedAt = new Date().toISOString();
            count++;
          }
        }
      }
      return count;
    },
  });

  // TEST 1: Task Creation in 'queued' Status
  console.log('\n1. Testing Generation Task Creation (Explicit Lifecycle):');
  const userId = 'user-test-uuid-1';
  const idempotencyKey1 = crypto.createHash('sha256').update(`${userId}:quiz:ospf:medium:5`).digest('hex');

  const createResult1 = await createGenerationTask(userId, {
    taskType: 'quiz',
    title: 'OSPF Neighbor States Assessment',
    topic: 'OSPF',
    difficulty: 'medium',
    idempotencyKey: idempotencyKey1,
    inputParams: { topic: 'OSPF', difficulty: 'medium', questionCount: 5, questionTypes: ['single_choice'] },
  });

  assert.strictEqual(createResult1.alreadyExists, false, 'Initial creation should not exist yet');
  assert.strictEqual(createResult1.task.status, 'queued', 'Newly created task must start in "queued" status');
  assert.strictEqual(createResult1.task.currentStage, 'queued', 'Initial stage must be "queued"');
  assert.strictEqual(createResult1.task.title, 'OSPF Neighbor States Assessment');
  assert(Boolean(createResult1.task.executionDeadlineAt), 'Deadline must be set');
  const queueDeadlineMs = new Date(createResult1.task.executionDeadlineAt!).getTime() - Date.now();
  assert(queueDeadlineMs > 100000, 'Queued task must receive generous queue timeout (>100s)');
  console.log('   ✓ Task created with status="queued" and queue timeout deadline');

  // TEST 2: Transition from 'queued' to 'processing' and deadline reset
  console.log('\n2. Testing Coordinated Transition (queued -> processing) & Deadline Reset:');
  const started = await startGenerationTaskProcessing(createResult1.task.id, 'prompting_ai', 50);
  assert.strictEqual(started, true, 'Transition to processing must succeed');

  const processingTask = await getGenerationTaskById(userId, createResult1.task.id);
  assert.strictEqual(processingTask?.status, 'processing');
  assert.strictEqual(processingTask?.currentStage, 'prompting_ai');
  const processingDeadlineMs = new Date(processingTask!.executionDeadlineAt!).getTime() - Date.now();
  assert(processingDeadlineMs > 40000 && processingDeadlineMs <= 55000, 'Processing deadline must be reset to execution window (~50s)');
  console.log('   ✓ Transition to "processing" resets deadline to 50s execution window');

  // TEST 3: Atomic Duplicate Prevention (Idempotency)
  console.log('\n3. Testing Atomic Duplicate Prevention:');
  const duplicateResult = await createGenerationTask(userId, {
    taskType: 'quiz',
    title: 'OSPF Neighbor States Assessment',
    topic: 'OSPF',
    difficulty: 'medium',
    idempotencyKey: idempotencyKey1,
    inputParams: { topic: 'OSPF', difficulty: 'medium', questionCount: 5, questionTypes: ['single_choice'] },
  });

  assert.strictEqual(duplicateResult.alreadyExists, true, 'Duplicate submission must be detected');
  assert.strictEqual(duplicateResult.task.id, createResult1.task.id, 'Must return the original task ID');
  console.log('   ✓ Atomic duplicate submission prevented; original in-flight task returned');

  // TEST 4: Stage Progression
  console.log('\n4. Testing Stage Transitions:');
  const updatedStage1 = await updateGenerationTaskStage(createResult1.task.id, 'validating_schema');
  assert.strictEqual(updatedStage1, true, 'Stage update to validating_schema must succeed');

  const fetchedTask = await getGenerationTaskById(userId, createResult1.task.id);
  assert.strictEqual(fetchedTask?.currentStage, 'validating_schema');
  console.log('   ✓ Stage transition to "validating_schema" recorded');

  // TEST 5: Early Cancellation in 'queued' Status
  console.log('\n5. Testing Early Cancellation in "queued" Status:');
  const idempotencyKeyEarlyCancel = crypto.createHash('sha256').update(`${userId}:quiz:early:cancel`).digest('hex');
  const earlyTask = await createGenerationTask(userId, {
    taskType: 'quiz',
    title: 'Early Cancel Test',
    topic: 'VLANs',
    idempotencyKey: idempotencyKeyEarlyCancel,
    inputParams: { topic: 'VLANs' },
  });
  assert.strictEqual(earlyTask.task.status, 'queued');

  const cancelQueuedResult = await cancelGenerationTask(userId, earlyTask.task.id);
  assert.strictEqual(cancelQueuedResult, true, 'Cancellation while queued must succeed');

  // Execution engine tries to start cancelled task -> MUST be rejected
  const lateStartResult = await startGenerationTaskProcessing(earlyTask.task.id);
  assert.strictEqual(lateStartResult, false, 'Starting processing on a cancelled task must fail');
  console.log('   ✓ Cancellation while queued prevents task from ever entering processing');

  // TEST 6: Mid-Flight Cancellation & Race Condition Guard
  console.log('\n6. Testing Mid-Flight Cancellation & Immutable Status Defense:');
  const cancelled = await cancelGenerationTask(userId, createResult1.task.id);
  assert.strictEqual(cancelled, true, 'User cancellation must succeed');

  const cancelledTask = await getGenerationTaskById(userId, createResult1.task.id);
  assert.strictEqual(cancelledTask?.status, 'cancelled', 'Task status must be cancelled');

  // Late complete attempt MUST fail
  const lateCompleteResult = await completeGenerationTask(
    createResult1.task.id,
    { questions: ['fake question'] },
    'fake-quiz-id'
  );
  assert.strictEqual(lateCompleteResult, false, 'Late completion on cancelled task MUST fail');

  // Late fail attempt MUST fail
  const lateFailResult = await failGenerationTask(createResult1.task.id, {
    message: 'Late failure from provider',
    category: 'provider_error',
  });
  assert.strictEqual(lateFailResult, false, 'Late failure on cancelled task MUST fail');

  const postCancelTask = await getGenerationTaskById(userId, createResult1.task.id);
  assert.strictEqual(postCancelTask?.status, 'cancelled', 'Status remains immutable as cancelled');
  console.log('   ✓ Cancelled status is immutable; late completion and failure safely rejected');

  // TEST 7: Successful Completion with Linkage
  console.log('\n7. Testing Successful Completion:');
  const idempotencyKey2 = crypto.createHash('sha256').update(`${userId}:quiz:ospf:hard:10`).digest('hex');
  const createResult2 = await createGenerationTask(userId, {
    taskType: 'quiz',
    title: 'OSPF Hard Assessment',
    topic: 'OSPF',
    difficulty: 'hard',
    idempotencyKey: idempotencyKey2,
    inputParams: { topic: 'OSPF', difficulty: 'hard', questionCount: 10 },
  });
  await startGenerationTaskProcessing(createResult2.task.id);

  const completedSuccess = await completeGenerationTask(
    createResult2.task.id,
    { questions: [{ id: 'q1', prompt: 'What is OSPF?' }] },
    'quiz-persisted-123'
  );
  assert.strictEqual(completedSuccess, true, 'Completion must succeed on processing task');

  const finalTask2 = await getGenerationTaskById(userId, createResult2.task.id);
  assert.strictEqual(finalTask2?.status, 'completed');
  assert.strictEqual(finalTask2?.persistedEntityId, 'quiz-persisted-123');
  console.log('   ✓ Successful completion recorded with persisted entity link');

  // TEST 8: Stale-Task Sweeper Protection (Active tasks within deadline are NOT failed)
  console.log('\n8. Testing Stale Cleanup Safety (Legitimate execution is preserved):');
  const idempotencyKeySafe = crypto.createHash('sha256').update(`${userId}:lesson:active:safe`).digest('hex');
  const safeTask = await createGenerationTask(userId, {
    taskType: 'lesson',
    title: 'Safe Active Lesson',
    topic: 'BGP',
    idempotencyKey: idempotencyKeySafe,
    inputParams: { topic: 'BGP' },
    deadlineSeconds: 120, // Long future deadline
  });
  await startGenerationTaskProcessing(safeTask.task.id);

  // Run cleanup sweeper
  const cleanedCount = await cleanupStaleGenerationTasks(5);
  const stillActiveTask = await getGenerationTaskById(userId, safeTask.task.id);
  assert.strictEqual(stillActiveTask?.status, 'processing', 'Task within permitted window must NOT be failed by sweeper');
  console.log('   ✓ Sweeper correctly protected active task within legitimate window');

  // TEST 9: Self-Healing Timeout on Expired Task
  console.log('\n9. Testing Self-Healing Timeout on Truly Expired Task:');
  const idempotencyKeyExpired = crypto.createHash('sha256').update(`${userId}:flashcards:stp`).digest('hex');
  const expiredTask = await createGenerationTask(userId, {
    taskType: 'flashcards',
    title: 'STP Cards',
    topic: 'STP',
    idempotencyKey: idempotencyKeyExpired,
    inputParams: { topic: 'STP' },
    queueTimeoutSeconds: -10, // Expired deadline while queued
  });

  const selfHealedTask = await getGenerationTaskById(userId, expiredTask.task.id);
  assert.strictEqual(selfHealedTask?.status, 'failed', 'Expired task must self-heal to failed');
  assert.strictEqual(selfHealedTask?.errorCategory, 'timeout', 'Category must be timeout');
  assert(selfHealedTask?.errorMessage?.includes('queue'), 'Queued timeout message must be distinct from processing timeout');
  console.log('   ✓ Expired queued task self-healed to "failed" with queue-specific timeout message');

  // TEST 10: Execution Deadline Ceiling Clamping
  console.log('\n10. Testing Execution Deadline Ceiling Clamping:');
  const prevEnv = process.env.AI_TASK_DEADLINE_SECONDS;
  try {
    process.env.AI_TASK_DEADLINE_SECONDS = '300';
    const clampedDeadline = getTaskExecutionDeadlineSeconds();
    assert.strictEqual(clampedDeadline, 55, 'Deadline must strictly clamp to 55s ceiling within 60s function limit');
    
    process.env.AI_TASK_DEADLINE_SECONDS = '5';
    const minClampedDeadline = getTaskExecutionDeadlineSeconds();
    assert.strictEqual(minClampedDeadline, 15, 'Deadline must clamp to minimum safe lower bound 15s');

    delete process.env.AI_TASK_DEADLINE_SECONDS;
    const defaultDeadline = getTaskExecutionDeadlineSeconds();
    assert.strictEqual(defaultDeadline, 50, 'Default deadline must be 50s (reserving 10s headroom)');
    console.log('   ✓ Deadline ceiling strictly clamped to <= 55s and defaults to 50s');
  } finally {
    if (prevEnv !== undefined) {
      process.env.AI_TASK_DEADLINE_SECONDS = prevEnv;
    } else {
      delete process.env.AI_TASK_DEADLINE_SECONDS;
    }
  }

  // Clean up mock store
  __setTestMockStore(null);

  console.log('\n============================================================');
  console.log('✓ ALL 10 GENERATION TASK DATABASE TESTS PASSED CLEANLY!');
  console.log('============================================================\n');
}

runTests().catch((err) => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
