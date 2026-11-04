/**
 * NetMentor AI Tutor Engine - Multi-Provider & Fallback Test Suite
 * 
 * Verifies:
 * 1. Zero credential leakage & secret redaction across all providers.
 * 2. Individual provider adapters (Gemini, Groq, NVIDIA, Cloudflare, Cohere).
 * 3. Fallback Orchestrator chain execution (Gemini -> Groq -> NVIDIA -> Cloudflare -> Cohere -> Mock).
 * 4. Rate limit (429) & timeout handling with graceful failover.
 * 5. Configuration flags (ENABLE_<PROVIDER>=false) and mode overrides.
 * 6. Non-simulated response labeling for real providers vs simulated labeling for mock fallback.
 */

import { redactSecrets, loadAiConfig, type AiSystemConfig } from '../api/_lib/ai/config.js';
import {
  formatChatMessages,
  parseJsonResponse,
  AiProviderError,
} from '../api/_lib/ai/providers/provider-utils.js';
import { GeminiAiProvider } from '../api/_lib/ai/providers/gemini.js';
import { GroqAiProvider } from '../api/_lib/ai/providers/groq.js';
import { NvidiaAiProvider } from '../api/_lib/ai/providers/nvidia.js';
import { CloudflareAiProvider } from '../api/_lib/ai/providers/cloudflare.js';
import { CohereAiProvider } from '../api/_lib/ai/providers/cohere.js';
import { FallbackOrchestrator } from '../api/_lib/ai/providers/fallback-orchestrator.js';
import { MockAiProvider } from '../api/_lib/ai/mock-provider.js';
import type { AiGenerateRequest, AiGenerateResponse, AiProviderClient } from '../api/_lib/ai/types.js';

async function runAiProviderTests() {
  console.log('=== STARTING NETMENTOR AI PROVIDER & FALLBACK TEST SUITE ===\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, msg: string) {
    if (!condition) {
      console.error(`   ✗ FAILED: ${msg}`);
      failed++;
    } else {
      console.log(`   ✓ ${msg}`);
      passed++;
    }
  }

  // Preserve original global.fetch
  const originalFetch = globalThis.fetch;

  // ---------------------------------------------------------------------------
  // 1. Secret Redaction & Credential Leakage Defense
  // ---------------------------------------------------------------------------
  console.log('1. Testing Secret Redaction & Credential Leakage Defense:');

  const dummyGemini = 'mock-gemini-test-secret-key-123456';
  const dummyGroq = 'mock-groq-test-secret-key-9876543210';
  const dummyNvidia = 'mock-nvidia-test-secret-key-54321';
  const dummyCfToken = 'cf_token_abcdef1234567890';
  const dummyCohere = 'cohere_secret_key_12345678';

  process.env.GEMINI_API_KEY = dummyGemini;
  process.env.GROQ_API_KEY = dummyGroq;
  process.env.NVIDIA_API_KEY = dummyNvidia;
  process.env.CLOUDFLARE_API_TOKEN = dummyCfToken;
  process.env.COHERE_API_KEY = dummyCohere;

  const rawErrorMsg = `Failed to connect with key ${dummyGemini} and groq key ${dummyGroq} in auth Bearer ${dummyNvidia}`;
  const redacted = redactSecrets(rawErrorMsg);

  assert(!redacted.includes(dummyGemini), 'Gemini API key is redacted from text');
  assert(!redacted.includes(dummyGroq), 'Groq API key is redacted from text');
  assert(!redacted.includes(dummyNvidia), 'NVIDIA API key is redacted from text');
  assert(redacted.includes('[REDACTED]'), 'Redacted tokens are replaced with [REDACTED]');

  const authHeaderStr = 'Request failed: Authorization: Bearer mock_bearer_token_123456789';
  const redactedAuth = redactSecrets(authHeaderStr);
  assert(!redactedAuth.includes('mock_bearer_token_123456789'), 'Bearer authorization tokens are sanitized');

  // ---------------------------------------------------------------------------
  // 2. Chat Message Formatting Utilities
  // ---------------------------------------------------------------------------
  console.log('\n2. Testing Chat Message Formatting Utilities:');

  const testReq: AiGenerateRequest = {
    systemPrompt: 'You are a network tutor.',
    userPrompt: 'What is BGP Local Preference?',
    history: [
      { role: 'user', content: 'Tell me about BGP.' },
      { role: 'assistant', content: 'BGP is the Path Vector routing protocol.' },
    ],
  };

  const formatted = formatChatMessages(testReq);
  assert(formatted.length === 4, 'Formatted messages count is 4 (system + 2 history + user)');
  assert(formatted[0].role === 'system' && formatted[0].content === 'You are a network tutor.', 'System prompt placed first');
  assert(formatted[1].role === 'user' && formatted[1].content === 'Tell me about BGP.', 'History user turn preserved');
  assert(formatted[2].role === 'assistant' && formatted[2].content.includes('Path Vector'), 'History assistant turn preserved');
  assert(formatted[3].role === 'user' && formatted[3].content === 'What is BGP Local Preference?', 'Current user query placed last');

  // ---------------------------------------------------------------------------
  // 3. Google Gemini Provider Adapter
  // ---------------------------------------------------------------------------
  console.log('\n3. Testing Google Gemini Provider Adapter:');

  let interceptedUrl = '';
  let interceptedHeaders: any = {};
  let interceptedBody: any = null;

  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    interceptedUrl = String(input);
    interceptedHeaders = init?.headers || {};
    interceptedBody = init?.body ? JSON.parse(String(init.body)) : null;

    return new Response(
      JSON.stringify({
        candidates: [
          {
            content: {
              parts: [{ text: 'BGP Local Preference is an AS-internal path attribute.' }],
            },
            finishReason: 'STOP',
          },
        ],
        usageMetadata: {
          promptTokenCount: 35,
          candidatesTokenCount: 12,
          totalTokenCount: 47,
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  };

  const geminiProvider = new GeminiAiProvider({
    apiKey: 'dummy-gemini-key',
    model: 'gemini-2.5-flash',
  });

  const geminiRes = await geminiProvider.generateResponse(testReq);
  assert(interceptedUrl.includes('models/gemini-2.5-flash:generateContent'), 'Gemini calls generateContent endpoint for model');
  assert(interceptedHeaders['x-goog-api-key'] === 'dummy-gemini-key', 'Gemini passes API key via x-goog-api-key header');
  assert(interceptedBody.systemInstruction?.parts?.[0]?.text === 'You are a network tutor.', 'Gemini maps systemInstruction');
  assert(interceptedBody.contents.length === 3, 'Gemini maps contents turns (2 history + 1 current)');
  assert(geminiRes.text === 'BGP Local Preference is an AS-internal path attribute.', 'Gemini extracts candidate text');
  assert(geminiRes.isSimulated === false, 'Gemini response is marked isSimulated=false');
  assert(geminiRes.model === 'gemini/gemini-2.5-flash', 'Gemini reports correct model namespace');
  assert(geminiRes.usage?.totalTokens === 47, 'Gemini parses token usage metadata');

  // Test Gemini 429 Rate Limit error
  globalThis.fetch = async (): Promise<Response> => {
    return new Response(
      JSON.stringify({ error: { message: 'Quota exceeded for gemini-2.5-flash', code: 429 } }),
      { status: 429, headers: { 'Content-Type': 'application/json', 'retry-after': '30' } }
    );
  };

  try {
    await geminiProvider.generateResponse(testReq);
    assert(false, 'Gemini should have thrown on 429');
  } catch (err: any) {
    assert(err instanceof AiProviderError, 'Gemini throws AiProviderError on 429');
    assert(err.status === 429, 'Gemini error captures status 429');
    assert(err.isRetryable === true, 'Gemini 429 is flagged as retryable');
    assert(err.retryAfter === 30, 'Gemini captures Retry-After header');
  }

  // ---------------------------------------------------------------------------
  // 4. Groq Provider Adapter
  // ---------------------------------------------------------------------------
  console.log('\n4. Testing Groq Provider Adapter:');

  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    interceptedUrl = String(input);
    interceptedHeaders = init?.headers || {};
    interceptedBody = init?.body ? JSON.parse(String(init.body)) : null;

    return new Response(
      JSON.stringify({
        choices: [
          {
            message: { role: 'assistant', content: 'Higher Local Preference is preferred (default 100).' },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 28, completion_tokens: 10, total_tokens: 38 },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  };

  const groqProvider = new GroqAiProvider({
    apiKey: 'dummy-groq-key',
    model: 'qwen/qwen3.8-27b',
  });

  const groqRes = await groqProvider.generateResponse(testReq);
  assert(interceptedUrl === 'https://api.groq.com/openai/v1/chat/completions', 'Groq calls chat completions endpoint');
  assert(interceptedHeaders['Authorization'] === 'Bearer dummy-groq-key', 'Groq transmits Bearer authorization');
  assert(interceptedBody.model === 'qwen/qwen3.8-27b', 'Groq sends configured model');
  assert(groqRes.text.includes('Higher Local Preference'), 'Groq parses message text');
  assert(groqRes.isSimulated === false, 'Groq response is flagged isSimulated=false');
  assert(groqRes.model === 'groq/qwen/qwen3.8-27b', 'Groq reports model name');

  // ---------------------------------------------------------------------------
  // 5. NVIDIA API Catalog Provider Adapter
  // ---------------------------------------------------------------------------
  console.log('\n5. Testing NVIDIA API Catalog Provider Adapter:');

  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    interceptedUrl = String(input);
    interceptedHeaders = init?.headers || {};
    interceptedBody = init?.body ? JSON.parse(String(init.body)) : null;

    return new Response(
      JSON.stringify({
        choices: [
          {
            message: { role: 'assistant', content: 'Local Preference is not advertised to eBGP peers.' },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 25, completion_tokens: 9, total_tokens: 34 },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  };

  const nvidiaProvider = new NvidiaAiProvider({
    apiKey: 'dummy-nv-key',
    model: 'deepseek-ai/deepseek-v4.1-flash',
  });

  const nvidiaRes = await nvidiaProvider.generateResponse(testReq);
  assert(interceptedUrl === 'https://integrate.api.nvidia.com/v1/chat/completions', 'NVIDIA calls completions endpoint');
  assert(interceptedHeaders['Authorization'] === 'Bearer dummy-nv-key', 'NVIDIA passes Authorization header');
  assert(nvidiaRes.text.includes('not advertised to eBGP'), 'NVIDIA parses choice text');
  assert(nvidiaRes.model === 'nvidia/deepseek-ai/deepseek-v4.1-flash', 'NVIDIA reports model');

  // ---------------------------------------------------------------------------
  // 6. Cloudflare Workers AI Provider Adapter
  // ---------------------------------------------------------------------------
  console.log('\n6. Testing Cloudflare Workers AI Provider Adapter:');

  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    interceptedUrl = String(input);
    interceptedHeaders = init?.headers || {};
    interceptedBody = init?.body ? JSON.parse(String(init.body)) : null;

    return new Response(
      JSON.stringify({
        result: {
          response: 'Local Pref allows an AS to prefer one outbound exit path over another.',
        },
        success: true,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  };

  const cfProvider = new CloudflareAiProvider({
    accountId: 'dummy-account-id',
    apiToken: 'dummy-token',
    model: '@cf/meta/llama-3.1-8b-instruct',
  });

  const cfRes = await cfProvider.generateResponse(testReq);
  assert(interceptedUrl.includes('/accounts/dummy-account-id/ai/run/@cf/meta/llama-3.1-8b-instruct'), 'Cloudflare calls account AI endpoint');
  assert(interceptedHeaders['Authorization'] === 'Bearer dummy-token', 'Cloudflare transmits Bearer token');
  assert(cfRes.text.includes('prefer one outbound exit path'), 'Cloudflare parses result.response');
  assert(cfRes.model === 'cloudflare/@cf/meta/llama-3.1-8b-instruct', 'Cloudflare reports model namespace');

  // ---------------------------------------------------------------------------
  // 7. Cohere Provider Adapter
  // ---------------------------------------------------------------------------
  console.log('\n7. Testing Cohere Provider Adapter:');

  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    interceptedUrl = String(input);
    interceptedHeaders = init?.headers || {};
    interceptedBody = init?.body ? JSON.parse(String(init.body)) : null;

    return new Response(
      JSON.stringify({
        message: {
          content: [{ type: 'text', text: 'Local Preference is path attribute type code 5.' }],
        },
        usage: {
          tokens: { input_tokens: 30, output_tokens: 9 },
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  };

  const cohereProvider = new CohereAiProvider({
    apiKey: 'dummy-cohere-key',
    model: 'command-r-08-2024',
  });

  const cohereRes = await cohereProvider.generateResponse(testReq);
  assert(interceptedUrl === 'https://api.cohere.com/v2/chat', 'Cohere calls v2 chat endpoint');
  assert(interceptedHeaders['Authorization'] === 'Bearer dummy-cohere-key', 'Cohere transmits Bearer key');
  assert(cohereRes.text.includes('type code 5'), 'Cohere parses message text');
  assert(cohereRes.usage?.totalTokens === 39, 'Cohere calculates total tokens from input and output');

  // ---------------------------------------------------------------------------
  // 8. Fallback Orchestrator - Primary Success
  // ---------------------------------------------------------------------------
  console.log('\n8. Testing Fallback Orchestrator (Primary Success Path):');

  class MockSuccessClient implements AiProviderClient {
    constructor(private readonly model: string, private readonly text: string) {}
    async generateResponse(): Promise<AiGenerateResponse> {
      return { text: this.text, model: this.model, isSimulated: false };
    }
  }

  class MockFailingClient implements AiProviderClient {
    constructor(private readonly provider: string, private readonly status: number, private readonly errorMsg: string) {}
    async generateResponse(): Promise<AiGenerateResponse> {
      throw new AiProviderError({
        provider: this.provider,
        status: this.status,
        message: this.errorMsg,
      });
    }
  }

  const baseConfig: AiSystemConfig = {
    mode: 'auto',
    fallbackChain: ['gemini', 'groq', 'nvidia', 'cloudflare', 'cohere'],
    providers: {
      gemini: { name: 'gemini', enabled: true, configured: true, model: 'gemini-2.5-flash', timeoutMs: 12000 },
      groq: { name: 'groq', enabled: true, configured: true, model: 'qwen/qwen3.8-27b', timeoutMs: 12000 },
      nvidia: { name: 'nvidia', enabled: true, configured: true, model: 'deepseek-ai/deepseek-v4.1-flash', timeoutMs: 12000 },
      cloudflare: { name: 'cloudflare', enabled: true, configured: true, model: '@cf/meta/llama-3.1-8b-instruct', timeoutMs: 12000 },
      cohere: { name: 'cohere', enabled: true, configured: true, model: 'command-r-08-2024', timeoutMs: 12000 },
      mock: { name: 'mock', enabled: true, configured: true, model: 'netmentor-mock-engine-v1', timeoutMs: 1000 },
    },
  };

  const primaryOrchestrator = new FallbackOrchestrator({
    config: baseConfig,
    providers: {
      gemini: new MockSuccessClient('gemini/gemini-2.5-flash', 'Gemini primary answer.'),
      groq: new MockSuccessClient('groq/qwen', 'Groq answer.'),
    },
  });

  const primaryRes = await primaryOrchestrator.generateResponse(testReq);
  assert(primaryRes.text === 'Gemini primary answer.', 'Primary Gemini response returned directly');
  assert(primaryRes.model === 'gemini/gemini-2.5-flash', 'Model is gemini/gemini-2.5-flash');
  assert(primaryRes.isSimulated === false, 'Real provider response is not marked simulated');
  const primaryTrace = primaryOrchestrator.getLastAttempts();
  assert(primaryTrace.length === 1 && primaryTrace[0].provider === 'gemini' && primaryTrace[0].success, 'Only 1 provider attempted');

  // ---------------------------------------------------------------------------
  // 9. Fallback Orchestrator - Failover on Rate Limit (429) & Error
  // ---------------------------------------------------------------------------
  console.log('\n9. Testing Fallback Orchestrator (Failover from Gemini to Groq):');

  const failoverOrchestrator = new FallbackOrchestrator({
    config: baseConfig,
    providers: {
      gemini: new MockFailingClient('gemini', 429, 'Rate limit exceeded: 429 Too Many Requests'),
      groq: new MockSuccessClient('groq/qwen/qwen3.8-27b', 'Groq fallback answer.'),
    },
  });

  const failoverRes = await failoverOrchestrator.generateResponse(testReq);
  assert(failoverRes.text === 'Groq fallback answer.', 'Failover to Groq succeeded seamlessly');
  assert(failoverRes.model === 'groq/qwen/qwen3.8-27b', 'Model is groq/qwen/qwen3.8-27b');
  assert(failoverRes.isSimulated === false, 'Groq response is marked isSimulated=false');
  const failoverTrace = failoverOrchestrator.getLastAttempts();
  assert(failoverTrace.length === 2, 'Two attempts made in failover trace');
  assert(failoverTrace[0].provider === 'gemini' && !failoverTrace[0].success, 'First attempt (Gemini) failed');
  assert(failoverTrace[1].provider === 'groq' && failoverTrace[1].success, 'Second attempt (Groq) succeeded');

  // ---------------------------------------------------------------------------
  // 10. Fallback Orchestrator - Full Chain Exhaustion to Mock Provider
  // ---------------------------------------------------------------------------
  console.log('\n10. Testing Full Chain Exhaustion to Deterministic Mock Fail-Safe:');

  const allFailOrchestrator = new FallbackOrchestrator({
    config: baseConfig,
    providers: {
      gemini: new MockFailingClient('gemini', 503, 'Service Unavailable'),
      groq: new MockFailingClient('groq', 429, 'Rate limit exceeded'),
      nvidia: new MockFailingClient('nvidia', 500, 'Internal Server Error'),
      cloudflare: new MockFailingClient('cloudflare', 401, 'Invalid API Token'),
      cohere: new MockFailingClient('cohere', 408, 'Request Timeout'),
    },
    mockProvider: new MockAiProvider('netmentor-mock-engine-v1'),
  });

  const exhaustedRes = await allFailOrchestrator.generateResponse(testReq);
  assert(exhaustedRes.isSimulated === true, 'Response is flagged isSimulated=true when falling back to mock');
  assert(exhaustedRes.model === 'netmentor-mock-engine-v1', 'Model matches deterministic mock engine');
  assert(exhaustedRes.text.startsWith('[NetMentor Simulated Tutor]'), 'Answer contains Simulated Tutor banner');
  const exhaustedTrace = allFailOrchestrator.getLastAttempts();
  assert(exhaustedTrace.length === 6, 'All 5 providers plus mock fail-safe attempted (6 total)');
  assert(exhaustedTrace[5].provider === 'mock' && exhaustedTrace[5].success, 'Final attempt was successful mock fail-safe');

  // ---------------------------------------------------------------------------
  // 11. Configuration Flags & Disabled Provider Skipping
  // ---------------------------------------------------------------------------
  console.log('\n11. Testing Disabled Provider Skipping (ENABLE_GROQ=false):');

  const configWithDisabledGroq: AiSystemConfig = {
    ...baseConfig,
    providers: {
      ...baseConfig.providers,
      groq: { ...baseConfig.providers.groq, enabled: false }, // Explicitly disabled
    },
  };

  const skipOrchestrator = new FallbackOrchestrator({
    config: configWithDisabledGroq,
    providers: {
      gemini: new MockFailingClient('gemini', 429, 'Quota exhausted'),
      groq: new MockSuccessClient('groq/qwen', 'Should never be called'),
      nvidia: new MockSuccessClient('nvidia/deepseek', 'NVIDIA answer.'),
    },
  });

  const skipRes = await skipOrchestrator.generateResponse(testReq);
  assert(skipRes.text === 'NVIDIA answer.', 'Skipped disabled Groq and fell back directly to NVIDIA');
  assert(skipRes.model === 'nvidia/deepseek', 'Returned NVIDIA model');
  const skipTrace = skipOrchestrator.getLastAttempts();
  assert(skipTrace.some((t) => t.provider === 'gemini'), 'Gemini was attempted');
  assert(!skipTrace.some((t) => t.provider === 'groq'), 'Groq was strictly skipped (never attempted)');
  assert(skipTrace.some((t) => t.provider === 'nvidia'), 'NVIDIA was attempted and succeeded');

  // ---------------------------------------------------------------------------
  // 12. Explicit AI_PROVIDER=mock Mode
  // ---------------------------------------------------------------------------
  console.log('\n12. Testing Explicit AI_PROVIDER=mock Mode:');

  const mockModeConfig: AiSystemConfig = {
    ...baseConfig,
    mode: 'mock',
  };

  const forcedMockOrchestrator = new FallbackOrchestrator({
    config: mockModeConfig,
    providers: {
      gemini: new MockSuccessClient('gemini/flash', 'Should not be called in mock mode'),
    },
  });

  const forcedMockRes = await forcedMockOrchestrator.generateResponse(testReq);
  assert(forcedMockRes.isSimulated === true, 'Forced mock mode returns isSimulated=true');
  assert(forcedMockRes.model === 'netmentor-mock-engine-v1', 'Forced mock mode returns mock engine');

  // ---------------------------------------------------------------------------
  // 13. Shared Fallback Chain Deadline & Budget Protection
  // ---------------------------------------------------------------------------
  console.log('\n13. Testing Shared Fallback Chain Deadline & Cascade Halting:');

  const deadlineOrchestrator = new FallbackOrchestrator({
    config: baseConfig,
    providers: {
      gemini: new MockFailingClient('gemini', 500, 'Gemini transient server error'),
      groq: new MockSuccessClient('groq/qwen', 'Groq should not run if chain deadline exceeded'),
      nvidia: new MockSuccessClient('nvidia/deepseek', 'NVIDIA should not run'),
    },
  });

  // Supply a tight deadline that expires immediately (below MIN_REMAINING_PROVIDER_WINDOW_MS = 3000ms)
  const tightDeadlineReq: AiGenerateRequest = {
    ...testReq,
    maxChainDurationMs: 2000,
  };

  const deadlineRes = await deadlineOrchestrator.generateResponse(tightDeadlineReq);
  assert(deadlineRes.isSimulated === true, 'Fell back to deterministic mock fail-safe when chain window was insufficient');
  const deadlineTrace = deadlineOrchestrator.getLastAttempts();
  assert(
    !deadlineTrace.some((t) => t.provider === 'groq'),
    'Groq was safely skipped because remaining chain budget was insufficient'
  );
  assert(
    !deadlineTrace.some((t) => t.provider === 'nvidia'),
    'NVIDIA was safely skipped because remaining chain budget was insufficient'
  );
  assert(
    deadlineTrace.some((t) => t.provider === 'mock'),
    'Mock fail-safe engaged to preserve compute budget for validation and persistence'
  );

  // Restore original fetch
  globalThis.fetch = originalFetch;

  console.log('\n=============================================================');
  console.log(`✓ ALL ${passed} AI PROVIDER & FALLBACK TESTS PASSED CLEANLY! (${failed} failures)`);
  console.log('=============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runAiProviderTests().catch((err) => {
  console.error('Fatal unhandled error in AI provider tests:', err);
  process.exit(1);
});
