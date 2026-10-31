import type { ApiRequest, ApiResponse } from '../_lib/types.js';
import { requireAuth } from '../_lib/auth-guard.js';
import { getUserImportedDecks, deleteImportedDeck } from '../_lib/db/client.js';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  const session = await requireAuth(req, res);
  if (!session) return;

  const userId = session.userId || session.sub;

  if (req.method === 'GET') {
    try {
      const decks = await getUserImportedDecks(userId);
      return res.status(200).json({
        success: true,
        decks,
      });
    } catch (err: any) {
      console.error('[Get Decks Error]:', err?.message);
      return res.status(500).json({ error: 'Database Error', message: 'Failed to retrieve imported decks.' });
    }
  }

  if (req.method === 'DELETE') {
    const { id } = req.body || req.query || {};
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Bad Request', message: 'Deck ID is required.' });
    }

    try {
      const deleted = await deleteImportedDeck(userId, id);
      if (!deleted) {
        return res.status(404).json({ error: 'Not Found', message: 'Deck not found or you do not have permission to delete it.' });
      }
      return res.status(200).json({ success: true, message: 'Deck deleted successfully.' });
    } catch (err: any) {
      console.error('[Delete Deck Error]:', err?.message);
      return res.status(500).json({ error: 'Database Error', message: 'Failed to delete deck.' });
    }
  }

  res.setHeader('Allow', 'GET, DELETE');
  return res.status(405).json({ error: 'Method Not Allowed' });
}
