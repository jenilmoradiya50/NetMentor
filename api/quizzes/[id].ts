/**
 * NetMentor Quizzes Endpoint - /api/quizzes/[id]
 *
 * Direct REST handler for operations on a specific quiz:
 * - GET: Load quiz definition (stripped of answers by default)
 * - PATCH: Edit a question or options
 * - DELETE: Delete quiz and cascade attempts
 */

import type { ApiRequest, ApiResponse } from '../_lib/types.js';
import { requireAuth } from '../_lib/auth-guard.js';
import {
  getUserQuizById,
  getQuizAttempts,
  updateQuizQuestion,
  deleteUserQuiz,
} from '../_lib/db/client.js';
import { stripAnswerKey, parseQuizRecord } from '../_lib/ai/quiz-validator.js';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  const session = await requireAuth(req, res);
  if (!session) {
    return;
  }
  const userId = session.userId || session.sub;

  // Extract ID from query (or URL pathname fallback)
  let id = req.query?.id as string;
  if (!id && req.url) {
    const segments = req.url.split('?')[0].split('/').filter(Boolean);
    const lastSeg = segments[segments.length - 1];
    if (lastSeg && lastSeg !== 'quizzes' && lastSeg !== 'index') {
      id = lastSeg;
    }
  }
  if (!id) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Quiz ID is required.',
    });
  }

  const method = req.method?.toUpperCase();

  switch (method) {
    case 'GET': {
      const quiz = await getUserQuizById(userId, id);
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

      // Authorization check for answer key retrieval:
      // Ground-truth answer keys and technical explanations are privileged assessment data.
      // They may ONLY be disclosed if:
      // 1. The user has an administrative role verified via server session (session.role === 'admin').
      // 2. The user has verified a submitted, completed quiz attempt belonging to them for this quiz.
      const isAdmin = session.role === 'admin';

      let hasSubmittedAttempt = Boolean(
        quiz.latestAttempt &&
        quiz.latestAttempt.completedAt &&
        (quiz.latestAttempt as any).completed !== false &&
        (quiz.latestAttempt as any).status !== 'in_progress'
      );

      if (!hasSubmittedAttempt) {
        const attempts = await getQuizAttempts(userId, id);
        hasSubmittedAttempt = attempts.some(
          (att) =>
            att.userId === userId &&
            att.quizId === id &&
            Boolean(att.completedAt) &&
            (att as any).completed !== false &&
            (att as any).status !== 'in_progress'
        );
      }

      if (!isAdmin && !hasSubmittedAttempt) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Answer key access requires a completed quiz submission or administrative privileges.',
        });
      }

      return res.status(200).json({
        success: true,
        quiz: parsedQuiz,
      });
    }

    case 'PATCH': {
      const questionId = req.query?.questionId as string || req.body?.questionId;
      const updates = req.body?.updates || req.body;
      if (!questionId) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Question ID is required for patch.',
        });
      }

      const updated = await updateQuizQuestion(userId, id, questionId, updates);
      if (!updated) {
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

    case 'DELETE': {
      const deleted = await deleteUserQuiz(userId, id);
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

    default:
      res.setHeader('Allow', 'GET, PATCH, DELETE');
      return res.status(405).json({
        error: 'Method Not Allowed',
        message: `HTTP method ${method} not allowed on this endpoint.`,
      });
  }
}
