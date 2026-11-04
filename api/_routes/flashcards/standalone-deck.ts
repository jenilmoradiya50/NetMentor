/**
 * NetMentor Standalone Flashcard Deck API - /api/flashcards/standalone-deck
 * 
 * Supports retrieving, persisting, and deleting AI-generated standalone flashcard decks
 * created independently of custom lessons.
 * 
 * - GET: Fetch deck and cards by deckId (with ownership enforcement)
 * - POST: Save or update an approved standalone flashcard deck, preserving card IDs and review progress
 * - DELETE: Delete a standalone deck and cascade delete its cards and progress
 */

import type { ApiRequest, ApiResponse } from '../../_lib/types.js';
import { requireAuth } from '../../_lib/auth-guard.js';
import {
  getDeckWithCards,
  saveOrUpdateStandaloneFlashcardDeck,
  deleteImportedDeck,
} from '../../_lib/db/client.js';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  const session = await requireAuth(req, res);
  if (!session) return;

  const userId = session.userId || session.sub;
  const method = req.method?.toUpperCase();

  if (method === 'GET') {
    return handleGet(req, res, userId);
  }

  if (method === 'POST') {
    return handlePost(req, res, userId);
  }

  if (method === 'DELETE') {
    return handleDelete(req, res, userId);
  }

  res.setHeader('Allow', 'GET, POST, DELETE');
  return res.status(405).json({
    error: 'Method Not Allowed',
    message: `HTTP method ${method} is not supported on this endpoint.`,
  });
}

/**
 * GET: Retrieve the standalone deck and cards by deckId.
 */
async function handleGet(req: ApiRequest, res: ApiResponse, userId: string) {
  let deckId = typeof req.query?.deckId === 'string' ? req.query.deckId.trim() : undefined;

  if (!deckId && req.url && req.url.includes('?')) {
    try {
      const searchParams = new URL(req.url, 'http://localhost').searchParams;
      deckId = searchParams.get('deckId')?.trim() || undefined;
    } catch {}
  }

  if (!deckId) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Parameter "deckId" is required.',
    });
  }

  try {
    const result = await getDeckWithCards(userId, deckId);
    if (!result || !result.deck) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Standalone flashcard deck not found or access denied.',
      });
    }

    return res.status(200).json({
      success: true,
      deck: result.deck,
      cards: result.cards,
      totalCards: result.cards.length,
    });
  } catch (err: any) {
    console.error('[Get Standalone Deck Error]:', err?.message);
    return res.status(500).json({
      error: 'Database Error',
      message: 'Failed to retrieve standalone flashcard deck.',
    });
  }
}

/**
 * POST: Save or update an approved standalone flashcard deck.
 * Preserves existing card IDs and review progress.
 */
async function handlePost(req: ApiRequest, res: ApiResponse, userId: string) {
  if (!req.body || typeof req.body !== 'object') {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Request body must be a valid JSON object.',
    });
  }

  const { deckId, title, description, topic, cards } = req.body || {};

  if (!Array.isArray(cards) || cards.length === 0) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'A flashcard deck must contain at least 1 card.',
    });
  }

  if (cards.length > 50) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'A flashcard deck cannot exceed 50 cards.',
    });
  }

  const deckTitle = typeof title === 'string' && title.trim()
    ? title.trim().slice(0, 200)
    : (typeof topic === 'string' && topic.trim() ? `${topic.trim()} - Flashcards` : 'AI Flashcards');

  const deckDesc = typeof description === 'string' && description.trim()
    ? description.trim().slice(0, 500)
    : `AI-generated flashcards for "${deckTitle}".`;

  // Validate each card
  const validatedCards: Array<{
    id?: string;
    frontMarkdown: string;
    backMarkdown: string;
    cardType?: 'basic' | 'cloze' | 'fill_in_blank';
    tags?: string[];
    orderIndex?: number;
  }> = [];

  for (let i = 0; i < cards.length; i++) {
    const c = cards[i];
    if (!c || typeof c !== 'object') {
      return res.status(400).json({
        error: 'Bad Request',
        message: `Card ${i + 1} is invalid.`,
      });
    }

    const front = typeof c.frontMarkdown === 'string' ? c.frontMarkdown.trim() : '';
    const back = typeof c.backMarkdown === 'string' ? c.backMarkdown.trim() : '';

    if (!front) {
      return res.status(400).json({
        error: 'Bad Request',
        message: `Card ${i + 1} must have a non-empty question / front prompt.`,
      });
    }

    if (!back) {
      return res.status(400).json({
        error: 'Bad Request',
        message: `Card ${i + 1} must have a non-empty answer / back explanation.`,
      });
    }

    validatedCards.push({
      id: typeof c.id === 'string' && c.id.trim() ? c.id.trim() : undefined,
      frontMarkdown: front.slice(0, 500),
      backMarkdown: back.slice(0, 2000),
      cardType: c.cardType === 'cloze' || c.cardType === 'fill_in_blank' ? c.cardType : 'basic',
      tags: Array.isArray(c.tags) ? c.tags.map(String).filter(Boolean) : [],
      orderIndex: typeof c.orderIndex === 'number' ? c.orderIndex : i,
    });
  }

  try {
    const result = await saveOrUpdateStandaloneFlashcardDeck(
      userId,
      typeof deckId === 'string' && deckId.trim() ? deckId.trim() : null,
      {
        title: deckTitle,
        description: deckDesc,
        topic: typeof topic === 'string' ? topic.trim() : undefined,
        deckName: typeof topic === 'string' ? topic.trim() : 'ai-standalone-flashcards',
      },
      validatedCards,
    );

    return res.status(200).json({
      success: true,
      deckId: result.deckId,
      cardCount: result.cardCount,
      isUpdated: result.isUpdated,
      message: result.isUpdated
        ? `Successfully updated flashcard deck with ${result.cardCount} cards. Existing review progress preserved.`
        : `Successfully saved new flashcard deck with ${result.cardCount} cards to your library!`,
    });
  } catch (err: any) {
    console.error('[Save Standalone Deck Error]:', err?.message);
    return res.status(500).json({
      error: 'Database Error',
      message: 'Failed to save standalone flashcard deck.',
    });
  }
}

/**
 * DELETE: Delete a standalone deck belonging to the user.
 */
async function handleDelete(req: ApiRequest, res: ApiResponse, userId: string) {
  let deckId = typeof req.query?.deckId === 'string' ? req.query.deckId.trim() : undefined;
  if (!deckId && req.body && typeof req.body.deckId === 'string') {
    deckId = req.body.deckId.trim();
  }
  if (!deckId && req.body && typeof req.body.id === 'string') {
    deckId = req.body.id.trim();
  }

  if (!deckId) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Parameter "deckId" is required for deletion.',
    });
  }

  try {
    const deleted = await deleteImportedDeck(userId, deckId);
    if (!deleted) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Deck not found or access denied.',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Deck deleted successfully.',
    });
  } catch (err: any) {
    console.error('[Delete Standalone Deck Error]:', err?.message);
    return res.status(500).json({
      error: 'Database Error',
      message: 'Failed to delete flashcard deck.',
    });
  }
}
