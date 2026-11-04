/**
 * NetMentor Quizzes Endpoint - GET /api/quizzes/attempts/[attemptId]
 *
 * Retrieves a single graded attempt breakdown by ID.
 */

import type { ApiRequest, ApiResponse } from '../../../_lib/types.js';
import { requireAuth } from '../../../_lib/auth-guard.js';
import { getQuizAttemptById } from '../../../_lib/db/client.js';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({
      error: 'Method Not Allowed',
      message: 'Only GET requests are supported on this endpoint.',
    });
  }

  const session = await requireAuth(req, res);
  if (!session) {
    return;
  }
  const userId = session.userId || session.sub;

  let attemptId = req.query?.attemptId as string;
  if (!attemptId && req.url) {
    const segments = req.url.split('?')[0].split('/').filter(Boolean);
    const lastSeg = segments[segments.length - 1];
    if (lastSeg && lastSeg !== 'attempts') {
      attemptId = lastSeg;
    }
  }
  if (!attemptId) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Attempt ID is required.',
    });
  }

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
