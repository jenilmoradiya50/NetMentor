/**
 * NetMentor AI Tutor Engine - Google Gemini Provider Adapter
 * 
 * Primary AI tutor provider using the Google Generative Language API.
 * Uses gemini-2.5-flash with structured system instructions, Socratic boundaries,
 * and secret-sanitizing error handling.
 */

import type { AiProviderClient, AiGenerateRequest, AiGenerateResponse } from '../types.js';
import { fetchWithTimeout, parseJsonResponse, AiProviderError } from './provider-utils.js';

export class GeminiAiProvider implements AiProviderClient {
  public readonly name = 'gemini';
  private readonly apiKey: string;
  private readonly model: string;
  private readonly timeoutMs: number;

  constructor(options?: { apiKey?: string; model?: string; timeoutMs?: number }) {
    this.apiKey = options?.apiKey || process.env.GEMINI_API_KEY || '';
    this.model = options?.model || process.env.GEMINI_MODEL || 'gemini-3-flash-preview';
    this.timeoutMs = options?.timeoutMs || 12000;
  }

  public async generateResponse(request: AiGenerateRequest): Promise<AiGenerateResponse> {
    if (!this.apiKey) {
      throw new AiProviderError({
        provider: 'gemini',
        message: 'GEMINI_API_KEY is not configured or is empty.',
        isRetryable: false,
      });
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.model)}:generateContent`;

    // Map conversation turns to Gemini content structure
    const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

    if (Array.isArray(request.history) && request.history.length > 0) {
      for (const turn of request.history) {
        if (turn && turn.content) {
          contents.push({
            role: turn.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: turn.content }],
          });
        }
      }
    }

    contents.push({
      role: 'user',
      parts: [{ text: request.userPrompt || '' }],
    });

    const isJsonRequest = Boolean(
      (request.systemPrompt && /STRICT JSON|MANDATORY JSON/i.test(request.systemPrompt)) ||
      (request as any).responseFormat === 'json'
    );

    const generationConfig: Record<string, any> = {
      temperature: request.temperature ?? 0.4,
      maxOutputTokens: Math.max(request.maxTokens ?? 1024, 4096),
    };

    if (isJsonRequest) {
      generationConfig.responseMimeType = 'application/json';
    }

    const payload: Record<string, any> = {
      contents,
      generationConfig,
    };

    if (request.systemPrompt && request.systemPrompt.trim().length > 0) {
      payload.systemInstruction = {
        parts: [{ text: request.systemPrompt.trim() }],
      };
    }

    const response = await fetchWithTimeout(
      endpoint,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': this.apiKey,
        },
        body: JSON.stringify(payload),
      },
      this.timeoutMs,
      'gemini'
    );

    if (!response.ok) {
      let errorMsg = `HTTP ${response.status} ${response.statusText}`;
      try {
        const errorData = await parseJsonResponse(response, 'gemini');
        if (errorData?.error?.message) {
          errorMsg = errorData.error.message;
        }
      } catch (parseErr: any) {
        if (parseErr instanceof AiProviderError) {
          errorMsg = parseErr.message;
        }
      }

      const retryAfter = response.headers.get('retry-after');
      throw new AiProviderError({
        provider: 'gemini',
        status: response.status,
        retryAfter: retryAfter ? parseInt(retryAfter, 10) : undefined,
        message: errorMsg,
      });
    }

    const data = await parseJsonResponse(response, 'gemini');

    const candidate = data?.candidates?.[0];
    const parts = candidate?.content?.parts;
    const textPart = Array.isArray(parts)
      ? parts.map((p: any) => p.text || '').filter(Boolean).join('')
      : (typeof parts?.[0]?.text === 'string' ? parts[0].text : '');

    if (!textPart || typeof textPart !== 'string') {
      throw new AiProviderError({
        provider: 'gemini',
        message: 'Gemini response returned no text parts or candidate content was empty.',
        isRetryable: true,
      });
    }

    const usageMetadata = data.usageMetadata;
    return {
      text: textPart.trim(),
      model: `gemini/${this.model}`,
      finishReason: candidate?.finishReason || 'stop',
      isSimulated: false,
      usage: usageMetadata
        ? {
            promptTokens: usageMetadata.promptTokenCount,
            completionTokens: usageMetadata.candidatesTokenCount,
            totalTokens: usageMetadata.totalTokenCount,
          }
        : undefined,
    };
  }
}
