/**
 * NetMentor Background AI Generation Task Creator - POST /api/ai/tasks/create
 * 
 * Asynchronously initiates an AI generation job (lesson, quiz, or flashcards):
 * 1. Authenticates user and validates CSRF tokens
 * 2. Enforces per-user rate limiting
 * 3. Validates task parameters server-side
 * 4. Generates a deterministic idempotency key across all input parameters
 * 5. Persists the task to the database in 'queued' status
 * 6. Schedules background execution via Vercel Fluid Compute waitUntil()
 * 7. Returns HTTP 202 Accepted (or HTTP 200 if duplicate already exists)
 */

import crypto from 'node:crypto';
import { waitUntil } from '@vercel/functions';
import type { ApiRequest, ApiResponse } from '../../_lib/types.js';
import { requireAuth } from '../../_lib/auth-guard.js';
import { tutorRateLimiter } from '../../_lib/ai/rate-limiter.js';
import {
  createGenerationTask,
  getUserGeneratedLessonById,
} from '../../_lib/db/client.js';
import { executeGenerationTask } from '../../_lib/ai/task-executor.js';

const MAX_PAYLOAD_SIZE = 25600; // 25KB limit

/**
 * Computes a deterministic SHA-256 idempotency key from user ID, task type,
 * and canonicalized input parameters.
 */
export function generateTaskDeterministicIdempotencyKey(
  userId: string,
  taskType: string,
  params: Record<string, any>
): string {
  const sortedKeys = Object.keys(params).sort();
  const canonicalObj: Record<string, any> = {};
  for (const k of sortedKeys) {
    const val = params[k];
    if (val !== undefined && val !== null && k !== 'clientTimestamp' && k !== 'requestId') {
      canonicalObj[k] = val;
    }
  }
  const payloadStr = JSON.stringify(canonicalObj);
  return crypto.createHash('sha256').update(`${userId}:${taskType}:${payloadStr}`).digest('hex');
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  // 1. Enforce POST HTTP Method
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({
      error: 'Method Not Allowed',
      message: 'Only POST requests are supported for task creation.',
    });
  }

  // 2. Authentication & CSRF Protection
  const session = await requireAuth(req, res);
  if (!session) {
    return;
  }
  const userId = session.userId || session.sub;

  // 3. User-Specific Rate Limiting
  const rateLimit = tutorRateLimiter.check(userId);
  if (!rateLimit.allowed) {
    res.setHeader('Retry-After', String(rateLimit.retryAfterSeconds));
    return res.status(429).json({
      error: 'Too Many Requests',
      message: 'AI generation task quota exceeded. Please try again shortly.',
      retryAfter: rateLimit.retryAfterSeconds,
    });
  }

  // 4. Request Payload Size & JSON Validation
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Request body must be a valid JSON object.',
    });
  }

  try {
    const payloadLength = JSON.stringify(req.body).length;
    if (payloadLength > MAX_PAYLOAD_SIZE) {
      return res.status(413).json({
        error: 'Payload Too Large',
        message: `Request payload exceeds maximum permitted size of ${MAX_PAYLOAD_SIZE} bytes.`,
      });
    }
  } catch {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Malformed request payload.',
    });
  }

  const { taskType, inputParams } = req.body;

  // 5. Validate Task Type
  const validTaskTypes = ['lesson', 'quiz', 'flashcards'] as const;
  if (!taskType || !validTaskTypes.includes(taskType)) {
    return res.status(400).json({
      error: 'Bad Request',
      message: `Invalid "taskType". Must be one of: ${validTaskTypes.join(', ')}.`,
    });
  }

  if (!inputParams || typeof inputParams !== 'object' || Array.isArray(inputParams)) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Parameter "inputParams" must be a valid JSON object containing generation parameters.',
    });
  }

  // 6. Parameter Validation per Task Type
  let derivedTitle = '';
  let derivedTopic = '';
  let derivedDifficulty = (inputParams.difficulty || 'intermediate').toLowerCase();

  switch (taskType) {
    case 'lesson': {
      const topic = inputParams.topic;
      if (typeof topic !== 'string' || !topic.trim()) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Parameter "topic" is required for lesson generation.',
        });
      }
      if (topic.trim().length > 200) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Topic cannot exceed 200 characters.',
        });
      }
      derivedTopic = topic.trim();
      derivedTitle = inputParams.title ? String(inputParams.title).trim() : `Lesson: ${derivedTopic}`;
      break;
    }

    case 'quiz': {
      const { topic, lessonId } = inputParams;
      const hasTopic = typeof topic === 'string' && Boolean(topic.trim());
      const hasLessonId = typeof lessonId === 'string' && Boolean(lessonId.trim());

      if (!hasTopic && !hasLessonId) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Either "topic" or "lessonId" must be provided to generate a quiz.',
        });
      }

      if (hasLessonId) {
        const lesson = await getUserGeneratedLessonById(userId, lessonId.trim());
        if (!lesson) {
          return res.status(404).json({
            error: 'Not Found',
            message: 'Source custom lesson was not found or access denied.',
          });
        }
        derivedTopic = hasTopic ? topic.trim() : lesson.topic;
        derivedTitle = inputParams.title ? String(inputParams.title).trim() : `Quiz: ${lesson.title}`;
        derivedDifficulty = (inputParams.difficulty || lesson.difficulty || 'medium').toLowerCase();
      } else {
        derivedTopic = topic.trim();
        derivedTitle = inputParams.title ? String(inputParams.title).trim() : `Quiz: ${derivedTopic}`;
      }
      break;
    }

    case 'flashcards': {
      const { topic, lessonId } = inputParams;
      const hasTopic = typeof topic === 'string' && Boolean(topic.trim());
      const hasLessonId = typeof lessonId === 'string' && Boolean(lessonId.trim());

      if (!hasTopic && !hasLessonId) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Either "topic" or "lessonId" must be provided to generate flashcards.',
        });
      }

      if (hasLessonId) {
        const lesson = await getUserGeneratedLessonById(userId, lessonId.trim());
        if (!lesson) {
          return res.status(404).json({
            error: 'Not Found',
            message: 'Source custom lesson was not found or access denied.',
          });
        }
        derivedTopic = hasTopic ? topic.trim() : lesson.topic;
        derivedTitle = inputParams.title ? String(inputParams.title).trim() : `Flashcards: ${lesson.title}`;
        derivedDifficulty = (inputParams.difficulty || lesson.difficulty || 'intermediate').toLowerCase();
      } else {
        const cleanTopic = topic.trim();
        if (cleanTopic.length < 2 || cleanTopic.length > 200) {
          return res.status(400).json({
            error: 'Bad Request',
            message: 'Parameter "topic" must be between 2 and 200 characters.',
          });
        }
        derivedTopic = cleanTopic;
        derivedTitle = inputParams.title ? String(inputParams.title).trim() : `Flashcards: ${derivedTopic}`;
      }
      break;
    }
  }

  // 7. Compute Deterministic Idempotency Key
  const idempotencyKey = generateTaskDeterministicIdempotencyKey(userId, taskType, inputParams);

  // 8. Persist Task in DB (starts in 'queued' status)
  let createResult;
  try {
    createResult = await createGenerationTask(userId, {
      taskType,
      title: derivedTitle,
      topic: derivedTopic,
      difficulty: derivedDifficulty,
      idempotencyKey,
      inputParams,
    });
  } catch (dbErr: any) {
    console.error('[Database Error creating generation task]:', dbErr);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create generation task in database.',
    });
  }

  const { task, alreadyExists } = createResult;

  // 9. If New Task, Schedule Asynchronous Background Execution via waitUntil()
  if (!alreadyExists) {
    const backgroundPromise = executeGenerationTask(task.id, userId).catch((execErr) => {
      console.error(`[Background Execution Error - Task ${task.id}]:`, execErr);
    });

    try {
      waitUntil(backgroundPromise);
    } catch (waitUntilErr) {
      // In local dev/testing where Fluid Compute context is simulated, promise still runs
      console.warn('[waitUntil registration notice]:', waitUntilErr);
    }

    return res.status(202).json({
      success: true,
      task,
      alreadyExists: false,
    });
  }

  // If already exists, return existing task with HTTP 200
  return res.status(200).json({
    success: true,
    task,
    alreadyExists: true,
  });
}
