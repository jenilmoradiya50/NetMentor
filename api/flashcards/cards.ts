import type { ApiRequest, ApiResponse } from '../_lib/types.js';
import { requireAuth } from '../_lib/auth-guard.js';
import { getDeckWithCards } from '../_lib/db/client.js';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const session = await requireAuth(req, res);
  if (!session) return;

  const deckId = (req.query?.deckId || req.url?.split('deckId=')[1]?.split('&')[0]) as string;
  if (!deckId) {
    return res.status(400).json({ error: 'Bad Request', message: 'Parameter "deckId" is required.' });
  }

  try {
    const userId = session.userId || session.sub;
    const result = await getDeckWithCards(userId, deckId);
    if (!result) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Deck was not found or you do not have permission to access it.',
      });
    }

    return res.status(200).json({
      success: true,
      deck: result.deck,
      cards: result.cards,
      totalCards: result.cards.length,
    });
  } catch (err: any) {
    console.error('[Get Cards Error]:', err?.message);
    return res.status(500).json({ error: 'Database Error', message: 'Failed to retrieve flashcards.' });
  }
}
