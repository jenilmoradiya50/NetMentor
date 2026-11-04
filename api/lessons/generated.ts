/**
 * NetMentor Generated Lessons API Endpoint - /api/lessons/generated
 * 
 * Supports CRUD operations for the user's Personal Learning Library:
 * - GET: List saved generated lessons or retrieve a single lesson by ID
 * - POST: Save a validated generated lesson to PostgreSQL
 * - PATCH: Rename a generated lesson
 * - DELETE: Delete a generated lesson with strict user ownership enforcement
 */

import type { ApiRequest, ApiResponse } from '../_lib/types.js';
import { requireAuth } from '../_lib/auth-guard.js';
import {
  createUserGeneratedLesson,
  getUserGeneratedLessons,
  getUserGeneratedLessonById,
  updateUserGeneratedLessonTitle,
  deleteUserGeneratedLesson,
} from '../_lib/db/client.js';
import { validateGeneratedLesson } from '../_lib/ai/lesson-validator.js';
import type { GeneratedLessonContent } from '../_lib/ai/types.js';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  // 1. Authenticate user
  const session = await requireAuth(req, res);
  if (!session) {
    return;
  }
  const userId = session.userId || session.sub;

  const method = req.method?.toUpperCase();

  switch (method) {
    case 'GET':
      return handleGet(req, res, userId);
    case 'POST':
      return handlePost(req, res, userId);
    case 'PATCH':
      return handlePatch(req, res, userId);
    case 'DELETE':
      return handleDelete(req, res, userId);
    default:
      res.setHeader('Allow', 'GET, POST, PATCH, DELETE');
      return res.status(405).json({
        error: 'Method Not Allowed',
        message: `HTTP method ${method} is not supported on this endpoint.`,
      });
  }
}

/**
 * GET: Retrieve list of user's generated lessons or a single lesson by ID.
 */
async function handleGet(req: ApiRequest, res: ApiResponse, userId: string) {
  let lessonId = typeof req.query?.id === 'string' ? req.query.id.trim() : undefined;
  let search = typeof req.query?.search === 'string' ? req.query.search.trim() : undefined;
  let difficulty = typeof req.query?.difficulty === 'string' ? req.query.difficulty.trim() : undefined;

  if (!lessonId && req.url && req.url.includes('?')) {
    try {
      const searchParams = new URL(req.url, 'http://localhost').searchParams;
      if (!lessonId) lessonId = searchParams.get('id')?.trim() || undefined;
      if (!search) search = searchParams.get('search')?.trim() || undefined;
      if (!difficulty) difficulty = searchParams.get('difficulty')?.trim() || undefined;
    } catch {}
  }

  if (lessonId) {
    const lesson = await getUserGeneratedLessonById(userId, lessonId);
    if (!lesson) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Generated lesson not found or access denied.',
      });
    }

    let parsedContent: GeneratedLessonContent | null = null;
    try {
      parsedContent = JSON.parse(lesson.contentJson);
    } catch {
      parsedContent = null;
    }

    return res.status(200).json({
      success: true,
      lesson: {
        ...lesson,
        content: parsedContent,
      },
    });
  }

  const lessons = await getUserGeneratedLessons(userId, { search, difficulty });

  // Map to summaries for list view (exclude large content_json from list responses)
  const summaries = lessons.map((l) => ({
    id: l.id,
    userId: l.userId,
    conversationId: l.conversationId,
    title: l.title,
    topic: l.topic,
    description: l.description,
    difficulty: l.difficulty,
    estimatedMinutes: l.estimatedMinutes,
    tags: l.tags,
    prerequisites: l.prerequisites,
    learningObjectives: l.learningObjectives,
    createdAt: l.createdAt,
    updatedAt: l.updatedAt,
  }));

  return res.status(200).json({
    success: true,
    lessons: summaries,
    count: summaries.length,
  });
}

/**
 * POST: Persist a validated previewed lesson to the user's Personal Learning Library.
 */
async function handlePost(req: ApiRequest, res: ApiResponse, userId: string) {
  if (!req.body || typeof req.body !== 'object') {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Request body must be a valid JSON object.',
    });
  }

  const { lesson, conversationId } = req.body as {
    lesson: unknown;
    conversationId?: string;
  };

  if (!lesson) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Missing "lesson" property in request body.',
    });
  }

  // Validate the lesson structure before saving to prevent storing malformed lessons
  const validation = validateGeneratedLesson(lesson);
  if (!validation.valid || !validation.lesson) {
    return res.status(422).json({
      error: 'Unprocessable Entity',
      message: 'Lesson structure failed schema validation.',
      errors: validation.errors || [],
    });
  }

  const validLesson = validation.lesson;

  try {
    const saved = await createUserGeneratedLesson(userId, {
      conversationId: typeof conversationId === 'string' ? conversationId : null,
      title: validLesson.lessonTitle,
      topic: validLesson.topic,
      description: validLesson.shortDescription,
      difficulty: validLesson.difficulty,
      estimatedMinutes: validLesson.estimatedMinutes,
      tags: validLesson.tags,
      prerequisites: validLesson.prerequisites,
      learningObjectives: validLesson.learningObjectives,
      contentJson: JSON.stringify(validLesson),
    });

    return res.status(201).json({
      success: true,
      lessonId: saved.id,
      lesson: {
        ...saved,
        content: validLesson,
      },
    });
  } catch (err: any) {
    console.error('[Save Generated Lesson Error]:', err?.message);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to persist generated lesson to database.',
    });
  }
}

/**
 * PATCH: Update the title of an existing generated lesson.
 */
async function handlePatch(req: ApiRequest, res: ApiResponse, userId: string) {
  if (!req.body || typeof req.body !== 'object') {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Request body must be a valid JSON object.',
    });
  }

  const { id, title } = req.body as { id?: string; title?: string };

  if (typeof id !== 'string' || !id.trim()) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'A non-empty "id" string is required.',
    });
  }

  if (typeof title !== 'string' || !title.trim()) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'A non-empty "title" string is required.',
    });
  }

  const updated = await updateUserGeneratedLessonTitle(userId, id.trim(), title.trim());
  if (!updated) {
    return res.status(404).json({
      error: 'Not Found',
      message: 'Generated lesson not found or access denied.',
    });
  }

  return res.status(200).json({
    success: true,
    message: 'Lesson title updated successfully.',
  });
}

/**
 * DELETE: Delete a generated lesson owned by the user.
 */
async function handleDelete(req: ApiRequest, res: ApiResponse, userId: string) {
  const idFromQuery = typeof req.query?.id === 'string' ? req.query.id.trim() : undefined;
  const idFromBody = req.body && typeof req.body === 'object' && typeof (req.body as any).id === 'string'
    ? (req.body as any).id.trim()
    : undefined;

  const lessonId = idFromQuery || idFromBody;

  if (!lessonId) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Lesson ID must be provided via query parameter (?id=...) or request body.',
    });
  }

  const deleted = await deleteUserGeneratedLesson(userId, lessonId);
  if (!deleted) {
    return res.status(404).json({
      error: 'Not Found',
      message: 'Generated lesson not found or access denied.',
    });
  }

  return res.status(200).json({
    success: true,
    message: 'Generated lesson deleted successfully.',
  });
}
