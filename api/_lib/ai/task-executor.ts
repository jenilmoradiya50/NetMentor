/**
 * NetMentor Persistent Background AI Generation Engine - Task Executor
 * 
 * Orchestrates end-to-end background execution for AI lessons, quizzes, and flashcards:
 * 1. Transitions task from 'queued' to 'processing' and resets deadline window
 * 2. Assembles structured prompt from input parameters (with lesson grounding if requested)
 * 3. Checks for cancellation before invoking the AI provider
 * 4. Invokes fallback-orchestrated AI provider (respecting shared chain deadline)
 * 5. Transitions task stage to 'validating_schema'
 * 6. Validates generated output against domain schemas
 * 7. Transitions task stage to 'persisting'
 * 8. Quizzes auto-save to Quiz Library; Lessons and Flashcards remain drafts until approved
 * 9. Completes task atomically, ensuring cancelled tasks never become completed
 */

import {
  getGenerationTaskById,
  startGenerationTaskProcessing,
  updateGenerationTaskStage,
  completeGenerationTask,
  failGenerationTask,
  getUserGeneratedLessonById,
  createUserQuiz,
  deleteUserQuiz,
  type GenerationTaskRecord,
} from '../db/client.js';
import {
  buildLessonGenerationPrompt,
  buildQuizGenerationPrompt,
  buildFlashcardGenerationPrompt,
} from './prompt-builder.js';
import { getActiveAiProvider } from './mock-provider.js';
import { validateGeneratedLesson } from './lesson-validator.js';
import {
  validateGeneratedQuiz,
  stripAnswerKey,
  extractJsonFromText as extractQuizJson,
} from './quiz-validator.js';
import {
  validateGeneratedFlashcards,
  extractJsonFromText as extractFlashcardsJson,
} from './flashcard-validator.js';
import { redactSecrets } from './config.js';
import type {
  GeneratedLessonContent,
  QuizDifficulty,
  QuizQuestionType,
} from './types.js';

// Map of in-flight executor promises for tracking and deterministic test assertions
const inFlightExecutors = new Map<string, Promise<void>>();

/**
 * Returns an active in-flight executor promise if currently executing.
 */
export function getActiveExecutorPromise(taskId: string): Promise<void> | undefined {
  return inFlightExecutors.get(taskId);
}

/**
 * Awaits completion of a background execution task (used for testing and diagnostics).
 */
export async function waitForTaskExecution(taskId: string): Promise<void> {
  const p = inFlightExecutors.get(taskId);
  if (p) {
    await p;
  }
}

/**
 * Checks whether an active task was cancelled by the user.
 */
async function isTaskCancelled(userId: string, taskId: string): Promise<boolean> {
  const task = await getGenerationTaskById(userId, taskId);
  return !task || task.status === 'cancelled';
}

/**
 * Core entrypoint: executes a background AI generation pipeline for a queued task.
 * Called via Vercel waitUntil() or local dev runner.
 */
export async function executeGenerationTask(taskId: string, userId: string): Promise<void> {
  const executionPromise = (async () => {
    try {
      await runTaskPipeline(taskId, userId);
    } catch (err: any) {
      const safeMsg = redactSecrets(err?.message || 'Unexpected background generation error');
      console.error(`[Task Executor Error - Task ${taskId}]:`, safeMsg);

      // Verify cancellation before marking failed
      const wasCancelled = await isTaskCancelled(userId, taskId);
      if (!wasCancelled) {
        try {
          await failGenerationTask(taskId, {
            message: safeMsg,
            category: 'executor_error',
            isRetryable: true,
          });
        } catch (dbErr) {
          console.error(`[Task Executor DB Fail Error - Task ${taskId}]:`, dbErr);
        }
      }
    } finally {
      inFlightExecutors.delete(taskId);
    }
  })();

  inFlightExecutors.set(taskId, executionPromise);
  return executionPromise;
}

/**
 * Internal state-machine pipeline for generation task processing.
 */
async function runTaskPipeline(taskId: string, userId: string): Promise<void> {
  // 1. Transition from 'queued' to 'processing'
  // startGenerationTaskProcessing atomically enforces status='queued' and resets execution_deadline_at
  const started = await startGenerationTaskProcessing(taskId, 'prompting_ai');
  if (!started) {
    console.log(`[Task Executor] Task ${taskId} could not transition to processing (already cancelled or invalid). Halting.`);
    return;
  }

  // 2. Fetch task record & parse input parameters
  const task = await getGenerationTaskById(userId, taskId);
  if (!task || task.status === 'cancelled') {
    return;
  }

  const inputParams: Record<string, any> = typeof task.inputParamsJson === 'string'
    ? JSON.parse(task.inputParamsJson)
    : (task.inputParamsJson || {});

  // 3. Dispatch to task-type specific handler
  switch (task.taskType) {
    case 'lesson':
      await executeLessonTask(task, userId, inputParams);
      break;

    case 'quiz':
      await executeQuizTask(task, userId, inputParams);
      break;

    case 'flashcards':
      await executeFlashcardsTask(task, userId, inputParams);
      break;

    default:
      await failGenerationTask(task.id, {
        message: `Unsupported task type "${task.taskType}".`,
        category: 'invalid_task_type',
        isRetryable: false,
      });
  }
}

/**
 * Handles AI Lesson Generation pipeline.
 * Rule: Lessons remain drafts until user clicks Save (persistedEntityId: null).
 */
async function executeLessonTask(
  task: GenerationTaskRecord,
  userId: string,
  params: Record<string, any>
): Promise<void> {
  const {
    topic,
    difficulty,
    desiredDepth,
    platform,
    prerequisites,
    goals,
    conversationContext,
    conversationId,
  } = params;

  // Construct structured prompt
  const prompt = buildLessonGenerationPrompt({
    topic: String(topic || task.topic).trim(),
    difficulty: difficulty || task.difficulty || 'intermediate',
    desiredDepth: desiredDepth || 'standard',
    platform: platform ? String(platform).trim() : undefined,
    prerequisites: Array.isArray(prerequisites) ? prerequisites.map(String) : undefined,
    goals: Array.isArray(goals) ? goals.map(String) : undefined,
    conversationContext: typeof conversationContext === 'string' ? conversationContext : undefined,
    conversationId: typeof conversationId === 'string' ? conversationId : undefined,
  });

  // Check cancellation before calling AI provider
  if (await isTaskCancelled(userId, task.id)) return;

  const aiProvider = getActiveAiProvider();
  let providerResponse;

  try {
    providerResponse = await aiProvider.generateResponse({
      systemPrompt: prompt.systemPrompt,
      userPrompt: prompt.userPrompt,
      temperature: 0.3,
      maxTokens: 3500,
    });
  } catch (err: any) {
    if (await isTaskCancelled(userId, task.id)) return;
    const safeError = redactSecrets(err?.message || 'AI provider request failed');
    console.warn('[Task Executor AI Provider Error - Lesson]:', safeError);
    await failGenerationTask(task.id, {
      message: 'The AI provider failed to generate the lesson. You may retry.',
      category: 'provider_failure',
      isRetryable: true,
    });
    return;
  }

  // Check cancellation before schema validation
  if (await isTaskCancelled(userId, task.id)) return;

  await updateGenerationTaskStage(task.id, 'validating_schema');

  const validation = validateGeneratedLesson(providerResponse.text);

  if (!validation.valid || !validation.lesson) {
    if (await isTaskCancelled(userId, task.id)) return;

    const errorList = validation.errors || ['Invalid structure'];
    const category = errorList.some((e) => e.startsWith('Malformed JSON') || e.includes('No JSON object'))
      ? 'malformed_json'
      : errorList.some((e) => e.includes('section'))
      ? 'invalid_sections'
      : errorList.some((e) => e.includes('Knowledge Check') || e.includes('knowledgeChecks'))
      ? 'invalid_knowledge_checks'
      : 'missing_required_fields';

    await failGenerationTask(task.id, {
      message: 'The AI output could not be validated against the required lesson schema. You may retry.',
      category,
      isRetryable: true,
    });
    return;
  }

  // Check cancellation before final persisting stage
  if (await isTaskCancelled(userId, task.id)) return;

  await updateGenerationTaskStage(task.id, 'persisting');

  const resultData = {
    success: true,
    lesson: validation.lesson,
    model: providerResponse.model,
    isSimulated: providerResponse.isSimulated ?? false,
    conversationId: conversationId || null,
  };

  // Lessons remain drafts: persistedEntityId is null
  await completeGenerationTask(task.id, resultData, null);
}

/**
 * Handles AI Quiz Generation pipeline.
 * Rule: Quizzes auto-save to user_quizzes table (persistedEntityId: quizId).
 */
async function executeQuizTask(
  task: GenerationTaskRecord,
  userId: string,
  params: Record<string, any>
): Promise<void> {
  const {
    topic,
    difficulty,
    questionCount,
    questionTypes,
    lessonId,
  } = params;

  let resolvedTopic = typeof topic === 'string' ? topic.trim() : task.topic;
  let resolvedLessonTitle: string | undefined = undefined;
  let resolvedLessonId: string | null = null;
  let sections: Array<{ title: string; explanation?: string }> = [];
  let keyTerms: Array<{ term: string; definition: string }> = [];
  let commands: Array<{ command: string; description: string; platform?: string }> = [];
  let lessonSummary: string | undefined = undefined;

  // Grounding from custom lesson if requested
  if (lessonId && typeof lessonId === 'string' && lessonId.trim()) {
    const lesson = await getUserGeneratedLessonById(userId, lessonId.trim());
    if (lesson) {
      resolvedLessonId = lesson.id;
      resolvedLessonTitle = lesson.title;
      if (!resolvedTopic) {
        resolvedTopic = lesson.topic;
      }

      let parsedContent: GeneratedLessonContent | null = null;
      if (lesson.contentJson) {
        try {
          parsedContent = JSON.parse(lesson.contentJson);
        } catch {}
      }

      sections = parsedContent?.sections?.map((s) => ({
        title: s.title,
        explanation: s.explanation,
      })) || [];

      keyTerms = parsedContent?.summary?.keyTerms || [];
      parsedContent?.sections?.forEach((s) => {
        if (s.commands) {
          s.commands.forEach((c) => {
            if (c.command) {
              commands.push({
                command: c.command,
                description: c.description || c.expectedOutput || 'Verification command',
                platform: c.platform,
              });
            }
          });
        }
      });

      lessonSummary = lesson.description || parsedContent?.summary?.whatYouLearned;
    }
  }

  const parsedQuestionCount = typeof questionCount === 'number' && questionCount >= 3 && questionCount <= 25
    ? questionCount
    : 5;

  const validDifficulties: QuizDifficulty[] = ['easy', 'medium', 'hard'];
  const resolvedDifficulty: QuizDifficulty = difficulty && validDifficulties.includes(difficulty)
    ? difficulty
    : (task.difficulty as QuizDifficulty) || 'medium';

  const validTypes: QuizQuestionType[] = ['single_choice', 'multiple_select', 'true_false', 'scenario'];
  const resolvedTypes = Array.isArray(questionTypes) && questionTypes.length > 0
    ? questionTypes.filter((t) => validTypes.includes(t))
    : validTypes;

  const prompt = buildQuizGenerationPrompt({
    topic: resolvedTopic,
    difficulty: resolvedDifficulty,
    questionCount: parsedQuestionCount,
    questionTypes: resolvedTypes,
    lessonTitle: resolvedLessonTitle,
    lessonId: resolvedLessonId || undefined,
    lessonContentSummary: lessonSummary,
    sections,
    keyTerms,
    commands,
  });

  // Check cancellation before provider invocation
  if (await isTaskCancelled(userId, task.id)) return;

  const aiProvider = getActiveAiProvider();
  let providerResponse;

  try {
    providerResponse = await aiProvider.generateResponse({
      systemPrompt: prompt.systemPrompt,
      userPrompt: prompt.userPrompt,
      temperature: 0.3,
      maxTokens: 4000,
    });
  } catch (err: any) {
    if (await isTaskCancelled(userId, task.id)) return;
    const safeError = redactSecrets(err?.message || 'AI provider request failed');
    console.warn('[Task Executor AI Provider Error - Quiz]:', safeError);
    await failGenerationTask(task.id, {
      message: 'The AI provider failed to generate quiz questions. You may retry.',
      category: 'provider_failure',
      isRetryable: true,
    });
    return;
  }

  // Check cancellation before schema validation
  if (await isTaskCancelled(userId, task.id)) return;

  await updateGenerationTaskStage(task.id, 'validating_schema');

  const extracted = extractQuizJson(providerResponse.text);
  if (!extracted.success || !extracted.data) {
    if (await isTaskCancelled(userId, task.id)) return;
    const category = extracted.isTruncated ? 'truncated_json' : 'malformed_json';
    const message = extracted.isTruncated
      ? 'The AI output was cut off before completion. Please retry with fewer questions.'
      : 'The AI output could not be parsed as valid JSON. You may retry.';

    await failGenerationTask(task.id, {
      message,
      category,
      isRetryable: true,
    });
    return;
  }

  const validation = validateGeneratedQuiz(extracted.data, parsedQuestionCount);

  if (!validation.valid || !validation.quiz) {
    if (await isTaskCancelled(userId, task.id)) return;
    const errorList = validation.errors || ['Invalid quiz structure'];
    const category = errorList.some((e) => e.includes('questions') || e.includes('empty'))
      ? 'missing_questions'
      : 'invalid_question_fields';

    await failGenerationTask(task.id, {
      message: `The AI output could not be validated against the required quiz schema. (${errorList[0] || 'Schema mismatch'})`,
      category,
      isRetryable: true,
    });
    return;
  }

  // Attach lesson linkages
  const fullQuiz = validation.quiz;
  fullQuiz.lessonId = resolvedLessonId;
  fullQuiz.lessonTitle = resolvedLessonTitle || null;

  // Check cancellation before auto-persisting to user_quizzes
  if (await isTaskCancelled(userId, task.id)) return;

  await updateGenerationTaskStage(task.id, 'persisting');

  let persistedRecord;
  try {
    persistedRecord = await createUserQuiz(userId, {
      lessonId: fullQuiz.lessonId,
      title: fullQuiz.title,
      topic: fullQuiz.topic,
      difficulty: fullQuiz.difficulty,
      questionCount: fullQuiz.questions.length,
      questionTypes: fullQuiz.questionTypes,
      questionsJson: JSON.stringify(fullQuiz.questions),
    });
  } catch (dbErr: any) {
    if (await isTaskCancelled(userId, task.id)) return;
    console.error('[Task Executor DB Save Quiz Error]:', dbErr);
    await failGenerationTask(task.id, {
      message: 'Failed to auto-save generated quiz to database.',
      category: 'persistence_error',
      isRetryable: true,
    });
    return;
  }

  fullQuiz.id = persistedRecord.id;

  // Prepare result data for client (strips answer keys to prevent leaking)
  const clientQuiz = stripAnswerKey(fullQuiz);

  const resultData = {
    success: true,
    quiz: clientQuiz,
    quizId: persistedRecord.id,
    lessonId: resolvedLessonId,
    model: providerResponse.model,
    isSimulated: providerResponse.isSimulated ?? false,
  };

  // Check cancellation before final completion
  if (await isTaskCancelled(userId, task.id)) {
    try {
      await deleteUserQuiz(userId, persistedRecord.id);
    } catch (cleanupErr) {
      console.warn(`[Task Executor Cleanup Notice - Task ${task.id}]:`, cleanupErr);
    }
    return;
  }

  await completeGenerationTask(task.id, resultData, persistedRecord.id);
}

/**
 * Handles AI Flashcard Generation pipeline.
 * Rule: Flashcards remain drafts until user previews and saves (persistedEntityId: null).
 */
async function executeFlashcardsTask(
  task: GenerationTaskRecord,
  userId: string,
  params: Record<string, any>
): Promise<void> {
  const {
    lessonId,
    topic,
    cardCount,
    focusArea,
    difficulty,
    emphasis,
  } = params;

  const hasLessonId = typeof lessonId === 'string' && Boolean(lessonId.trim());
  const hasTopic = typeof topic === 'string' && Boolean(topic.trim());

  const parsedCardCount = typeof cardCount === 'number' && cardCount >= 3 && cardCount <= 25
    ? cardCount
    : 10;

  let prompt;
  let lessonRecord: any = null;
  const resolvedTopic = hasTopic ? topic.trim() : task.topic;

  if (hasLessonId) {
    const lesson = await getUserGeneratedLessonById(userId, lessonId.trim());
    if (lesson) {
      lessonRecord = lesson;

      let parsedContent: GeneratedLessonContent | null = null;
      if (lesson.contentJson) {
        try {
          parsedContent = JSON.parse(lesson.contentJson);
        } catch {}
      }

      const sections = parsedContent?.sections?.map((s) => ({
        title: s.title,
        explanation: s.explanation,
      })) || [];

      const keyTerms = parsedContent?.summary?.keyTerms || [];
      const commands: Array<{ command: string; description: string; platform?: string }> = [];
      parsedContent?.sections?.forEach((s) => {
        if (s.commands) {
          s.commands.forEach((c) => {
            if (c.command) {
              commands.push({
                command: c.command,
                description: c.description || c.expectedOutput || 'Command verification',
                platform: c.platform,
              });
            }
          });
        }
      });

      prompt = buildFlashcardGenerationPrompt({
        lessonTitle: lesson.title,
        topic: lesson.topic,
        difficulty: difficulty || lesson.difficulty || task.difficulty,
        cardCount: parsedCardCount,
        focusArea,
        emphasis,
        lessonContentSummary: lesson.description || parsedContent?.summary?.whatYouLearned,
        sections,
        keyTerms,
        commands,
      });
    } else {
      prompt = buildFlashcardGenerationPrompt({
        topic: resolvedTopic,
        difficulty: difficulty || task.difficulty || 'intermediate',
        cardCount: parsedCardCount,
        focusArea,
        emphasis,
      });
    }
  } else {
    prompt = buildFlashcardGenerationPrompt({
      topic: resolvedTopic,
      difficulty: difficulty || task.difficulty || 'intermediate',
      cardCount: parsedCardCount,
      focusArea,
      emphasis,
    });
  }

  // Check cancellation before calling AI
  if (await isTaskCancelled(userId, task.id)) return;

  const aiProvider = getActiveAiProvider();
  let providerResponse;

  try {
    providerResponse = await aiProvider.generateResponse({
      systemPrompt: prompt.systemPrompt,
      userPrompt: prompt.userPrompt,
      temperature: 0.3,
      maxTokens: 3000,
    });
  } catch (err: any) {
    if (await isTaskCancelled(userId, task.id)) return;
    const safeError = redactSecrets(err?.message || 'AI provider request failed');
    console.warn('[Task Executor AI Provider Error - Flashcards]:', safeError);
    await failGenerationTask(task.id, {
      message: 'The AI provider failed to generate flashcards. You may retry.',
      category: 'provider_failure',
      isRetryable: true,
    });
    return;
  }

  // Check cancellation before schema validation
  if (await isTaskCancelled(userId, task.id)) return;

  await updateGenerationTaskStage(task.id, 'validating_schema');

  const extracted = extractFlashcardsJson(providerResponse.text);
  if (!extracted.success || !extracted.data) {
    if (await isTaskCancelled(userId, task.id)) return;
    const category = extracted.isTruncated ? 'truncated_json' : 'malformed_json';
    const message = extracted.isTruncated
      ? 'The AI output was cut off before completion. Please retry with a smaller card count.'
      : 'The AI output could not be parsed as valid JSON. You may retry.';

    await failGenerationTask(task.id, {
      message,
      category,
      isRetryable: true,
    });
    return;
  }

  const validation = validateGeneratedFlashcards(extracted.data, parsedCardCount);

  if (!validation.valid || !validation.deck) {
    if (await isTaskCancelled(userId, task.id)) return;
    const errorList = validation.errors || ['Invalid flashcard structure'];
    const category = errorList.some((e) => e.includes('cards') || e.includes('empty'))
      ? 'missing_cards'
      : 'invalid_card_fields';

    await failGenerationTask(task.id, {
      message: 'The AI output could not be validated against the required flashcard schema.',
      category,
      isRetryable: true,
    });
    return;
  }

  // Check cancellation before final persisting stage
  if (await isTaskCancelled(userId, task.id)) return;

  await updateGenerationTaskStage(task.id, 'persisting');

  const resultData = {
    success: true,
    deck: validation.deck,
    lessonId: lessonRecord?.id,
    topic: resolvedTopic,
    model: providerResponse.model,
    isSimulated: providerResponse.isSimulated ?? false,
  };

  // Flashcards remain drafts: persistedEntityId is null
  await completeGenerationTask(task.id, resultData, null);
}
