/**
 * NetMentor AI Lesson Generator Endpoint - POST /api/ai/generate-lesson
 * 
 * Generates structured, technical networking lessons using the configured AI provider
 * (or deterministic mock provider).
 * Validates the complete response with validateGeneratedLesson before returning.
 * Does NOT persist to the database until explicitly approved by the user.
 */

import type { ApiRequest, ApiResponse } from '../_lib/types.js';
import { requireAuth } from '../_lib/auth-guard.js';
import { tutorRateLimiter } from '../_lib/ai/rate-limiter.js';
import { buildLessonGenerationPrompt } from '../_lib/ai/prompt-builder.js';
import { getActiveAiProvider } from '../_lib/ai/mock-provider.js';
import { validateGeneratedLesson } from '../_lib/ai/lesson-validator.js';
import { redactSecrets } from '../_lib/ai/config.js';
import type { GenerateLessonRequestParams } from '../_lib/ai/types.js';

const MAX_PAYLOAD_SIZE = 25600; // 25KB limit

export default async function handler(req: ApiRequest, res: ApiResponse) {
  // 1. Enforce POST HTTP method
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({
      error: 'Method Not Allowed',
      message: 'Only POST requests are supported for lesson generation.',
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
      message: 'AI lesson generation quota exceeded. Please try again shortly.',
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
    topic,
    difficulty,
    desiredDepth,
    platform,
    prerequisites,
    goals,
    conversationContext,
    conversationId,
  } = req.body as Partial<GenerateLessonRequestParams>;

  if (typeof topic !== 'string' || !topic.trim()) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'A non-empty "topic" string is required for lesson generation.',
    });
  }

  if (topic.trim().length > 200) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Topic cannot exceed 200 characters.',
    });
  }

  // 5. Construct Structured Prompt
  const prompt = buildLessonGenerationPrompt({
    topic: topic.trim(),
    difficulty: difficulty || 'intermediate',
    desiredDepth: desiredDepth || 'standard',
    platform: platform ? String(platform).trim() : undefined,
    prerequisites: Array.isArray(prerequisites) ? prerequisites.map(String) : undefined,
    goals: Array.isArray(goals) ? goals.map(String) : undefined,
    conversationContext: typeof conversationContext === 'string' ? conversationContext : undefined,
    conversationId: typeof conversationId === 'string' ? conversationId : undefined,
  });

  // 6. Invoke AI Provider
  const aiProvider = getActiveAiProvider();
  let providerResponse;

  try {
    providerResponse = await aiProvider.generateResponse({
      systemPrompt: prompt.systemPrompt,
      userPrompt: prompt.userPrompt,
      temperature: 0.3, // Lower temperature for structured JSON accuracy
      maxTokens: 3500,
    });
  } catch (err: any) {
    const safeError = redactSecrets(err?.message || 'AI provider request failed');
    console.error('[AI Lesson Generation Provider Error]:', safeError);

    return res.status(502).json({
      error: 'Bad Gateway',
      message: 'The AI provider failed to generate the lesson. Please try again explicitly.',
      details: safeError,
    });
  }

  // 7. Validate Structured JSON Output
  const validation = validateGeneratedLesson(providerResponse.text);

  if (!validation.valid || !validation.lesson) {
    const errorList = validation.errors || ['Invalid structure'];
    const category = errorList.some((e) => e.startsWith('Malformed JSON') || e.includes('No JSON object'))
      ? 'malformed_json'
      : errorList.some((e) => e.includes('section'))
      ? 'invalid_sections'
      : errorList.some((e) => e.includes('Knowledge Check') || e.includes('knowledgeChecks'))
      ? 'invalid_knowledge_checks'
      : errorList.some((e) => e.includes('Summary') || e.includes('summary'))
      ? 'invalid_summary'
      : 'missing_required_fields';

    console.warn(`[AI Lesson Validation Failed]: category=${category}, model=${providerResponse.model}, errors=`, errorList);

    return res.status(422).json({
      error: 'Unprocessable Entity',
      message: 'The AI output could not be validated against the required lesson schema. Please retry explicitly.',
      category,
      errors: errorList,
    });
  }

  // 8. Return Validated Preview (Explicitly not saved to DB yet)
  return res.status(200).json({
    success: true,
    lesson: validation.lesson,
    model: providerResponse.model,
    isSimulated: providerResponse.isSimulated ?? false,
    conversationId: conversationId || null,
  });
}
