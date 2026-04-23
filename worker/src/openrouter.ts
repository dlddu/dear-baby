import OpenAI from 'openai';
import { observeOpenAI } from 'langfuse';

// openrouterClient is the shared OpenRouter-backed OpenAI client. We
// deliberately use the official openai SDK with OpenRouter's baseURL swap
// so task code stays portable if we switch providers. The client is wrapped
// with Langfuse's observeOpenAI so every chat completion is auto-traced.
// Langfuse picks up LANGFUSE_PUBLIC_KEY / LANGFUSE_SECRET_KEY / LANGFUSE_BASEURL
// from the environment; without them the SDK is a no-op pass-through.
//
// flushAt: 1 disables batching — short-lived workers (CI, single-job pods)
// would otherwise lose the trace sitting in the in-memory queue. Pair this
// with flushLangfuse() after each call so the HTTP POST is awaited.
export function openrouterClient(apiKey: string): OpenAI {
  const client = new OpenAI({
    apiKey,
    baseURL: 'https://openrouter.ai/api/v1',
  });
  return observeOpenAI(client, {
    generationName: 'openrouter-chat',
    clientInitParams: { flushAt: 1 },
  });
}

// flushLangfuse awaits the pending trace POST. Safe to call on any OpenAI
// client — if the SDK isn't Langfuse-wrapped (e.g. test mocks), the
// optional-chaining makes this a no-op.
export async function flushLangfuse(client: OpenAI): Promise<void> {
  const maybe = client as unknown as { flushAsync?: () => Promise<void> };
  await maybe.flushAsync?.();
}

// shutdownLangfuse drains the queue and stops the flush timer. Intended
// for the worker's shutdown path.
export async function shutdownLangfuse(client: OpenAI): Promise<void> {
  const maybe = client as unknown as { shutdownAsync?: () => Promise<void> };
  await maybe.shutdownAsync?.();
}
