import type { Logger } from 'pino';
import type Redis from 'ioredis';
import type OpenAI from 'openai';

// InternalAPIClient is the thin HTTP client that lets tasks read and write
// backend state without Redis in the loop. Scoped to what the worker
// actually needs — broader endpoints should be added only as tasks demand.
export interface InternalAPIClient {
  listPendingAIPreviews(): Promise<
    Array<{ user_id: string; record_id: string; content: string }>
  >;
  saveAIPreview(userID: string, preview: string): Promise<void>;
}

// TaskDeps is the bundle each task receives at dispatch + sync time.
// Concrete deps live here; tasks should not reach past these to touch
// globals, env, or module-level singletons, so tests can substitute
// in-memory fakes one-for-one.
export interface TaskDeps {
  redis: Redis;
  openrouter: OpenAI;
  model: string;
  backend: InternalAPIClient;
  logger: Logger;
}

// httpInternalAPI is the fetch-backed implementation used in production
// and integration tests. Authenticates with a shared token in the
// `X-Internal-Token` header — the token is configured out-of-band via the
// `internal-auth-secret` k8s Secret (see k8s/secrets/internal-auth-secret.example).
export function httpInternalAPI(options: {
  baseURL: string;
  token: string;
  logger: Logger;
  fetchImpl?: typeof fetch;
}): InternalAPIClient {
  const { baseURL, token, logger, fetchImpl = fetch } = options;
  const headers = {
    'Content-Type': 'application/json',
    'X-Internal-Token': token,
  };

  return {
    async listPendingAIPreviews() {
      const res = await fetchImpl(`${baseURL}/internal/tasks/ai-preview/pending`, {
        method: 'GET',
        headers,
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(
          `listPendingAIPreviews failed: ${res.status} ${body.slice(0, 200)}`,
        );
      }
      const json = (await res.json()) as Array<{
        user_id: string;
        record_id: string;
        content: string;
      }>;
      logger.debug({ count: json.length }, 'fetched pending AI previews');
      return json;
    },
    async saveAIPreview(userID, preview) {
      const res = await fetchImpl(`${baseURL}/internal/onboarding/ai-preview`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ user_id: userID, preview }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(
          `saveAIPreview failed: ${res.status} ${body.slice(0, 200)}`,
        );
      }
    },
  };
}
