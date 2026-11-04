/**
 * NetMentor AI Tutor Engine - Provider Utilities
 * 
 * Shared HTTP helpers, message formatting, timeout enforcement,
 * and secret-sanitizing error handling across all AI adapters.
 */

import { redactSecrets } from '../config.js';
import type { AiGenerateRequest } from '../types.js';

export interface OpenAiMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export class AiProviderError extends Error {
  public readonly provider: string;
  public readonly status?: number;
  public readonly retryAfter?: number;
  public readonly isRetryable: boolean;

  constructor(options: {
    provider: string;
    message: string;
    status?: number;
    retryAfter?: number;
    isRetryable?: boolean;
    cause?: unknown;
  }) {
    const sanitizedMsg = redactSecrets(options.message);
    super(`[${options.provider}] ${sanitizedMsg}`);
    this.name = 'AiProviderError';
    this.provider = options.provider;
    this.status = options.status;
    this.retryAfter = options.retryAfter;
    this.isRetryable = options.isRetryable ?? (options.status === 429 || (options.status !== undefined && options.status >= 500));
  }
}

/**
 * Formats system prompt, history, and user prompt into standard chat messages.
 */
export function formatChatMessages(request: AiGenerateRequest): OpenAiMessage[] {
  const messages: OpenAiMessage[] = [];

  if (request.systemPrompt && request.systemPrompt.trim().length > 0) {
    messages.push({
      role: 'system',
      content: request.systemPrompt.trim(),
    });
  }

  if (Array.isArray(request.history) && request.history.length > 0) {
    for (const turn of request.history) {
      if (turn && turn.content && (turn.role === 'user' || turn.role === 'assistant')) {
        messages.push({
          role: turn.role,
          content: turn.content.trim(),
        });
      }
    }
  }

  if (request.userPrompt && request.userPrompt.trim().length > 0) {
    messages.push({
      role: 'user',
      content: request.userPrompt.trim(),
    });
  }

  return messages;
}

/**
 * Performs a network fetch with strict AbortController timeout enforcement.
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number,
  providerName: string
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } catch (err: any) {
    if (err?.name === 'AbortError' || controller.signal.aborted) {
      throw new AiProviderError({
        provider: providerName,
        message: `Request timed out after ${timeoutMs}ms.`,
        isRetryable: true,
      });
    }
    const rawMsg = err?.message || 'Network error';
    throw new AiProviderError({
      provider: providerName,
      message: `Network failure: ${rawMsg}`,
      isRetryable: true,
      cause: err,
    });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Parses response body as JSON with safe fallback and secret redaction.
 */
export async function parseJsonResponse<T = any>(
  response: Response,
  providerName: string
): Promise<T> {
  let rawText = '';
  try {
    rawText = await response.text();
  } catch (err: any) {
    throw new AiProviderError({
      provider: providerName,
      status: response.status,
      message: `Failed to read response body: ${err?.message || 'Unknown read error'}`,
      isRetryable: response.status >= 500,
    });
  }

  if (!rawText.trim()) {
    throw new AiProviderError({
      provider: providerName,
      status: response.status,
      message: 'Received empty response body from upstream provider.',
      isRetryable: true,
    });
  }

  try {
    return JSON.parse(rawText) as T;
  } catch {
    const snippet = redactSecrets(rawText.slice(0, 150));
    throw new AiProviderError({
      provider: providerName,
      status: response.status,
      message: `Malformed JSON response: ${snippet}`,
      isRetryable: response.status >= 500,
    });
  }
}
