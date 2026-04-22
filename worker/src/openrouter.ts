import OpenAI from 'openai';

// The OpenRouter Chat Completions API is OpenAI-compatible — we point the
// official SDK at its baseURL and reuse the same chat.completions surface.
// Kept as a factory so startup validation can fail fast if the key is
// missing.

export function createOpenRouter(apiKey: string): OpenAI {
  return new OpenAI({
    apiKey,
    baseURL: 'https://openrouter.ai/api/v1',
  });
}
