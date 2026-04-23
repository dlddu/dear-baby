import OpenAI from 'openai';
import { observeOpenAI } from 'langfuse';

// openrouterClient is the shared OpenRouter-backed OpenAI client. We
// deliberately use the official openai SDK with OpenRouter's baseURL swap
// so task code stays portable if we switch providers. The client is wrapped
// with Langfuse's observeOpenAI so every chat completion is auto-traced.
// Langfuse picks up LANGFUSE_PUBLIC_KEY / LANGFUSE_SECRET_KEY / LANGFUSE_BASEURL
// from the environment; without them the SDK is a no-op pass-through.
export function openrouterClient(apiKey: string): OpenAI {
  const client = new OpenAI({
    apiKey,
    baseURL: 'https://openrouter.ai/api/v1',
  });
  return observeOpenAI(client, {
    generationName: 'openrouter-chat',
  });
}
