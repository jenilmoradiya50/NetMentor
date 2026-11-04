/**
 * NetMentor AI Tutor Engine - Multi-Provider Fallback Orchestrator
 * 
 * Orchestrates multi-provider resilience across:
 * 1. Google Gemini (Primary)
 * 2. Groq (First Fallback)
 * 3. NVIDIA API Catalog (Second Fallback)
 * 4. Cloudflare Workers AI (Third Fallback)
 * 5. Cohere (Fourth Fallback)
 * -> Deterministic Mock Provider (Final Fail-Safe)
 * 
 * Enforces per-provider timeouts, secret sanitization, rate limit handling,
 * and zero user-facing service interruptions.
 */

import type { AiProviderClient, AiGenerateRequest, AiGenerateResponse } from '../types.js';
import { loadAiConfig, redactSecrets, type AiSystemConfig, type SupportedAiProvider } from '../config.js';
import { GeminiAiProvider } from './gemini.js';
import { GroqAiProvider } from './groq.js';
import { NvidiaAiProvider } from './nvidia.js';
import { CloudflareAiProvider } from './cloudflare.js';
import { CohereAiProvider } from './cohere.js';
import { MockAiProvider } from '../mock-provider.js';

/**
 * Default maximum overall duration across the entire AI provider fallback chain.
 * 35 seconds leaves a comfortable 15-25s headroom inside a 50-60s function limit
 * for JSON schema validation, error formatting, database persistence, and network latency.
 */
export const DEFAULT_AI_CHAIN_DEADLINE_MS = 35000;

/**
 * Minimum remaining time required to warrant attempting another remote provider.
 * Attempting an external LLM with less than 3 seconds remaining is almost certain to fail
 * or consume the reserve needed for schema validation and database writing.
 */
export const MIN_REMAINING_PROVIDER_WINDOW_MS = 3000;

export interface ProviderAttemptRecord {
  provider: SupportedAiProvider;
  durationMs: number;
  success: boolean;
  error?: string;
  status?: number;
}

export class FallbackOrchestrator implements AiProviderClient {
  private readonly providers: Map<SupportedAiProvider, AiProviderClient>;
  private readonly mockProvider: AiProviderClient;
  private readonly configSupplier: () => AiSystemConfig;
  private lastAttempts: ProviderAttemptRecord[] = [];

  constructor(options?: {
    config?: AiSystemConfig | (() => AiSystemConfig);
    providers?: Partial<Record<SupportedAiProvider, AiProviderClient>>;
    mockProvider?: AiProviderClient;
  }) {
    if (typeof options?.config === 'function') {
      this.configSupplier = options.config;
    } else if (options?.config) {
      const fixedConfig = options.config;
      this.configSupplier = () => fixedConfig;
    } else {
      this.configSupplier = () => loadAiConfig();
    }

    this.mockProvider = options?.mockProvider || new MockAiProvider();

    // Initialize adapters (or use injected ones for unit testing)
    this.providers = new Map<SupportedAiProvider, AiProviderClient>();
    this.providers.set('gemini', options?.providers?.gemini || new GeminiAiProvider());
    this.providers.set('groq', options?.providers?.groq || new GroqAiProvider());
    this.providers.set('nvidia', options?.providers?.nvidia || new NvidiaAiProvider());
    this.providers.set('cloudflare', options?.providers?.cloudflare || new CloudflareAiProvider());
    this.providers.set('cohere', options?.providers?.cohere || new CohereAiProvider());
    this.providers.set('mock', this.mockProvider);
  }

  /**
   * Returns diagnostics of provider attempts from the most recent request execution.
   */
  public getLastAttempts(): ProviderAttemptRecord[] {
    return [...this.lastAttempts];
  }

  public async generateResponse(request: AiGenerateRequest): Promise<AiGenerateResponse> {
    const config = this.configSupplier();
    const attempts: ProviderAttemptRecord[] = [];
    this.lastAttempts = attempts;

    // Explicit mock mode bypasses real providers immediately
    if (config.mode === 'mock') {
      const mockRes = await this.mockProvider.generateResponse(request);
      return {
        ...mockRes,
        isSimulated: true,
      };
    }

    // Determine candidate providers based on mode and fallback chain
    let candidateChain: SupportedAiProvider[] = [];

    if (config.mode !== 'auto' && config.mode in config.providers) {
      // If a specific provider was requested (e.g. AI_PROVIDER=groq), try it first
      candidateChain = [config.mode, ...config.fallbackChain.filter((p) => p !== config.mode)];
    } else {
      candidateChain = [...config.fallbackChain];
    }

    // Enforce shared overall AI generation deadline across entire fallback chain
    const chainStartTime = Date.now();
    const maxChainDurationMs = request.maxChainDurationMs || DEFAULT_AI_CHAIN_DEADLINE_MS;
    const chainDeadline = request.deadlineTimestamp || (chainStartTime + maxChainDurationMs);

    for (const providerName of candidateChain) {
      if (providerName === 'mock') {
        continue; // Mock is handled as final fail-safe
      }

      const providerConf = config.providers[providerName];
      if (!providerConf || !providerConf.enabled || !providerConf.configured) {
        continue;
      }

      const client = this.providers.get(providerName);
      if (!client) {
        continue;
      }

      // Check remaining execution window in shared fallback chain budget
      const now = Date.now();
      const remainingChainMs = chainDeadline - now;

      if (remainingChainMs < MIN_REMAINING_PROVIDER_WINDOW_MS) {
        console.warn(
          `[AI Fallback] Insufficient execution budget remaining (${remainingChainMs}ms remaining out of ${maxChainDurationMs}ms budget). Halting remote provider cascading to preserve compute budget for validation/persistence.`
        );
        break; // Stop attempting remote providers; advance to mock fail-safe
      }

      // Bound provider execution by the lesser of its configured timeout and remaining chain time
      const effectiveTimeoutMs = Math.min(providerConf.timeoutMs, remainingChainMs);

      const startTime = Date.now();
      let timeoutTimer: NodeJS.Timeout | null = null;

      try {
        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutTimer = setTimeout(() => {
            reject(new Error(`[${providerName}] Request timed out after ${effectiveTimeoutMs}ms (shared fallback chain budget).`));
          }, effectiveTimeoutMs);
        });

        const response = await Promise.race([
          client.generateResponse(request),
          timeoutPromise,
        ]);
        const durationMs = Date.now() - startTime;

        attempts.push({
          provider: providerName,
          durationMs,
          success: true,
        });

        return {
          ...response,
          isSimulated: false,
        };
      } catch (err: any) {
        const durationMs = Date.now() - startTime;
        const sanitizedErr = redactSecrets(err?.message || 'Unknown provider error');
        const status = typeof err?.status === 'number' ? err.status : undefined;

        attempts.push({
          provider: providerName,
          durationMs,
          success: false,
          error: sanitizedErr,
          status,
        });

        console.warn(
          `[AI Fallback] Provider "${providerName}" failed after ${durationMs}ms: ${sanitizedErr}. Advancing to next provider in fallback chain...`
        );
      } finally {
        if (timeoutTimer) {
          clearTimeout(timeoutTimer);
        }
      }
    }

    // All real providers failed, were unconfigured, or chain deadline was reached -> Fallback to deterministic Mock Provider
    console.warn(
      `[AI Fallback] Remote AI provider chain exhausted or halted (${attempts.length} attempts). Falling back to deterministic NetMentor mock engine.`
    );

    const mockStart = Date.now();
    const mockResponse = await this.mockProvider.generateResponse(request);
    attempts.push({
      provider: 'mock',
      durationMs: Date.now() - mockStart,
      success: true,
    });

    return {
      ...mockResponse,
      isSimulated: true,
    };
  }
}
