import type { Logger } from 'pino';
import type Redis from 'ioredis';
import type OpenAI from 'openai';

import type { TracingHandle } from './tracing';

// TaskDeps is the bundle each task receives at dispatch time. Tasks are
// pure compute: they read the payload, call the model, and publish a
// result. The backend owns orchestration (enqueue, persistence, SSE
// fanout), so tasks deliberately have no HTTP client or DB handle here.
export interface TaskDeps {
  redis: Redis;
  openrouter: OpenAI;
  model: string;
  logger: Logger;
  // tracing is null when Langfuse credentials aren't configured; tasks
  // should optional-chain the flush call so tests and dev runs stay
  // agnostic.
  tracing: TracingHandle | null;
}
