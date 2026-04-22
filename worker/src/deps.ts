import type Redis from 'ioredis';
import type { Logger } from 'pino';
import type OpenAI from 'openai';

// BackendClient is the narrow interface tasks use to call the backend's
// `/internal/*` API. Kept minimal so tests can pass a fake.
export interface BackendClient {
  listPendingAIPreviews(): Promise<PendingAIPreview[]>;
  saveAIPreview(userId: string, preview: string): Promise<void>;
}

export interface PendingAIPreview {
  user_id: string;
  record_id: string;
  content: string;
}

export interface TaskDeps {
  redis: Redis;
  openrouter: OpenAI;
  backend: BackendClient;
  logger: Logger;
  model: string;
}

// httpBackendClient is the production implementation. Uses the global fetch
// (Node 20+) so we don't pull in an extra dep.
export function httpBackendClient(
  baseURL: string,
  token: string,
  logger: Logger,
): BackendClient {
  const headers = {
    'Content-Type': 'application/json',
    'X-Internal-Token': token,
  };
  return {
    async listPendingAIPreviews() {
      const res = await fetch(`${baseURL}/internal/tasks/ai-preview/pending`, {
        headers,
      });
      if (!res.ok) {
        throw new Error(`listPendingAIPreviews: ${res.status}`);
      }
      return (await res.json()) as PendingAIPreview[];
    },
    async saveAIPreview(userId, preview) {
      const res = await fetch(`${baseURL}/internal/onboarding/ai-preview`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ user_id: userId, preview }),
      });
      if (!res.ok) {
        logger.error(
          { status: res.status, userId },
          'saveAIPreview failed',
        );
        throw new Error(`saveAIPreview: ${res.status}`);
      }
    },
  };
}
