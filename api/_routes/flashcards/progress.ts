import type { ApiRequest, ApiResponse } from '../../_lib/types.js';
import { requireAuth } from '../../_lib/auth-guard.js';
import { upsertCardProgress } from '../../_lib/db/client.js';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed', message: 'Only POST is supported.' });
  }

  const session = await requireAuth(req, res);
  if (!session) return;

  const { cardId, deckId, status, confidenceScore } = req.body || {};

  if (!cardId || !deckId || !status) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Parameters "cardId", "deckId", and "status" are required.',
    });
  }

  const validStatuses = ['new', 'learning', 'review', 'mastered'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({
      error: 'Bad Request',
      message: `Invalid status "${status}". Allowed: ${validStatuses.join(', ')}`,
    });
  }

  try {
    const userId = session.userId || session.sub;
    const progress = await upsertCardProgress(
      userId,
      cardId,
      deckId,
      status,
      typeof confidenceScore === 'number' ? confidenceScore : status === 'mastered' ? 5 : 2,
    );

    return res.status(200).json({
      success: true,
      progress,
    });
  } catch (err: any) {
    console.error('[Update Progress Error]:', err?.message);
    return res.status(500).json({ error: 'Database Error', message: 'Failed to update card progress.' });
  }
}
