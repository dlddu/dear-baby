import OpenAI from 'openai';
import { observeOpenAI } from '@langfuse/openai';

// openrouterClient is the shared OpenRouter-backed OpenAI client. We
// deliberately use the official openai SDK with OpenRouter's baseURL swap
// so task code stays portable if we switch providers. The client is wrapped
// with @langfuse/openai's observeOpenAI so every chat completion emits an
// OpenTelemetry generation span. Actual export to Langfuse is handled by
// the LangfuseSpanProcessor installed in tracing.ts; if that bootstrap
// skipped (missing creds), the spans are still emitted but nothing
// listens, so this wrapper stays a silent no-op.
export function openrouterClient(apiKey: string): OpenAI {
  const client = new OpenAI({
    apiKey,
    baseURL: 'https://openrouter.ai/api/v1',
  });
  return observeOpenAI(client, { generationName: 'openrouter-chat' }) as OpenAI;
}
