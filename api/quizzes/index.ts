/**
 * NetMentor Quizzes API Handler - /api/quizzes
 * (Milestone: AI Quiz Generation)
 *
 * Provides complete quiz management and assessment capabilities:
 * - GET: List user quizzes (with attempt statistics) or retrieve a single quiz/attempt
 * - POST: Grade and submit a quiz attempt, or save a quiz
 * - PATCH: Edit a quiz question/options with answer-key consistency checks
 * - DELETE: Delete a user quiz and cascade its attempts
 */

import type { ApiRequest, ApiResponse } from '../_lib/types.js';
import { requireAuth } from '../_lib/auth-guard.js';
import {
  createUserQuiz,
  getUserQuizzes,
  getUserQuizById,
  updateQuizQuestion,
  deleteUserQuiz,
  recordQuizAttempt,
  getQuizAttempts,
  getQuizAttemptById,
} from '../_lib/db/client.js';
import {
  stripAnswerKey,
  gradeQuizSubmission,
  validateGeneratedQuiz,
  parseQuizRecord,
} from '../_lib/ai/quiz-validator.js';
import type { QuizSubmissionPayload } from '../_lib/ai/types.js';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  // 1. Authenticate user and validate CSRF
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
 * GET: Retrieve list of user quizzes, single quiz, quiz attempts, or single attempt.
 */
async function handleGet(req: ApiRequest, res: ApiResponse, userId: string) {
  const quizId = typeof req.query?.id === 'string' ? req.query.id.trim() : undefined;
  const attemptId = typeof req.query?.attemptId === 'string' ? req.query.attemptId.trim() : undefined;
  const action = typeof req.query?.action === 'string' ? req.query.action.trim() : undefined;
  const search = typeof req.query?.search === 'string' ? req.query.search.trim() : undefined;
  const difficulty = typeof req.query?.difficulty === 'string' ? req.query.difficulty.trim() : undefined;
  const lessonId = typeof req.query?.lessonId === 'string' ? req.query.lessonId.trim() : undefined;

  // 1. Get single attempt breakdown
  if (attemptId) {
    const attempt = await getQuizAttemptById(userId, attemptId);
    if (!attempt) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Quiz attempt not found or access denied.',
      });
    }

    let results: any[] = (attempt as any).results || [];
    if ((!results || results.length === 0) && attempt.resultsJson) {
      try {
        results = JSON.parse(attempt.resultsJson);
      } catch {}
    }

    let answers: any = (attempt as any).answers || {};
    if (Object.keys(answers).length === 0 && attempt.answersJson) {
      try {
        answers = JSON.parse(attempt.answersJson);
      } catch {}
    }

    return res.status(200).json({
      success: true,
      attempt: {
        ...attempt,
        results,
        answers,
      },
    });
  }

  // 2. Get attempts list for a quiz
  if (quizId && action === 'attempts') {
    const quiz = await getUserQuizById(userId, quizId);
    if (!quiz) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Quiz not found or access denied.',
      });
    }
    const attempts = await getQuizAttempts(userId, quizId);
    return res.status(200).json({
      success: true,
      quizId,
      attempts,
    });
  }

  // 3. Get single quiz (by default stripped of answers to prevent leakage)
  if (quizId) {
    const quiz = await getUserQuizById(userId, quizId);
    if (!quiz) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Quiz not found or access denied.',
      });
    }

    const parsedQuiz = parseQuizRecord(quiz);
    const includeKey = req.query?.includeKey === 'true';
    if (!includeKey) {
      return res.status(200).json({
        success: true,
        quiz: stripAnswerKey(parsedQuiz),
      });
    }

    return res.status(200).json({
      success: true,
      quiz: parsedQuiz,
    });
  }

  // 4. List all quizzes with attempt stats
  const quizzes = await getUserQuizzes(userId, { search, difficulty, lessonId });
  return res.status(200).json({
    success: true,
    quizzes,
    count: quizzes.length,
  });
}

/**
 * POST: Submit an assessment attempt, or save a manual/generated quiz.
 */
async function handlePost(req: ApiRequest, res: ApiResponse, userId: string) {
  const action = req.query?.action || (req.body && req.body.action);

  if (action === 'submit') {
    return handleSubmitAttempt(req, res, userId);
  }

  // Save/Create quiz
  if (!req.body || typeof req.body !== 'object') {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Request body must be a valid JSON object.',
    });
  }

  const { quiz } = req.body;
  if (!quiz) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Missing "quiz" payload.',
    });
  }

  const validation = validateGeneratedQuiz(quiz);
  if (!validation.valid || !validation.quiz) {
    return res.status(422).json({
      error: 'Unprocessable Entity',
      message: 'Quiz failed schema validation.',
      errors: validation.errors,
    });
  }

  const vq = validation.quiz;
  const created = await createUserQuiz(userId, {
    lessonId: vq.lessonId,
    title: vq.title,
    topic: vq.topic,
    difficulty: vq.difficulty,
    questionCount: vq.questions.length,
    questionTypes: vq.questionTypes,
    questionsJson: JSON.stringify(vq.questions),
  });

  return res.status(201).json({
    success: true,
    quizId: created.id,
    quiz: stripAnswerKey({ ...vq, id: created.id }),
  });
}

/**
 * Submits a user's completed assessment, executes server-side grading,
 * records an immutable row in quiz_attempts, and returns the graded breakdown.
 */
export async function handleSubmitAttempt(req: ApiRequest, res: ApiResponse, userId: string, routeQuizId?: string) {
  const quizId = routeQuizId || req.query?.id || req.body?.quizId;

  if (!quizId || typeof quizId !== 'string') {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'A valid "quizId" is required to submit an assessment.',
    });
  }

  const quiz = await getUserQuizById(userId, quizId.trim());
  if (!quiz) {
    return res.status(404).json({
      error: 'Not Found',
      message: 'Quiz not found or access denied.',
    });
  }

  const submission: QuizSubmissionPayload = {
    answers: req.body?.answers || {},
    timeTakenSeconds: typeof req.body?.timeTakenSeconds === 'number' ? req.body.timeTakenSeconds : undefined,
  };

  const parsedQuiz = parseQuizRecord(quiz);

  // Grade server-side using the full quiz from database
  const grading = gradeQuizSubmission(parsedQuiz, submission);

  // Persist attempt
  const attempt = await recordQuizAttempt(userId, quiz.id, {
    score: grading.score,
    totalQuestions: grading.totalQuestions,
    percentage: grading.percentage,
    timeTakenSeconds: submission.timeTakenSeconds,
    answersJson: JSON.stringify(submission.answers),
    resultsJson: JSON.stringify(grading.results),
  });

  return res.status(200).json({
    success: true,
    attempt: {
      id: attempt.id,
      quizId: quiz.id,
      userId,
      score: grading.score,
      totalQuestions: grading.totalQuestions,
      percentage: grading.percentage,
      timeTakenSeconds: submission.timeTakenSeconds,
      completedAt: attempt.completedAt,
      results: grading.results,
    },
  });
}

/**
 * PATCH: Edit question prompt, options, or metadata with answer-key consistency checks.
 */
async function handlePatch(req: ApiRequest, res: ApiResponse, userId: string) {
  const quizId = req.query?.id || req.body?.quizId;
  const questionId = req.query?.questionId || req.body?.questionId;
  const updates = req.body?.updates || req.body;

  if (!quizId || typeof quizId !== 'string') {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'A valid "quizId" is required.',
    });
  }

  if (!questionId || typeof questionId !== 'string') {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'A valid "questionId" is required to update a question.',
    });
  }

  const success = await updateQuizQuestion(userId, quizId.trim(), questionId.trim(), updates);
  if (!success) {
    return res.status(404).json({
      error: 'Not Found',
      message: 'Quiz or question not found or access denied.',
    });
  }

  return res.status(200).json({
    success: true,
    message: 'Question updated successfully.',
  });
}

/**
 * DELETE: Delete a user quiz and cascade attempts.
 */
async function handleDelete(req: ApiRequest, res: ApiResponse, userId: string) {
  const quizId = typeof req.query?.id === 'string' ? req.query.id.trim() : undefined;
  if (!quizId) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'A valid "id" query parameter is required to delete a quiz.',
    });
  }

  const deleted = await deleteUserQuiz(userId, quizId);
  if (!deleted) {
    return res.status(404).json({
      error: 'Not Found',
      message: 'Quiz not found or access denied.',
    });
  }

  return res.status(200).json({
    success: true,
    message: 'Quiz deleted successfully.',
  });
}
