import IORedis from 'ioredis';
import pino from 'pino';

import { TaskRegistry, runWorker } from './framework';
import { openrouterClient } from './openrouter';
import { aiPreviewTask } from './tasks/ai-preview';
import { bootstrapTracing } from './tracing';

// requireEnv fails fast at boot if any mandatory variable is missing so
// an operator gets a clear log line instead of a mid-flight crash.
function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v || v.trim() === '') {
    throw new Error(`missing required env: ${name}`);
  }
  return v;
}

async function main(): Promise<void> {
  const logger = pino({
    level: process.env.LOG_LEVEL ?? 'info',
    base: { service: 'worker' },
  });

  let redisURL: string;
  let openrouterAPIKey: string;
  let model: string;
  // Optional: when set, overrides the OpenAI client baseURL so CI can
  // point the worker at a local mock instead of the real OpenRouter API.
  const openrouterBaseURL = process.env.OPENROUTER_BASE_URL;
  try {
    redisURL = requireEnv('REDIS_URL');
    openrouterAPIKey = requireEnv('OPENROUTER_API_KEY');
    model = requireEnv('OPENROUTER_MODEL');
  } catch (err) {
    logger.fatal({ err: err instanceof Error ? err.message : String(err) }, 'env check failed');
    process.exit(1);
  }

  // Bootstrap OpenTelemetry + LangfuseSpanProcessor before constructing
  // the OpenAI client — observeOpenAI emits spans regardless, but nothing
  // exports them until this is wired up.
  const tracing = bootstrapTracing(logger);

  const redis = new IORedis(redisURL, {
    maxRetriesPerRequest: null,
  });
  redis.on('error', (err: Error) => logger.error({ err: err.message }, 'redis error'));

  const deps = {
    redis,
    openrouter: openrouterClient(openrouterAPIKey, openrouterBaseURL),
    model,
    logger,
    tracing,
  };

  if (openrouterBaseURL) {
    logger.info({ openrouterBaseURL }, 'OPENROUTER_BASE_URL override active');
  }

  const registry = new TaskRegistry();
  registry.register(aiPreviewTask);

  logger.info({ tasks: registry.all().map((t) => t.type) }, 'worker starting');
  const handle = runWorker({ registry, deps, logger });

  // SIGTERM/SIGINT: drain the current job (runWorker finishes the
  // in-flight dispatch before returning from wait()), flush Langfuse,
  // close Redis, exit.
  const shutdown = async (sig: string) => {
    logger.info({ signal: sig }, 'shutdown requested');
    await handle.stop();
    try {
      await handle.wait();
    } catch (err) {
      logger.error({ err: err instanceof Error ? err.message : String(err) }, 'wait error');
    }
    if (tracing) {
      await tracing.shutdown().catch((err: unknown) =>
        logger.error(
          { err: err instanceof Error ? err.message : String(err) },
          'tracing shutdown error',
        ),
      );
    }
    await redis.quit().catch(() => {});
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  // The main loop runs forever unless the process is signalled.
  await handle.wait();
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('fatal:', err);
  process.exit(1);
});
