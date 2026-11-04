/**
 * NetMentor Quizzes Endpoint - GET /api/quizzes/[id]/attempts
 *
 * Retrieves the historical attempts list for a given quiz.
 */

import type { ApiRequest, ApiResponse } from '../../../_lib/types.js';
import { requireAuth } from '../../../_lib/auth-guard.js';
import { getUserQuizById, getQuizAttempts } from '../../../_lib/db/client.js';

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

  let quizId = req.query?.id as string;
  if (!quizId && req.url) {
    const segments = req.url.split('?')[0].split('/').filter(Boolean);
    const idx = segments.indexOf('attempts');
    if (idx > 0) {
      quizId = segments[idx - 1];
    }
  }
  if (!quizId) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Quiz ID is required.',
    });
  }

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
