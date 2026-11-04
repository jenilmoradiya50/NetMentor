import type { ApiRequest, ApiResponse } from '../../_lib/types.js';
import { requireAuth } from '../../_lib/auth-guard.js';
import { upsertLessonProgress, getUserLessonProgress } from '../../_lib/db/client.js';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  const session = await requireAuth(req, res);
  if (!session) return;

  const userId = session.userId || session.sub;

  if (req.method === 'GET') {
    try {
      const progress = await getUserLessonProgress(userId);
      return res.status(200).json({
        success: true,
        progress,
      });
    } catch (err: any) {
      console.error('[Get Lesson Progress Error]:', err?.message);
      return res.status(500).json({ error: 'Database Error', message: 'Failed to retrieve lesson progress.' });
    }
  }

  if (req.method === 'POST') {
    const { lessonId, masteryLevel, confidenceScore, notes, exerciseAttempt } = req.body || {};

    if (!lessonId || !masteryLevel) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Parameters "lessonId" and "masteryLevel" are required.',
      });
    }

    const validLevels = ['not_started', 'learning', 'reviewing', 'mastered'];
    if (!validLevels.includes(masteryLevel)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: `Invalid masteryLevel "${masteryLevel}". Allowed: ${validLevels.join(', ')}`,
      });
    }

    let finalNotes = notes || null;
    if (exerciseAttempt && typeof exerciseAttempt === 'object') {
      const validStatuses = ['unattempted', 'incorrect', 'correct'];
      if (!validStatuses.includes(exerciseAttempt.status)) {
        return res.status(400).json({
          error: 'Bad Request',
          message: `Invalid exerciseAttempt status "${exerciseAttempt.status}". Allowed: ${validStatuses.join(', ')}`,
        });
      }
      if (!exerciseAttempt.exerciseId || typeof exerciseAttempt.exerciseId !== 'string') {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Parameter "exerciseAttempt.exerciseId" must be a non-empty string.',
        });
      }

      try {
        const existingList = await getUserLessonProgress(userId);
        const existingRecord = existingList.find((p: any) => p.lessonId === lessonId);
        let parsedNotes: { exercises?: Record<string, any>; notes?: string } = {};

        if (existingRecord?.notes && typeof existingRecord.notes === 'string') {
          try {
            const parsed = JSON.parse(existingRecord.notes);
            if (parsed && typeof parsed === 'object') {
              parsedNotes = parsed;
            } else {
              parsedNotes = { notes: existingRecord.notes };
            }
          } catch {
            parsedNotes = { notes: existingRecord.notes };
          }
        }

        if (!parsedNotes.exercises) {
          parsedNotes.exercises = {};
        }

        parsedNotes.exercises[exerciseAttempt.exerciseId] = {
          exerciseId: String(exerciseAttempt.exerciseId).slice(0, 64),
          lessonId,
          status: exerciseAttempt.status,
          attemptsCount: Math.max(1, Number(exerciseAttempt.attemptsCount) || 1),
          hintsUsedCount: Math.max(0, Number(exerciseAttempt.hintsUsedCount) || 0),
          lastSubmittedAnswer: exerciseAttempt.lastSubmittedAnswer,
          lastAttemptedAt: new Date().toISOString(),
        };

        if (notes && typeof notes === 'string') {
          parsedNotes.notes = notes;
        }

        finalNotes = JSON.stringify(parsedNotes);
      } catch (mergeErr: any) {
        console.warn('[Exercise Attempt Merge Warning]:', mergeErr?.message);
      }
    }

    try {
      const progress = await upsertLessonProgress(
        userId,
        lessonId,
        masteryLevel,
        typeof confidenceScore === 'number' ? confidenceScore : masteryLevel === 'mastered' ? 5 : 3,
        finalNotes,
      );

      return res.status(200).json({
        success: true,
        progress,
      });
    } catch (err: any) {
      console.error('[Save Lesson Progress Error]:', err?.message);
      return res.status(500).json({ error: 'Database Error', message: 'Failed to save lesson progress.' });
    }
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'Method Not Allowed' });
}
