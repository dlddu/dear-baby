import Redis from 'ioredis';
import pino from 'pino';

import { httpBackendClient } from './deps.js';
import type { TaskDeps } from './deps.js';
import { runWorker, TaskRegistry } from './framework.js';
import { createOpenRouter } from './openrouter.js';
import { aiPreviewTask } from './tasks/ai-preview/index.js';

function requireEnv(key: string): string {
  const v = process.env[key];
  if (!v) {
    console.error(`missing required env: ${key}`);
    process.exit(1);
  }
  return v;
}

async function main(): Promise<void> {
  const model = requireEnv('OPENROUTER_MODEL');
  const openrouterKey = requireEnv('OPENROUTER_API_KEY');
  const redisUrl = requireEnv('REDIS_URL');
  const internalURL = requireEnv('INTERNAL_API_URL');
  const internalToken = requireEnv('INTERNAL_API_TOKEN');

  const logger = pino({ name: 'dear-baby-worker' });

  const redis = new Redis(redisUrl);
  redis.on('error', (err) => logger.error({ err }, 'redis error'));

  const openrouter = createOpenRouter(openrouterKey);
  const backend = httpBackendClient(internalURL, internalToken, logger);

  const deps: TaskDeps = { redis, openrouter, backend, logger, model };

  const registry = new TaskRegistry();
  registry.register(aiPreviewTask);

  logger.info({ model }, 'worker starting');
  await runWorker(registry, deps);
  await redis.quit();
  logger.info('worker exited cleanly');
}

main().catch((err) => {
  console.error('fatal:', err);
  process.exit(1);
});
