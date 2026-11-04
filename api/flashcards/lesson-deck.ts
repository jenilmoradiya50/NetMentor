/**
 * NetMentor Lesson Flashcard Deck API - /api/flashcards/lesson-deck
 * (Milestone 3)
 * 
 * Supports retrieving and persisting AI-generated flashcard decks associated
 * directly with a user's custom networking lesson.
 * 
 * - GET: Fetch the deck and cards linked to a lesson (or return null if none exists)
 * - POST: Save or update an approved flashcard deck, preserving card IDs and review progress
 */

import type { ApiRequest, ApiResponse } from '../_lib/types.js';
import { requireAuth } from '../_lib/auth-guard.js';
import {
  getUserGeneratedLessonById,
  getLessonFlashcardDeck,
  saveOrUpdateLessonFlashcardDeck,
} from '../_lib/db/client.js';

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

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({
    error: 'Method Not Allowed',
    message: `HTTP method ${method} is not supported on this endpoint.`,
  });
}

/**
 * GET: Retrieve the flashcard deck associated with a specific custom lesson.
 */
async function handleGet(req: ApiRequest, res: ApiResponse, userId: string) {
  let lessonId = typeof req.query?.lessonId === 'string' ? req.query.lessonId.trim() : undefined;

  if (!lessonId && req.url && req.url.includes('?')) {
    try {
      const searchParams = new URL(req.url, 'http://localhost').searchParams;
      lessonId = searchParams.get('lessonId')?.trim() || undefined;
    } catch {}
  }

  if (!lessonId) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Parameter "lessonId" is required.',
    });
  }

  // Verify ownership of the lesson
  const lesson = await getUserGeneratedLessonById(userId, lessonId);
  if (!lesson) {
    return res.status(404).json({
      error: 'Not Found',
      message: 'Source custom lesson not found or access denied.',
    });
  }

  try {
    const result = await getLessonFlashcardDeck(userId, lessonId);
    if (!result) {
      return res.status(200).json({
        success: true,
        deck: null,
        cards: [],
      });
    }

    return res.status(200).json({
      success: true,
      deck: result.deck,
      cards: result.cards,
      totalCards: result.cards.length,
    });
  } catch (err: any) {
    console.error('[Get Lesson Deck Error]:', err?.message);
    return res.status(500).json({
      error: 'Database Error',
      message: 'Failed to retrieve lesson flashcard deck.',
    });
  }
}

/**
 * POST: Save or update an approved flashcard deck for a custom lesson.
 * Preserves existing card IDs and review progress.
 */
async function handlePost(req: ApiRequest, res: ApiResponse, userId: string) {
  const { lessonId, title, description, cards } = req.body || {};

  if (!lessonId || typeof lessonId !== 'string') {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Parameter "lessonId" is required.',
    });
  }

  // Verify ownership of the lesson
  const lesson = await getUserGeneratedLessonById(userId, lessonId.trim());
  if (!lesson) {
    return res.status(404).json({
      error: 'Not Found',
      message: 'Source custom lesson not found or access denied.',
    });
  }

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
      id: typeof c.id === 'string' ? c.id.trim() : undefined,
      frontMarkdown: front.slice(0, 500),
      backMarkdown: back.slice(0, 2000),
      cardType: c.cardType === 'cloze' || c.cardType === 'fill_in_blank' ? c.cardType : 'basic',
      tags: Array.isArray(c.tags) ? c.tags.map(String).filter(Boolean) : [],
      orderIndex: typeof c.orderIndex === 'number' ? c.orderIndex : i,
    });
  }

  const deckTitle = typeof title === 'string' && title.trim()
    ? title.trim().slice(0, 200)
    : `${lesson.title} - Flashcards`;

  const deckDesc = typeof description === 'string' && description.trim()
    ? description.trim().slice(0, 500)
    : `AI-generated flashcards for "${lesson.title}".`;

  try {
    const result = await saveOrUpdateLessonFlashcardDeck(
      userId,
      lesson.id,
      {
        title: deckTitle,
        description: deckDesc,
        deckName: lesson.topic || 'ai-lesson-flashcards',
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
    console.error('[Save Lesson Deck Error]:', err?.message);
    return res.status(500).json({
      error: 'Database Error',
      message: 'Failed to save flashcard deck.',
    });
  }
}
