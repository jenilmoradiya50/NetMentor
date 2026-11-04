/**
 * NetMentor AI Tutor Engine - Cloudflare Workers AI Provider Adapter
 * 
 * Third fallback provider using Cloudflare's serverless AI inference network.
 * Uses @cf/meta/llama-3.1-8b-instruct (or configured model) via Cloudflare REST API.
 */

import type { AiProviderClient, AiGenerateRequest, AiGenerateResponse } from '../types.js';
import { fetchWithTimeout, parseJsonResponse, formatChatMessages, AiProviderError } from './provider-utils.js';

export class CloudflareAiProvider implements AiProviderClient {
  public readonly name = 'cloudflare';
  private readonly accountId: string;
  private readonly apiToken: string;
  private readonly model: string;
  private readonly timeoutMs: number;

  constructor(options?: { accountId?: string; apiToken?: string; model?: string; timeoutMs?: number }) {
    this.accountId = options?.accountId || process.env.CLOUDFLARE_ACCOUNT_ID || '';
    this.apiToken = options?.apiToken || process.env.CLOUDFLARE_API_TOKEN || '';
    this.model = options?.model || process.env.CLOUDFLARE_MODEL || '@cf/meta/llama-3.1-8b-instruct';
    this.timeoutMs = options?.timeoutMs || 12000;
  }

  public async generateResponse(request: AiGenerateRequest): Promise<AiGenerateResponse> {
    if (!this.accountId || !this.apiToken) {
      throw new AiProviderError({
        provider: 'cloudflare',
        message: 'CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_API_TOKEN is not configured or is empty.',
        isRetryable: false,
      });
    }

    const endpoint = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(this.accountId)}/ai/run/${this.model}`;
    const messages = formatChatMessages(request);

    const payload = {
      messages,
      max_tokens: request.maxTokens ?? 1024,
    };

    const response = await fetchWithTimeout(
      endpoint,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiToken}`,
        },
        body: JSON.stringify(payload),
      },
      this.timeoutMs,
      'cloudflare'
    );

    if (!response.ok) {
      let errorMsg = `HTTP ${response.status} ${response.statusText}`;
      try {
        const errorData = await parseJsonResponse(response, 'cloudflare');
        if (errorData?.errors && Array.isArray(errorData.errors) && errorData.errors.length > 0) {
          errorMsg = errorData.errors.map((e: any) => e.message || JSON.stringify(e)).join('; ');
        }
      } catch (parseErr: any) {
        if (parseErr instanceof AiProviderError) {
          errorMsg = parseErr.message;
        }
      }

      const retryAfter = response.headers.get('retry-after');
      throw new AiProviderError({
        provider: 'cloudflare',
        status: response.status,
        retryAfter: retryAfter ? parseInt(retryAfter, 10) : undefined,
        message: errorMsg,
      });
    }

    const data = await parseJsonResponse(response, 'cloudflare');

    const result = data?.result;
    let text = '';

    if (result && typeof result.response === 'string') {
      text = result.response;
    } else if (result && typeof result === 'string') {
      text = result;
    }

    if (!text || typeof text !== 'string') {
      throw new AiProviderError({
        provider: 'cloudflare',
        message: 'Cloudflare response returned no result response text.',
        isRetryable: true,
      });
    }

    return {
      text: text.trim(),
      model: `cloudflare/${this.model}`,
      finishReason: 'stop',
      isSimulated: false,
      usage: undefined, // Cloudflare Workers AI standard response doesn't return token usage
    };
  }
}
