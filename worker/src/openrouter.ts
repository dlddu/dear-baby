import OpenAI from 'openai';

// openrouterClient is the shared OpenRouter-backed OpenAI client. We
// deliberately use the official openai SDK with OpenRouter's baseURL swap
// so task code stays portable if we switch providers.
export function openrouterClient(apiKey: string): OpenAI {
  return new OpenAI({
    apiKey,
    baseURL: 'https://openrouter.ai/api/v1',
  });
}
