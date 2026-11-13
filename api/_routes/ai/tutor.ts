/**
 * NetMentor AI Tutor API Endpoint - POST /api/ai/tutor
 * 
 * Provides authenticated, rate-limited, and curriculum-grounded AI tutoring.
 * Connects the server-side AI foundation to NetMentor's backend using the
 * offline deterministic mock provider.
 */

import type { ApiRequest, ApiResponse } from '../../_lib/types.js';
import { requireAuth } from '../../_lib/auth-guard.js';
import { tutorRateLimiter } from '../../_lib/ai/rate-limiter.js';
import { buildGroundedLessonContext } from '../../_lib/ai/context-builder.js';
import { buildTutorPrompt } from '../../_lib/ai/prompt-builder.js';
import { getActiveAiProvider } from '../../_lib/ai/mock-provider.js';
import { redactSecrets } from '../../_lib/ai/config.js';
import {
  createAiConversation,
  getAiConversationWithMessages,
  addAiMessage,
  updateAiConversationTitle,
} from '../../_lib/db/client.js';
import type { AiTutoringMode, AiHistoryTurn, ActiveLabContext } from '../../_lib/ai/types.js';

const ALLOWED_MODES: readonly AiTutoringMode[] = ['general_qa', 'lesson_qa', 'socratic_hint'] as const;
const MAX_PAYLOAD_SIZE = 20480; // 20KB limit
const MAX_QUERY_LENGTH = 600;
const MAX_HISTORY_ARRAY_LENGTH = 20;

function generateAutoTitle(query: string): string {
  const clean = query
    .replace(/^what is (the |an? )?/i, '')
    .replace(/^how (do|does|can) (i |we )?/i, '')
    .replace(/^explain (the )?/i, '')
    .replace(/^tell me about /i, '')
    .trim();
  const raw = clean || query;
  if (raw.length <= 36) {
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  }
  const sub = raw.slice(0, 36);
  const lastSpace = sub.lastIndexOf(' ');
  const trimmed = lastSpace > 16 ? sub.slice(0, lastSpace) : sub;
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1) + '...';
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  // 1. Enforce POST HTTP method
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({
      error: 'Method Not Allowed',
      message: 'Only POST requests are supported for AI tutoring.',
    });
  }

  // 2. Authentication and CSRF Validation
  const session = await requireAuth(req, res);
  if (!session) {
    // requireAuth already responded with appropriate 401 or 403
    return;
  }

  const userId = session.userId || session.sub;

  // 3. User-Specific Rate Limiting
  const rateLimit = tutorRateLimiter.check(userId);
  if (!rateLimit.allowed) {
    res.setHeader('Retry-After', String(rateLimit.retryAfterSeconds));
    return res.status(429).json({
      error: 'Too Many Requests',
      message: 'AI tutoring request quota exceeded (20 requests per hour). Please try again later.',
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

  // Check request payload size
  let payloadLength = 0;
  try {
    payloadLength = JSON.stringify(req.body).length;
  } catch {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Failed to process request payload.',
    });
  }

  if (payloadLength > MAX_PAYLOAD_SIZE) {
    return res.status(413).json({
      error: 'Payload Too Large',
      message: `Request payload exceeds maximum permitted size of ${MAX_PAYLOAD_SIZE} bytes.`,
    });
  }

  const { lessonId, sectionId, exerciseId, query, history, mode, conversationId, labContext } = req.body;

  // Validate optional labContext
  let validatedLabContext: ActiveLabContext | undefined = undefined;
  if (labContext !== undefined) {
    if (!labContext || typeof labContext !== 'object' || Array.isArray(labContext)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Parameter "labContext" must be a valid object if provided.',
      });
    }
    if (typeof labContext.scenarioId !== 'string' || labContext.scenarioId.trim().length === 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Parameter "labContext.scenarioId" must be a non-empty string.',
      });
    }
    validatedLabContext = labContext as ActiveLabContext;
  }

  // Validate tutoring mode
  const effectiveMode: AiTutoringMode = mode
    ? (String(mode).trim() as AiTutoringMode)
    : (validatedLabContext ? 'general_qa' : 'lesson_qa');
  if (!ALLOWED_MODES.includes(effectiveMode)) {
    return res.status(400).json({
      error: 'Bad Request',
      message: `Invalid tutoring mode "${mode}". Supported modes are: ${ALLOWED_MODES.join(', ')}.`,
    });
  }

  // Validate lessonId
  const hasLessonId = typeof lessonId === 'string' && lessonId.trim().length > 0;
  if (effectiveMode === 'lesson_qa') {
    if (!hasLessonId && !validatedLabContext) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Parameter "lessonId" is required and must be a non-empty string.',
      });
    }
  } else if (effectiveMode === 'socratic_hint') {
    if (!hasLessonId && !validatedLabContext) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Parameter "lessonId" is required and must be a non-empty string.',
      });
    }
    if (hasLessonId && (!exerciseId || typeof exerciseId !== 'string' || exerciseId.trim().length === 0)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Parameter "exerciseId" is required when mode is "socratic_hint".',
      });
    }
  } else if (effectiveMode === 'general_qa') {
    if (lessonId !== undefined && (typeof lessonId !== 'string' || lessonId.trim().length === 0)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Parameter "lessonId" must be a non-empty string if provided.',
      });
    }
  }

  // Validate query
  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Parameter "query" is required and must be a non-empty string.',
    });
  }

  if (query.length > MAX_QUERY_LENGTH) {
    return res.status(400).json({
      error: 'Bad Request',
      message: `Parameter "query" exceeds maximum permitted length of ${MAX_QUERY_LENGTH} characters.`,
    });
  }

  // Validate optional sectionId
  if (sectionId !== undefined && (typeof sectionId !== 'string' || sectionId.trim().length === 0)) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Parameter "sectionId" must be a non-empty string if provided.',
    });
  }

  // Validate exerciseId (Mandatory for curriculum socratic_hint mode)
  if (effectiveMode === 'socratic_hint' && !validatedLabContext) {
    if (!exerciseId || typeof exerciseId !== 'string' || exerciseId.trim().length === 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Parameter "exerciseId" is required when mode is "socratic_hint".',
      });
    }
  } else if (exerciseId !== undefined && (typeof exerciseId !== 'string' || exerciseId.trim().length === 0)) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Parameter "exerciseId" must be a non-empty string if provided.',
    });
  }

  // Validate optional history
  if (history !== undefined) {
    if (!Array.isArray(history)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Parameter "history" must be an array of conversation turns.',
      });
    }

    if (history.length > MAX_HISTORY_ARRAY_LENGTH) {
      return res.status(400).json({
        error: 'Bad Request',
        message: `Conversation history exceeds maximum limit of ${MAX_HISTORY_ARRAY_LENGTH} turns.`,
      });
    }

    for (const turn of history) {
      if (
        !turn ||
        typeof turn !== 'object' ||
        !['user', 'assistant'].includes(turn.role) ||
        typeof turn.content !== 'string'
      ) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Each conversation history turn must contain a valid "role" ("user" | "assistant") and string "content".',
        });
      }
    }
  }

  // Conversation persistence and context loading
  let activeConversationId: string | undefined = undefined;
  let effectiveHistory: AiHistoryTurn[] | undefined = history;
  let isFirstMessageInConv = false;

  if (conversationId !== undefined) {
    if (typeof conversationId !== 'string' || conversationId.trim().length === 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Parameter "conversationId" must be a non-empty string if provided.',
      });
    }

    try {
      const convData = await getAiConversationWithMessages(userId, conversationId.trim());
      if (!convData) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Conversation not found or you do not have permission to access it.',
        });
      }

      activeConversationId = convData.conversation.id;
      isFirstMessageInConv = convData.messages.length === 0;

      // If history was not explicitly provided by client, load recent turns from persistent DB
      if (!effectiveHistory || effectiveHistory.length === 0) {
        effectiveHistory = convData.messages
          .slice(-MAX_HISTORY_ARRAY_LENGTH)
          .map((m) => ({
            role: m.role,
            content: m.content,
          }));
      }

      // Persist user query to database
      await addAiMessage(userId, activeConversationId, {
        role: 'user',
        content: query.trim(),
      });
    } catch (dbErr: any) {
      console.error('[Conversation Persistence Warning]:', dbErr?.message);
    }
  } else {
    // Automatically create a new persistent conversation for this thread
    try {
      const autoTitle = generateAutoTitle(query.trim());
      const newConv = await createAiConversation(userId, {
        title: autoTitle,
        mode: effectiveMode,
        lessonId: hasLessonId ? lessonId.trim() : undefined,
      });
      activeConversationId = newConv.id;
      isFirstMessageInConv = true;

      await addAiMessage(userId, activeConversationId, {
        role: 'user',
        content: query.trim(),
      });
    } catch (dbErr: any) {
      console.error('[Conversation Auto-Creation Warning]:', dbErr?.message);
    }
  }

  // 5. Build Grounded Context against Authoritative Curriculum (if lessonId is provided or required)
  let contextResult: ReturnType<typeof buildGroundedLessonContext> | null = null;

  if (hasLessonId) {
    contextResult = buildGroundedLessonContext({
      lessonId: lessonId.trim(),
      sectionId: sectionId ? sectionId.trim() : undefined,
      exerciseId: exerciseId ? exerciseId.trim() : undefined,
      mode: effectiveMode,
    });

    if (!contextResult.success) {
      if (
        contextResult.error === 'UnknownLesson' ||
        contextResult.error === 'UnknownSection' ||
        contextResult.error === 'UnknownExercise'
      ) {
        return res.status(404).json({
          error: 'Not Found',
          message: contextResult.message,
        });
      }
      return res.status(400).json({
        error: 'Bad Request',
        message: contextResult.message,
      });
    }
  }

  // 6. Assemble Prompts with Grounded Context and Sanitization
  const promptPackage = buildTutorPrompt({
    context: contextResult ? contextResult.context : null,
    query: query.trim(),
    history: effectiveHistory,
    mode: effectiveMode,
    labContext: validatedLabContext,
  });

  // 7. Generate Response via AI Provider
  try {
    const provider = getActiveAiProvider();
    const response = await provider.generateResponse({
      systemPrompt: promptPackage.systemPrompt,
      userPrompt: promptPackage.userPrompt,
      history: promptPackage.history,
    });

    const isSimulated = response.isSimulated ?? response.model.includes('mock');

    // 8. Persist assistant turn to conversation if active
    if (activeConversationId) {
      try {
        await addAiMessage(userId, activeConversationId, {
          role: 'assistant',
          content: response.text,
          model: response.model,
          isSimulated,
          usage: response.usage,
        });

        if (isFirstMessageInConv) {
          const autoTitle = generateAutoTitle(query.trim());
          await updateAiConversationTitle(userId, activeConversationId, autoTitle);
        }
      } catch (dbErr: any) {
        console.error('[Response Persistence Warning]:', dbErr?.message);
      }
    }

    const responsePayload: Record<string, any> = {
      success: true,
      conversationId: activeConversationId,
      mode: effectiveMode,
      answer: response.text,
      model: response.model,
      usage: response.usage,
      isSimulated,
    };

    if (contextResult && contextResult.context) {
      responsePayload.groundedContext = {
        lessonId: contextResult.context.lessonId,
        lessonTitle: contextResult.context.lessonTitle,
        sectionId: contextResult.context.currentSection?.id,
        exerciseId: contextResult.context.currentExercise?.id,
      };
    }

    if (validatedLabContext) {
      responsePayload.labContext = {
        scenarioId: validatedLabContext.scenarioId,
        title: validatedLabContext.title,
        isObjectiveSolved: validatedLabContext.isObjectiveSolved,
      };
    }

    return res.status(200).json(responsePayload);
  } catch (err: any) {
    const safeError = redactSecrets(err?.message || 'Upstream provider failure');
    console.error('[AI Tutor Engine Error]:', safeError);
    return res.status(502).json({
      error: 'Bad Gateway',
      message: 'AI tutoring service failed to generate a response. Please try again later.',
    });
  }
}
