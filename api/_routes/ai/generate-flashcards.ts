/**
 * NetMentor AI Flashcard Generator Endpoint - POST /api/ai/generate-flashcards
 * (Milestone 3)
 * 
 * Generates structured, high-yield active recall networking flashcards derived
 * directly from an owned custom lesson using the configured AI provider
 * (or deterministic mock provider).
 * 
 * Validates output against strict flashcard schema before returning.
 * Does NOT persist to database until the user explicitly previews, edits, and saves.
 */

import type { ApiRequest, ApiResponse } from '../../_lib/types.js';
import { requireAuth } from '../../_lib/auth-guard.js';
import { tutorRateLimiter } from '../../_lib/ai/rate-limiter.js';
import { buildFlashcardGenerationPrompt } from '../../_lib/ai/prompt-builder.js';
import { getActiveAiProvider } from '../../_lib/ai/mock-provider.js';
import { validateGeneratedFlashcards, extractJsonFromText } from '../../_lib/ai/flashcard-validator.js';
import { redactSecrets } from '../../_lib/ai/config.js';
import { getUserGeneratedLessonById } from '../../_lib/db/client.js';
import type { GenerateFlashcardsRequestParams, GeneratedLessonContent } from '../../_lib/ai/types.js';

const MAX_PAYLOAD_SIZE = 16384; // 16KB limit

export default async function handler(req: ApiRequest, res: ApiResponse) {
  // 1. Enforce POST HTTP method
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({
      error: 'Method Not Allowed',
      message: 'Only POST requests are supported for flashcard generation.',
    });
  }

  // 2. Authentication and CSRF Validation
  const session = await requireAuth(req, res);
  if (!session) {
    return;
  }

  const userId = session.userId || session.sub;

  // 3. User-Specific Rate Limiting
  const rateLimit = tutorRateLimiter.check(userId);
  if (!rateLimit.allowed) {
    res.setHeader('Retry-After', String(rateLimit.retryAfterSeconds));
    return res.status(429).json({
      error: 'Too Many Requests',
      message: 'AI flashcard generation quota exceeded. Please try again shortly.',
      retryAfter: rateLimit.retryAfterSeconds,
    });
  }

  // 4. Request Payload Validation
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Request body must be a valid JSON object.',
    });
  }

  try {
    const payloadLength = JSON.stringify(req.body).length;
    if (payloadLength > MAX_PAYLOAD_SIZE) {
      return res.status(413).json({
        error: 'Payload Too Large',
        message: `Request payload exceeds maximum permitted size of ${MAX_PAYLOAD_SIZE} bytes.`,
      });
    }
  } catch {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Malformed request payload.',
    });
  }

  const {
    lessonId,
    topic,
    cardCount,
    focusArea,
    difficulty,
    emphasis,
  } = req.body as Partial<GenerateFlashcardsRequestParams>;

  const hasLessonId = typeof lessonId === 'string' && Boolean(lessonId.trim());
  const hasTopic = typeof topic === 'string' && Boolean(topic.trim());

  if (!hasLessonId && !hasTopic) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Either "topic" or "lessonId" must be provided to generate flashcards.',
    });
  }

  const parsedCardCount = typeof cardCount === 'number' && cardCount >= 3 && cardCount <= 25
    ? cardCount
    : 10;

  let prompt;
  let lessonRecord: any = null;

  if (hasLessonId) {
    // 5. Verify Lesson Ownership & Existence
    const lesson = await getUserGeneratedLessonById(userId, lessonId!.trim());
    if (!lesson) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Source custom lesson was not found or access denied.',
      });
    }
    lessonRecord = lesson;

    // Extract lesson structure
    let parsedContent: GeneratedLessonContent | null = null;
    if (lesson.contentJson) {
      try {
        parsedContent = JSON.parse(lesson.contentJson);
      } catch {}
    }

    const sections = parsedContent?.sections?.map((s) => ({
      title: s.title,
      explanation: s.explanation,
    })) || [];

    const keyTerms = parsedContent?.summary?.keyTerms || [];
    const commands: Array<{ command: string; description: string; platform?: string }> = [];
    parsedContent?.sections?.forEach((s) => {
      if (s.commands) {
        s.commands.forEach((c) => {
          if (c.command) {
            commands.push({
              command: c.command,
              description: c.description || c.expectedOutput || 'Command verification',
              platform: c.platform,
            });
          }
        });
      }
    });

    // 6. Construct Structured Lesson-Grounded Prompt
    prompt = buildFlashcardGenerationPrompt({
      lessonTitle: lesson.title,
      topic: lesson.topic,
      difficulty: difficulty || lesson.difficulty,
      cardCount: parsedCardCount,
      focusArea,
      emphasis,
      lessonContentSummary: lesson.description || parsedContent?.summary?.whatYouLearned,
      sections,
      keyTerms,
      commands,
    });
  } else {
    // 5b. Standalone Topic Mode
    const cleanTopic = topic!.trim();
    if (cleanTopic.length < 2 || cleanTopic.length > 200) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Parameter "topic" must be between 2 and 200 characters.',
      });
    }

    // 6b. Construct Structured Standalone Prompt
    prompt = buildFlashcardGenerationPrompt({
      topic: cleanTopic,
      difficulty: difficulty || 'intermediate',
      cardCount: parsedCardCount,
      focusArea,
      emphasis,
    });
  }

  // 7. Invoke AI Provider
  const aiProvider = getActiveAiProvider();
  let providerResponse;

  try {
    providerResponse = await aiProvider.generateResponse({
      systemPrompt: prompt.systemPrompt,
      userPrompt: prompt.userPrompt,
      temperature: 0.3,
      maxTokens: 3000,
    });
  } catch (err: any) {
    const safeError = redactSecrets(err?.message || 'AI provider request failed');
    console.error('[AI Flashcard Generation Provider Error]:', safeError);

    return res.status(502).json({
      error: 'Bad Gateway',
      message: 'The AI provider failed to generate flashcards. Please try again explicitly.',
      details: safeError,
    });
  }

  // 8. Extract & Validate Structured Output
  const extracted = extractJsonFromText(providerResponse.text);
  if (!extracted.success || !extracted.data) {
    const isTruncated = Boolean(extracted.isTruncated);
    const category = isTruncated ? 'truncated_json' : 'malformed_json';
    const message = isTruncated
      ? 'The AI output was cut off before completion. Please retry with a smaller card count (e.g. 5 or 10 cards) or generate again.'
      : 'The AI output could not be parsed as valid JSON syntax. Please retry explicitly.';

    console.warn(`[AI Flashcard JSON Extraction Failed]: category=${category}, model=${providerResponse.model}, error=${extracted.error}`);
    return res.status(422).json({
      error: 'Unprocessable Entity',
      message,
      category,
      errors: [extracted.error || 'Failed to extract JSON from AI response'],
    });
  }

  const validation = validateGeneratedFlashcards(extracted.data, parsedCardCount);

  if (!validation.valid || !validation.deck) {
    const errorList = validation.errors || ['Invalid flashcard structure'];
    const category = errorList.some((e) => e.includes('cards') || e.includes('empty'))
      ? 'missing_cards'
      : 'invalid_card_fields';

    console.warn(`[AI Flashcard Validation Failed]: category=${category}, model=${providerResponse.model}, errors=`, errorList);

    return res.status(422).json({
      error: 'Unprocessable Entity',
      message: 'The AI output could not be validated against the required flashcard schema.',
      category,
      errors: errorList,
    });
  }

  // 9. Return Validated Draft (Not yet saved to DB)
  return res.status(200).json({
    success: true,
    deck: validation.deck,
    lessonId: lessonRecord?.id,
    topic: hasTopic ? topic!.trim() : lessonRecord?.topic,
    model: providerResponse.model,
    isSimulated: providerResponse.isSimulated ?? false,
  });
}
