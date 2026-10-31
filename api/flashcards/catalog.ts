import type { ApiRequest, ApiResponse } from '../_lib/types.js';
import { requireAuth } from '../_lib/auth-guard.js';
import { JEREMY_CCNA_DECKS } from '../_lib/catalog/jeremy-ccna-catalog.js';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method Not Allowed', message: 'Only GET is supported.' });
  }

  // Require authenticated session
  const session = await requireAuth(req, res);
  if (!session) return;

  return res.status(200).json({
    success: true,
    totalDecks: JEREMY_CCNA_DECKS.length,
    decks: JEREMY_CCNA_DECKS,
  });
}
