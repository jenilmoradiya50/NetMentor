import type { ApiRequest, ApiResponse } from '../../_lib/types.js';
import { requireAuth } from '../../_lib/auth-guard.js';
import { parseAnkiApkg, MAX_APKG_SIZE } from '../../_lib/anki-parser.js';
import { createImportedDeckWithCards } from '../../_lib/db/client.js';
import { JEREMY_CCNA_DECKS } from '../../_lib/catalog/jeremy-ccna-catalog.js';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed', message: 'Only POST is supported.' });
  }

  // Require authentication & CSRF validation
  const session = await requireAuth(req, res);
  if (!session) return;

  const { catalogId, base64Data, filename, customTitle } = req.body || {};

  let fileBuffer: Buffer | null = null;
  let defaultTitle = customTitle || filename || 'Imported CCNA Deck';
  let sourceName = filename || 'custom.apkg';

  try {
    if (catalogId) {
      const entry = JEREMY_CCNA_DECKS.find((d) => d.id === catalogId);
      if (!entry) {
        return res.status(404).json({ error: 'Not Found', message: `Catalog deck "${catalogId}" was not found.` });
      }
      defaultTitle = customTitle || entry.title;
      sourceName = entry.filename;

      const fetchRes = await fetch(entry.downloadUrl);
      if (!fetchRes.ok) {
        return res.status(502).json({
          error: 'Upstream Error',
          message: `Failed to download catalog deck from upstream: HTTP ${fetchRes.status}`,
        });
      }
      const arrayBuf = await fetchRes.arrayBuffer();
      fileBuffer = Buffer.from(arrayBuf);
    } else if (base64Data) {
      const base64Clean = base64Data.replace(/^data:[^;]+;base64,/, '');
      fileBuffer = Buffer.from(base64Clean, 'base64');
    } else {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Must provide either "catalogId" or "base64Data" to import deck.',
      });
    }

    if (fileBuffer.length > MAX_APKG_SIZE) {
      return res.status(413).json({
        error: 'Payload Too Large',
        message: `Deck file exceeds maximum permitted size of ${MAX_APKG_SIZE / (1024 * 1024)} MB.`,
      });
    }

    const parsed = await parseAnkiApkg(fileBuffer, defaultTitle);

    if (parsed.cards.length === 0) {
      return res.status(400).json({
        error: 'Empty Deck',
        message: 'The selected file contains no readable flashcard notes.',
      });
    }

    // Atomically insert deck and cards in a transaction with duplicate protection
    const userId = session.userId || session.sub;
    const result = await createImportedDeckWithCards(
      userId,
      {
        sourceType: 'anki_apkg',
        sourceName,
        sourceHash: parsed.sourceHash,
        deckName: parsed.deckName,
        title: customTitle || parsed.title,
        description: parsed.description,
      },
      parsed.cards,
    );

    if (result.alreadyImported) {
      return res.status(200).json({
        success: true,
        alreadyImported: true,
        deckId: result.deckId,
        title: customTitle || parsed.title,
        cardCount: result.cardCount,
        message: 'This deck was already imported. Your existing cards and study progress are preserved.',
      });
    }

    return res.status(201).json({
      success: true,
      alreadyImported: false,
      deckId: result.deckId,
      title: customTitle || parsed.title,
      cardCount: result.cardCount,
      warnings: parsed.warnings,
      message: `Successfully imported "${customTitle || parsed.title}" with ${result.cardCount} cards!`,
    });
  } catch (err: any) {
    console.error('[Deck Import Error]:', err?.message);
    return res.status(500).json({
      error: 'Import Failed',
      message: err?.message || 'An unexpected error occurred during deck import.',
    });
  }
}
