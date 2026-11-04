import type { ApiRequest, ApiResponse } from '../../_lib/types.js';
import { requireAuth } from '../../_lib/auth-guard.js';
import { parseAnkiApkg, MAX_APKG_SIZE } from '../../_lib/anki-parser.js';
import { findImportedDeckByHash } from '../../_lib/db/client.js';
import { JEREMY_CCNA_DECKS } from '../../_lib/catalog/jeremy-ccna-catalog.js';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed', message: 'Only POST is supported.' });
  }

  const session = await requireAuth(req, res);
  if (!session) return;

  const { catalogId, base64Data, filename } = req.body || {};

  let fileBuffer: Buffer | null = null;
  let defaultTitle = filename || 'Imported CCNA Deck';

  try {
    if (catalogId) {
      const entry = JEREMY_CCNA_DECKS.find((d) => d.id === catalogId);
      if (!entry) {
        return res.status(404).json({ error: 'Not Found', message: `Catalog deck "${catalogId}" was not found.` });
      }
      defaultTitle = entry.title;

      // Stream from GitHub raw master branch
      const fetchRes = await fetch(entry.downloadUrl);
      if (!fetchRes.ok) {
        return res.status(502).json({
          error: 'Upstream Error',
          message: `Failed to download catalog deck from upstream repository: HTTP ${fetchRes.status}`,
        });
      }
      const arrayBuf = await fetchRes.arrayBuffer();
      fileBuffer = Buffer.from(arrayBuf);
    } else if (base64Data) {
      // Custom uploaded file
      const base64Clean = base64Data.replace(/^data:[^;]+;base64,/, '');
      fileBuffer = Buffer.from(base64Clean, 'base64');
    } else {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Must provide either "catalogId" or "base64Data" for deck preview.',
      });
    }

    if (fileBuffer.length > MAX_APKG_SIZE) {
      return res.status(413).json({
        error: 'Payload Too Large',
        message: `Deck file exceeds maximum allowed size of ${MAX_APKG_SIZE / (1024 * 1024)} MB.`,
      });
    }

    const parsed = await parseAnkiApkg(fileBuffer, defaultTitle);

    // Check if user already imported this exact file
    const userId = session.userId || session.sub;
    const existing = await findImportedDeckByHash(userId, parsed.sourceHash);

    return res.status(200).json({
      success: true,
      preview: {
        deckName: parsed.deckName,
        title: parsed.title,
        description: parsed.description,
        sourceHash: parsed.sourceHash,
        cardCount: parsed.cardCount,
        noteCount: parsed.noteCount,
        mediaCount: parsed.mediaCount,
        warnings: parsed.warnings,
        alreadyImported: Boolean(existing),
        existingDeckId: existing?.id,
        sampleCards: parsed.cards.slice(0, 5).map((c) => ({
          orderIndex: c.orderIndex,
          frontMarkdown: c.frontMarkdown,
          backMarkdown: c.backMarkdown,
          cardType: c.cardType,
          clozeData: c.clozeData,
          tags: c.tags,
        })),
      },
    });
  } catch (err: any) {
    console.error('[Flashcard Preview Error]:', err?.message);
    return res.status(400).json({
      error: 'Parse Error',
      message: err?.message || 'Failed to parse Anki package.',
    });
  }
}
