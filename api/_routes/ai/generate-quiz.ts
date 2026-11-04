/**
 * NetMentor AI Quiz Generator Endpoint - POST /api/ai/generate-quiz
 * (Milestone: AI Quiz Generation)
 * 
 * Generates structured, high-yield networking assessment quizzes supporting both:
 * 1. Standalone topic-based quizzes
 * 2. Lesson-grounded quizzes linked to user-generated lessons
 * 
 * Supports 4 question types: single_choice, multiple_select, true_false, and scenario.
 * Immediately persists full quiz (with answers and explanations) to user_quizzes,
 * and returns the stripped client quiz (WITHOUT answers or explanations) to prevent answer leakage.
 */

import type { ApiRequest, ApiResponse } from '../../_lib/types.js';
import { requireAuth } from '../../_lib/auth-guard.js';
import { tutorRateLimiter } from '../../_lib/ai/rate-limiter.js';
import { buildQuizGenerationPrompt } from '../../_lib/ai/prompt-builder.js';
import { getActiveAiProvider } from '../../_lib/ai/mock-provider.js';
import { validateGeneratedQuiz, stripAnswerKey, extractJsonFromText } from '../../_lib/ai/quiz-validator.js';
import { redactSecrets } from '../../_lib/ai/config.js';
import { getUserGeneratedLessonById, createUserQuiz } from '../../_lib/db/client.js';
import type { GenerateQuizRequestParams, GeneratedLessonContent, QuizDifficulty, QuizQuestionType } from '../../_lib/ai/types.js';

const MAX_PAYLOAD_SIZE = 16384; // 16KB limit

export default async function handler(req: ApiRequest, res: ApiResponse) {
  // 1. Enforce POST HTTP method
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({
      error: 'Method Not Allowed',
      message: 'Only POST requests are supported for quiz generation.',
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
      message: 'AI quiz generation quota exceeded. Please try again shortly.',
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
    questionCount,
    questionTypes,
    lessonId,
  } = req.body as Partial<GenerateQuizRequestParams>;

  // 5. Handle Lesson-Based vs Standalone Quiz
  let resolvedTopic = typeof topic === 'string' ? topic.trim() : '';
  let resolvedLessonTitle: string | undefined = undefined;
  let resolvedLessonId: string | null = null;
  let sections: Array<{ title: string; explanation?: string }> = [];
  let keyTerms: Array<{ term: string; definition: string }> = [];
  let commands: Array<{ command: string; description: string; platform?: string }> = [];
  let lessonSummary: string | undefined = undefined;

  if (lessonId && typeof lessonId === 'string' && lessonId.trim()) {
    const lesson = await getUserGeneratedLessonById(userId, lessonId.trim());
    if (!lesson) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Source custom lesson was not found or access denied.',
      });
    }

    resolvedLessonId = lesson.id;
    resolvedLessonTitle = lesson.title;
    if (!resolvedTopic) {
      resolvedTopic = lesson.topic;
    }

    // Extract structured sections, key terms, and commands for grounding
    let parsedContent: GeneratedLessonContent | null = null;
    if (lesson.contentJson) {
      try {
        parsedContent = JSON.parse(lesson.contentJson);
      } catch {}
    }

    sections = parsedContent?.sections?.map((s) => ({
      title: s.title,
      explanation: s.explanation,
    })) || [];

    keyTerms = parsedContent?.summary?.keyTerms || [];
    parsedContent?.sections?.forEach((s) => {
      if (s.commands) {
        s.commands.forEach((c) => {
          if (c.command) {
            commands.push({
              command: c.command,
              description: c.description || c.expectedOutput || 'Verification command',
              platform: c.platform,
            });
          }
        });
      }
    });

    lessonSummary = lesson.description || parsedContent?.summary?.whatYouLearned;
  }

  if (!resolvedTopic) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'A valid "topic" or source "lessonId" is required to generate a quiz.',
    });
  }

  const parsedQuestionCount = typeof questionCount === 'number' && questionCount >= 3 && questionCount <= 25
    ? questionCount
    : 5;

  const validDifficulties: QuizDifficulty[] = ['easy', 'medium', 'hard'];
  const resolvedDifficulty: QuizDifficulty = difficulty && validDifficulties.includes(difficulty)
    ? difficulty
    : 'medium';

  const validTypes: QuizQuestionType[] = ['single_choice', 'multiple_select', 'true_false', 'scenario'];
  const resolvedTypes = Array.isArray(questionTypes) && questionTypes.length > 0
    ? questionTypes.filter((t) => validTypes.includes(t))
    : validTypes;

  // 6. Build Structured AI Prompt
  const prompt = buildQuizGenerationPrompt({
    topic: resolvedTopic,
    difficulty: resolvedDifficulty,
    questionCount: parsedQuestionCount,
    questionTypes: resolvedTypes,
    lessonTitle: resolvedLessonTitle,
    lessonId: resolvedLessonId || undefined,
    lessonContentSummary: lessonSummary,
    sections,
    keyTerms,
    commands,
  });

  // 7. Invoke AI Provider
  const aiProvider = getActiveAiProvider();
  let providerResponse;

  try {
    providerResponse = await aiProvider.generateResponse({
      systemPrompt: prompt.systemPrompt,
      userPrompt: prompt.userPrompt,
      temperature: 0.3,
      maxTokens: 4000,
    });
  } catch (err: any) {
    const safeError = redactSecrets(err?.message || 'AI provider request failed');
    console.error('[AI Quiz Generation Provider Error]:', safeError);

    return res.status(502).json({
      error: 'Bad Gateway',
      message: 'The AI provider failed to generate quiz questions. Please try again explicitly.',
      details: safeError,
    });
  }

  // 8. Extract & Validate Structured Output
  const extracted = extractJsonFromText(providerResponse.text);
  if (!extracted.success || !extracted.data) {
    const isTruncated = Boolean(extracted.isTruncated);
    const category = isTruncated ? 'truncated_json' : 'malformed_json';
    const message = isTruncated
      ? 'The AI output was cut off before completion. Please retry with a smaller question count (e.g. 5 questions) or try again.'
      : 'The AI output could not be parsed as valid JSON. Please retry explicitly.';

    console.warn(`[AI Quiz JSON Extraction Failed]: category=${category}, model=${providerResponse.model}, error=${extracted.error}`);
    return res.status(422).json({
      error: 'Unprocessable Entity',
      message,
      category,
      errors: [extracted.error || 'Failed to extract JSON from AI response'],
    });
  }

  const validation = validateGeneratedQuiz(extracted.data, parsedQuestionCount);

  if (!validation.valid || !validation.quiz) {
    const errorList = validation.errors || ['Invalid quiz structure'];
    const category = errorList.some((e) => e.includes('questions') || e.includes('empty'))
      ? 'missing_questions'
      : 'invalid_question_fields';

    console.warn(`[AI Quiz Validation Failed]: category=${category}, model=${providerResponse.model}, errors=`, errorList);

    const primaryError = errorList[0] ? ` (${errorList[0]})` : '';

    return res.status(422).json({
      error: 'Unprocessable Entity',
      message: `The AI output could not be validated against the required quiz schema.${primaryError}`,
      category,
      errors: errorList,
    });
  }

  // Ensure lesson linkages are preserved
  const fullQuiz = validation.quiz;
  fullQuiz.lessonId = resolvedLessonId;
  fullQuiz.lessonTitle = resolvedLessonTitle || null;

  // 9. Persist Full Quiz to Neon PostgreSQL
  let persistedRecord;
  try {
    persistedRecord = await createUserQuiz(userId, {
      lessonId: fullQuiz.lessonId,
      title: fullQuiz.title,
      topic: fullQuiz.topic,
      difficulty: fullQuiz.difficulty,
      questionCount: fullQuiz.questions.length,
      questionTypes: fullQuiz.questionTypes,
      questionsJson: JSON.stringify(fullQuiz.questions),
    });
  } catch (dbErr: any) {
    console.error('[Database Error saving quiz]:', dbErr);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to save generated quiz to database.',
    });
  }

  fullQuiz.id = persistedRecord.id;

  // 10. Security: Strip Answer Keys & Explanations Before Returning to Client
  const clientQuiz = stripAnswerKey(fullQuiz);

  return res.status(200).json({
    success: true,
    quiz: clientQuiz,
    quizId: persistedRecord.id,
    lessonId: resolvedLessonId,
    model: providerResponse.model,
    isSimulated: providerResponse.isSimulated ?? false,
  });
}
