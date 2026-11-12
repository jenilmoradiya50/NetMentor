/**
 * NetMentor AI Protocol Simulation Generator Endpoint - POST /api/ai/generate-simulation
 *
 * Generates structured, didactic ProtocolSimulationScenario topologies and packet walkthroughs
 * using the configured multi-provider AI engine (Gemini, Groq, Cloudflare, Cohere, Nvidia, or Mock).
 * Validates the full scenario schema with validateGeneratedSimulation before returning.
 */

import type { ApiRequest, ApiResponse } from '../../_lib/types.js';
import { requireAuth } from '../../_lib/auth-guard.js';
import { tutorRateLimiter } from '../../_lib/ai/rate-limiter.js';
import { buildSimulationGenerationPrompt } from '../../_lib/ai/prompt-builder.js';
import { getActiveAiProvider } from '../../_lib/ai/mock-provider.js';
import { validateGeneratedSimulation } from '../../_lib/ai/simulation-validator.js';
import { redactSecrets } from '../../_lib/ai/config.js';

const MAX_PAYLOAD_SIZE = 25600; // 25KB limit

export default async function handler(req: ApiRequest, res: ApiResponse) {
  // 1. Enforce POST HTTP method
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({
      error: 'Method Not Allowed',
      message: 'Only POST requests are supported for simulation scenario generation.',
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
      message: 'AI simulation generation quota exceeded. Please try again shortly.',
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

  const { topic, certification, protocol, difficulty, faultScenario } = req.body;

  if (typeof topic !== 'string' || !topic.trim()) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'A non-empty "topic" string is required for simulation generation.',
    });
  }

  if (topic.trim().length > 200) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Topic cannot exceed 200 characters.',
    });
  }

  // 5. Construct Structured Prompt
  const prompt = buildSimulationGenerationPrompt({
    topic: topic.trim(),
    certification: typeof certification === 'string' ? certification.trim() : undefined,
    protocol: typeof protocol === 'string' ? protocol.trim() : undefined,
    difficulty: typeof difficulty === 'string' ? difficulty.trim() : undefined,
    faultScenario: typeof faultScenario === 'string' ? faultScenario.trim() : undefined,
  });

  // 6. Invoke Active AI Provider (Multi-Provider Dispatcher with Fallbacks)
  const aiProvider = getActiveAiProvider();
  let providerResponse;

  try {
    providerResponse = await aiProvider.generateResponse({
      systemPrompt: prompt.systemPrompt,
      userPrompt: prompt.userPrompt,
      temperature: 0.25, // Strict JSON formatting adherence
      maxTokens: 4000,
    });
  } catch (err: any) {
    const safeError = redactSecrets(err?.message || 'AI provider request failed');
    console.error('[AI Simulation Generation Provider Error]:', safeError);

    return res.status(502).json({
      error: 'Bad Gateway',
      message: 'The AI provider failed to generate the simulation scenario. Please try again explicitly.',
      details: safeError,
    });
  }

  // 7. Validate Structured JSON Output
  const validation = validateGeneratedSimulation(providerResponse.text);

  if (!validation.valid || !validation.scenario) {
    const errorList = validation.errors || ['Invalid simulation structure'];
    console.warn(
      `[AI Simulation Validation Failed]: model=${providerResponse.model}, errors=`,
      errorList
    );

    return res.status(422).json({
      error: 'Unprocessable Entity',
      message:
        'The AI output could not be validated against the required ProtocolSimulationScenario schema. Please retry explicitly.',
      errors: errorList,
    });
  }

  // 8. Return Validated Scenario
  return res.status(200).json({
    success: true,
    scenario: validation.scenario,
    model: providerResponse.model,
    isSimulated: providerResponse.isSimulated ?? false,
  });
}
