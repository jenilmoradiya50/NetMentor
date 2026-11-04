/**
 * NetMentor Quizzes Endpoint - POST /api/quizzes/[id]/submit
 *
 * Direct REST handler for submitting an assessment attempt:
 * - Validates ownership of the quiz
 * - Executes server-side grading against ground-truth answer keys
 * - Persists attempt into quiz_attempts
 * - Returns scored breakdown with detailed explanations and user answers
 */

import type { ApiRequest, ApiResponse } from '../../_lib/types.js';
import { requireAuth } from '../../_lib/auth-guard.js';
import { handleSubmitAttempt } from '../index.js';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({
      error: 'Method Not Allowed',
      message: 'Only POST requests are supported for submitting quiz attempts.',
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
    const idx = segments.indexOf('submit');
    if (idx > 0) {
      quizId = segments[idx - 1];
    }
  }
  return handleSubmitAttempt(req, res, userId, quizId);
}
