/**
 * NetMentor AI Tutor Engine - Pure TypeScript Flashcard Validator (Milestone 3)
 * 
 * Validates and normalizes structured flashcard outputs received from AI providers.
 * Enforces strict typing, required front/back markdown, non-empty content,
 * and alias normalization without throwing unhandled exceptions. Zero external npm dependencies.
 */

import type {
  GeneratedFlashcard,
  FlashcardValidationResult,
} from './types.js';
import { extractJsonFromText } from './lesson-validator.js';

export { extractJsonFromText };

/**
 * Validates and normalizes raw AI-generated flashcard JSON into a safe, strongly-typed
 * GeneratedFlashcardDeck object. Supports all standard LLM envelopes and key synonyms.
 */
export function validateGeneratedFlashcards(
  raw: unknown,
  _expectedCount?: number,
): FlashcardValidationResult {
  const errors: string[] = [];

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    // If raw is an array directly, allow it as the cards array
    if (Array.isArray(raw)) {
      raw = { cards: raw };
    } else {
      return {
        valid: false,
        errors: ['Flashcard payload must be a JSON object containing "cards" array.'],
      };
    }
  }

  let obj = raw as Record<string, any>;

  // Normalize nested envelopes (e.g. { deck: { cards: [...] } }, { data: { cards: [...] } })
  if (obj.deck && typeof obj.deck === 'object' && !Array.isArray(obj.deck)) {
    obj = { ...obj.deck, ...obj, cards: obj.cards || obj.deck.cards || obj.deck.flashcards };
  } else if (obj.data && typeof obj.data === 'object' && !Array.isArray(obj.data)) {
    obj = { ...obj.data, ...obj, cards: obj.cards || obj.data.cards || obj.data.flashcards };
  } else if (obj.result && typeof obj.result === 'object' && !Array.isArray(obj.result)) {
    obj = { ...obj.result, ...obj, cards: obj.cards || obj.result.cards || obj.result.flashcards };
  } else if (obj.response && typeof obj.response === 'object' && !Array.isArray(obj.response)) {
    obj = { ...obj.response, ...obj, cards: obj.cards || obj.response.cards || obj.response.flashcards };
  }

  // 1. Title Normalization & Validation
  const rawTitle =
    obj.title ||
    obj.deckTitle ||
    obj.deck_title ||
    obj.name ||
    obj.lessonTitle ||
    obj.lesson_title ||
    obj.topic;
  let title = 'AI Generated Flashcards';
  if (typeof rawTitle === 'string' && rawTitle.trim()) {
    title = rawTitle.trim().slice(0, 200);
  }

  // 2. Description Normalization
  const rawDesc =
    obj.description ||
    obj.deckDescription ||
    obj.deck_description ||
    obj.shortDescription ||
    obj.short_description ||
    obj.summary ||
    obj.overview ||
    '';
  let description = 'Interactive AI-generated flashcards for networking practice.';
  if (typeof rawDesc === 'string' && rawDesc.trim()) {
    description = rawDesc.trim().slice(0, 500);
  }

  // 3. Cards Array Normalization
  let candidateCards =
    obj.cards ||
    obj.flashcards ||
    obj.flashcard_deck ||
    obj.items ||
    obj.deck ||
    obj.questions ||
    obj.qa ||
    obj.list;

  // Support indexed objects e.g. { "0": {...}, "1": {...} }
  if (candidateCards && typeof candidateCards === 'object' && !Array.isArray(candidateCards)) {
    candidateCards = Object.values(candidateCards);
  }

  if (!Array.isArray(candidateCards) || candidateCards.length === 0) {
    errors.push('Flashcard deck must contain a non-empty "cards" array.');
    return { valid: false, errors };
  }

  const helperText = (val: any): string => {
    if (typeof val === 'string') return val;
    if (val && typeof val === 'object') {
      return val.text || val.content || val.markdown || val.value || '';
    }
    return '';
  };

  const cards: GeneratedFlashcard[] = [];

  for (let i = 0; i < candidateCards.length; i++) {
    const cardObj = candidateCards[i];
    if (!cardObj || typeof cardObj !== 'object') {
      errors.push(`Card ${i + 1} is not a valid object.`);
      continue;
    }

    // Front Question / Scenario Normalization
    const rawFront = helperText(
      cardObj.frontMarkdown ??
      cardObj.front_markdown ??
      cardObj.front ??
      cardObj.question ??
      cardObj.q ??
      cardObj.prompt ??
      cardObj.term ??
      cardObj.frontText ??
      cardObj.front_text ??
      cardObj.card_front ??
      cardObj.challenge
    );

    if (!rawFront.trim()) {
      errors.push(`Card ${i + 1} must have a non-empty question / front prompt.`);
      continue;
    }

    const frontMarkdown = rawFront.trim().slice(0, 500);

    // Back Answer / Explanation Normalization
    const rawBack = helperText(
      cardObj.backMarkdown ??
      cardObj.back_markdown ??
      cardObj.back ??
      cardObj.answer ??
      cardObj.a ??
      cardObj.explanation ??
      cardObj.definition ??
      cardObj.backText ??
      cardObj.back_text ??
      cardObj.card_back ??
      cardObj.solution ??
      cardObj.response ??
      cardObj.details
    );

    if (!rawBack.trim()) {
      errors.push(`Card ${i + 1} must have a non-empty answer / back explanation.`);
      continue;
    }

    const backMarkdown = rawBack.trim().slice(0, 2000);

    // Tags Normalization
    let tags: string[] = [];
    const rawTags =
      cardObj.tags ??
      cardObj.tag ??
      cardObj.category ??
      cardObj.categories ??
      cardObj.labels ??
      cardObj.label ??
      cardObj.topics ??
      cardObj.topic;

    if (Array.isArray(rawTags)) {
      tags = rawTags
        .filter((t): t is string => typeof t === 'string' && Boolean(t.trim()))
        .map((t) => t.trim().slice(0, 50));
    } else if (typeof rawTags === 'string' && rawTags.trim()) {
      tags = rawTags.split(/[,;]/).map((t) => t.trim().slice(0, 50)).filter(Boolean);
    }

    // Card Type
    const cardType = cardObj.cardType === 'cloze' || cardObj.cardType === 'fill_in_blank'
      ? cardObj.cardType
      : 'basic';

    cards.push({
      id: typeof cardObj.id === 'string' ? cardObj.id : undefined,
      frontMarkdown,
      backMarkdown,
      cardType,
      tags,
      orderIndex: typeof cardObj.orderIndex === 'number' ? cardObj.orderIndex : i,
    });
  }

  // Enforce minimum card count
  if (cards.length === 0) {
    errors.push('No valid flashcards were found in the AI output.');
    return { valid: false, errors };
  }

  // Cap at 30 cards to prevent payload bloat
  const finalCards = cards.slice(0, 30);

  return {
    valid: true,
    deck: {
      title,
      description,
      cards: finalCards,
    },
  };
}
