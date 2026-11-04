/**
 * NetMentor AI Tutor Engine - Cohere Provider Adapter
 * 
 * Fourth fallback provider using Cohere's Command-R series.
 * Uses command-r-08-2024 (or configured model) via Cohere v2 Chat API.
 */

import type { AiProviderClient, AiGenerateRequest, AiGenerateResponse } from '../types.js';
import { fetchWithTimeout, parseJsonResponse, formatChatMessages, AiProviderError } from './provider-utils.js';

export class CohereAiProvider implements AiProviderClient {
  public readonly name = 'cohere';
  private readonly apiKey: string;
  private readonly model: string;
  private readonly timeoutMs: number;

  constructor(options?: { apiKey?: string; model?: string; timeoutMs?: number }) {
    this.apiKey = options?.apiKey || process.env.COHERE_API_KEY || '';
    this.model = options?.model || process.env.COHERE_MODEL || 'command-r-08-2024';
    this.timeoutMs = options?.timeoutMs || 12000;
  }

  public async generateResponse(request: AiGenerateRequest): Promise<AiGenerateResponse> {
    if (!this.apiKey) {
      throw new AiProviderError({
        provider: 'cohere',
        message: 'COHERE_API_KEY is not configured or is empty.',
        isRetryable: false,
      });
    }

    const endpoint = 'https://api.cohere.com/v2/chat';
    const messages = formatChatMessages(request);

    const payload = {
      model: this.model,
      messages,
      temperature: request.temperature ?? 0.4,
      max_tokens: request.maxTokens ?? 1024,
    };

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
      'cohere'
    );

    if (!response.ok) {
      let errorMsg = `HTTP ${response.status} ${response.statusText}`;
      try {
        const errorData = await parseJsonResponse(response, 'cohere');
        if (errorData?.message) {
          errorMsg = errorData.message;
        }
      } catch (parseErr: any) {
        if (parseErr instanceof AiProviderError) {
          errorMsg = parseErr.message;
        }
      }

      const retryAfter = response.headers.get('retry-after');
      throw new AiProviderError({
        provider: 'cohere',
        status: response.status,
        retryAfter: retryAfter ? parseInt(retryAfter, 10) : undefined,
        message: errorMsg,
      });
    }

    const data = await parseJsonResponse(response, 'cohere');

    const contentItem = data?.message?.content?.[0];
    const text = contentItem?.text;

    if (!text || typeof text !== 'string') {
      throw new AiProviderError({
        provider: 'cohere',
        message: 'Cohere response returned no text in message content.',
        isRetryable: true,
      });
    }

    const tokens = data.usage?.tokens;
    const promptTokens = tokens?.input_tokens;
    const completionTokens = tokens?.output_tokens;
    const totalTokens = (promptTokens || 0) + (completionTokens || 0);

    return {
      text: text.trim(),
      model: `cohere/${this.model}`,
      finishReason: data?.finish_reason || 'stop',
      isSimulated: false,
      usage: tokens
        ? {
            promptTokens,
            completionTokens,
            totalTokens: totalTokens > 0 ? totalTokens : undefined,
          }
        : undefined,
    };
  }
}
