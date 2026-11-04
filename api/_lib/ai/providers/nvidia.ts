/**
 * NetMentor AI Tutor Engine - NVIDIA API Catalog Provider Adapter
 * 
 * Second fallback provider using NVIDIA's accelerated inference catalog.
 * Uses deepseek-ai/deepseek-v4.1-flash (or configured model) via OpenAI-compatible chat API.
 */

import type { AiProviderClient, AiGenerateRequest, AiGenerateResponse } from '../types.js';
import { fetchWithTimeout, parseJsonResponse, formatChatMessages, AiProviderError } from './provider-utils.js';

export class NvidiaAiProvider implements AiProviderClient {
  public readonly name = 'nvidia';
  private readonly apiKey: string;
  private readonly model: string;
  private readonly timeoutMs: number;

  constructor(options?: { apiKey?: string; model?: string; timeoutMs?: number }) {
    this.apiKey = options?.apiKey || process.env.NVIDIA_API_KEY || '';
    this.model = options?.model || process.env.NVIDIA_MODEL || 'deepseek-ai/deepseek-v4.1-flash';
    this.timeoutMs = options?.timeoutMs || 12000;
  }

  public async generateResponse(request: AiGenerateRequest): Promise<AiGenerateResponse> {
    if (!this.apiKey) {
      throw new AiProviderError({
        provider: 'nvidia',
        message: 'NVIDIA_API_KEY is not configured or is empty.',
        isRetryable: false,
      });
    }

    const endpoint = 'https://integrate.api.nvidia.com/v1/chat/completions';
    const messages = formatChatMessages(request);

    const isJsonRequest = Boolean(
      (request.systemPrompt && /STRICT JSON|MANDATORY JSON/i.test(request.systemPrompt)) ||
      (request as any).responseFormat === 'json'
    );

    const payload: Record<string, any> = {
      model: this.model,
      messages,
      temperature: request.temperature ?? 0.4,
      max_tokens: Math.max(request.maxTokens ?? 1024, 4096),
    };

    if (isJsonRequest) {
      payload.response_format = { type: 'json_object' };
    }

    const response = await fetchWithTimeout(
      endpoint,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(payload),
      },
      this.timeoutMs,
      'nvidia'
    );

    if (!response.ok) {
      let errorMsg = `HTTP ${response.status} ${response.statusText}`;
      try {
        const errorData = await parseJsonResponse(response, 'nvidia');
        if (errorData?.error?.message) {
          errorMsg = errorData.error.message;
        } else if (errorData?.detail) {
          errorMsg = typeof errorData.detail === 'string' ? errorData.detail : JSON.stringify(errorData.detail);
        }
      } catch (parseErr: any) {
        if (parseErr instanceof AiProviderError) {
          errorMsg = parseErr.message;
        }
      }

      const retryAfter = response.headers.get('retry-after');
      throw new AiProviderError({
        provider: 'nvidia',
        status: response.status,
        retryAfter: retryAfter ? parseInt(retryAfter, 10) : undefined,
        message: errorMsg,
      });
    }

    const data = await parseJsonResponse(response, 'nvidia');

    const choice = data?.choices?.[0];
    const text = choice?.message?.content;

    if (!text || typeof text !== 'string') {
      throw new AiProviderError({
        provider: 'nvidia',
        message: 'NVIDIA response returned no message content.',
        isRetryable: true,
      });
    }

    const usage = data.usage;
    return {
      text: text.trim(),
      model: `nvidia/${this.model}`,
      finishReason: choice?.finish_reason || 'stop',
      isSimulated: false,
      usage: usage
        ? {
            promptTokens: usage.prompt_tokens,
            completionTokens: usage.completion_tokens,
            totalTokens: usage.total_tokens,
          }
        : undefined,
    };
  }
}
