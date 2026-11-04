/**
 * NetMentor AI Tutor Engine - Provider Configuration & Redaction
 * 
 * Manages provider enablement, fallback chain ordering, model defaults,
 * and secret sanitization to protect against credential leakage.
 */

// Load environment variables in Node / serverless environments if available
if (typeof process.loadEnvFile === 'function') {
  try { process.loadEnvFile('.env.local'); } catch {}
  try { process.loadEnvFile('.env'); } catch {}
}

export type SupportedAiProvider = 'gemini' | 'groq' | 'nvidia' | 'cloudflare' | 'cohere' | 'mock';

export interface ProviderConfig {
  name: SupportedAiProvider;
  enabled: boolean;
  configured: boolean;
  model: string;
  timeoutMs: number;
}

export interface AiSystemConfig {
  mode: 'auto' | 'mock' | SupportedAiProvider;
  fallbackChain: SupportedAiProvider[];
  providers: Record<SupportedAiProvider, ProviderConfig>;
}

const DEFAULT_TIMEOUT_MS = 12000; // 12-second per-provider timeout

/**
 * Returns whether an environment variable is explicitly set to 'false' or '0'.
 */
function isExplicitlyDisabled(val: string | undefined): boolean {
  if (!val) return false;
  const lower = val.trim().toLowerCase();
  return lower === 'false' || lower === '0' || lower === 'disabled' || lower === 'off';
}

/**
 * Returns whether an environment variable is explicitly set to 'true' or '1'.
 */
export function isExplicitlyEnabled(val: string | undefined): boolean {
  if (!val) return false;
  const lower = val.trim().toLowerCase();
  return lower === 'true' || lower === '1' || lower === 'enabled' || lower === 'on';
}

/**
 * Redacts known secret patterns and all configured API keys from any string or error message.
 */
export function redactSecrets(input: string): string {
  if (!input || typeof input !== 'string') return input;

  let sanitized = input;

  const secretsToMask = [
    process.env.GEMINI_API_KEY,
    process.env.GROQ_API_KEY,
    process.env.NVIDIA_API_KEY,
    process.env.CLOUDFLARE_API_TOKEN,
    process.env.CLOUDFLARE_ACCOUNT_ID,
    process.env.COHERE_API_KEY,
    process.env.SESSION_SECRET,
    process.env.ADMIN_PASSPHRASE,
  ].filter((s): s is string => Boolean(s && s.length > 5 && !s.includes('[SENSITIVE]')));

  for (const secret of secretsToMask) {
    // Replace all occurrences of the exact secret
    sanitized = sanitized.split(secret).join('[REDACTED]');
  }

  // Mask Authorization headers if present in error strings
  sanitized = sanitized.replace(/(bearer\s+)[a-zA-Z0-9_\-\.]{8,}/gi, '$1[REDACTED]');
  sanitized = sanitized.replace(/(key=)[a-zA-Z0-9_\-\.]{8,}/gi, '$1[REDACTED]');
  sanitized = sanitized.replace(/(x-goog-api-key:\s*)[a-zA-Z0-9_\-\.]{8,}/gi, '$1[REDACTED]');

  return sanitized;
}

/**
 * Loads current AI system configuration from environment variables.
 */
export function loadAiConfig(): AiSystemConfig {
  const geminiKey = process.env.GEMINI_API_KEY;
  const groqKey = process.env.GROQ_API_KEY;
  const nvidiaKey = process.env.NVIDIA_API_KEY;
  const cfAccount = process.env.CLOUDFLARE_ACCOUNT_ID;
  const cfToken = process.env.CLOUDFLARE_API_TOKEN;
  const cohereKey = process.env.COHERE_API_KEY;

  const geminiConfigured = Boolean(geminiKey && geminiKey.length > 5 && !geminiKey.includes('[SENSITIVE]'));
  const groqConfigured = Boolean(groqKey && groqKey.length > 5 && !groqKey.includes('[SENSITIVE]'));
  const nvidiaConfigured = Boolean(nvidiaKey && nvidiaKey.length > 5 && !nvidiaKey.includes('[SENSITIVE]'));
  const cfConfigured = Boolean(
    cfAccount && cfAccount.length > 5 && !cfAccount.includes('[SENSITIVE]') &&
    cfToken && cfToken.length > 5 && !cfToken.includes('[SENSITIVE]')
  );
  const cohereConfigured = Boolean(cohereKey && cohereKey.length > 5 && !cohereKey.includes('[SENSITIVE]'));

  // By default, providers with credentials are enabled unless explicitly disabled via ENABLE_<PROVIDER>=false
  const geminiEnabled = geminiConfigured && !isExplicitlyDisabled(process.env.ENABLE_GEMINI);
  const groqEnabled = groqConfigured && !isExplicitlyDisabled(process.env.ENABLE_GROQ);
  const nvidiaEnabled = nvidiaConfigured && !isExplicitlyDisabled(process.env.ENABLE_NVIDIA);
  const cfEnabled = cfConfigured && !isExplicitlyDisabled(process.env.ENABLE_CLOUDFLARE);
  const cohereEnabled = cohereConfigured && !isExplicitlyDisabled(process.env.ENABLE_COHERE);

  // Forced mode or auto
  const rawProvider = (process.env.AI_PROVIDER || 'auto').trim().toLowerCase();
  let mode: AiSystemConfig['mode'] = 'auto';
  if (['mock', 'gemini', 'groq', 'nvidia', 'cloudflare', 'cohere'].includes(rawProvider)) {
    mode = rawProvider as AiSystemConfig['mode'];
  }

  // Fallback chain
  const defaultChain: SupportedAiProvider[] = ['gemini', 'groq', 'nvidia', 'cloudflare', 'cohere'];
  let fallbackChain = defaultChain;

  if (process.env.AI_FALLBACK_CHAIN) {
    const parsed = process.env.AI_FALLBACK_CHAIN
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter((s): s is SupportedAiProvider => defaultChain.includes(s as SupportedAiProvider));
    if (parsed.length > 0) {
      fallbackChain = parsed;
    }
  }

  return {
    mode,
    fallbackChain,
    providers: {
      gemini: {
        name: 'gemini',
        enabled: geminiEnabled,
        configured: geminiConfigured,
        model: process.env.GEMINI_MODEL || 'gemini-3-flash-preview',
        timeoutMs: Number(process.env.GEMINI_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS,
      },
      groq: {
        name: 'groq',
        enabled: groqEnabled,
        configured: groqConfigured,
        model: process.env.GROQ_MODEL || 'qwen/qwen3.8-27b',
        timeoutMs: Number(process.env.GROQ_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS,
      },
      nvidia: {
        name: 'nvidia',
        enabled: nvidiaEnabled,
        configured: nvidiaConfigured,
        model: process.env.NVIDIA_MODEL || 'deepseek-ai/deepseek-v4.1-flash',
        timeoutMs: Number(process.env.NVIDIA_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS,
      },
      cloudflare: {
        name: 'cloudflare',
        enabled: cfEnabled,
        configured: cfConfigured,
        model: process.env.CLOUDFLARE_MODEL || '@cf/meta/llama-3.1-8b-instruct',
        timeoutMs: Number(process.env.CLOUDFLARE_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS,
      },
      cohere: {
        name: 'cohere',
        enabled: cohereEnabled,
        configured: cohereConfigured,
        model: process.env.COHERE_MODEL || 'command-r-08-2024',
        timeoutMs: Number(process.env.COHERE_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS,
      },
      mock: {
        name: 'mock',
        enabled: true,
        configured: true,
        model: 'netmentor-mock-engine-v1',
        timeoutMs: 1000,
      },
    },
  };
}
