import IORedis from 'ioredis';
import pino from 'pino';

import { httpInternalAPI } from './deps';
import { TaskRegistry, runWorker } from './framework';
import { openrouterClient, shutdownLangfuse } from './openrouter';
import { aiPreviewTask } from './tasks/ai-preview';

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
  let internalAPIURL: string;
  let internalAPIToken: string;
  let openrouterAPIKey: string;
  let model: string;
  try {
    redisURL = requireEnv('REDIS_URL');
    internalAPIURL = requireEnv('INTERNAL_API_URL');
    internalAPIToken = requireEnv('INTERNAL_API_TOKEN');
    openrouterAPIKey = requireEnv('OPENROUTER_API_KEY');
    model = requireEnv('OPENROUTER_MODEL');
  } catch (err) {
    logger.fatal({ err: err instanceof Error ? err.message : String(err) }, 'env check failed');
    process.exit(1);
  }

  const redis = new IORedis(redisURL, {
    maxRetriesPerRequest: null,
  });
  redis.on('error', (err: Error) => logger.error({ err: err.message }, 'redis error'));

  // Langfuse activates when both keys are present; log it at boot so an
  // operator can tell at a glance whether tracing is live without
  // digging through the SDK's silent-degrade behaviour.
  const langfuseEnabled = Boolean(
    process.env.LANGFUSE_PUBLIC_KEY && process.env.LANGFUSE_SECRET_KEY,
  );
  logger.info(
    {
      enabled: langfuseEnabled,
      baseURL: process.env.LANGFUSE_BASEURL ?? 'https://cloud.langfuse.com',
    },
    'langfuse tracing',
  );

  const deps = {
    redis,
    openrouter: openrouterClient(openrouterAPIKey),
    model,
    backend: httpInternalAPI({
      baseURL: internalAPIURL,
      token: internalAPIToken,
      logger,
    }),
    logger,
  };

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
    await shutdownLangfuse(deps.openrouter).catch((err: unknown) =>
      logger.error(
        { err: err instanceof Error ? err.message : String(err) },
        'langfuse shutdown error',
      ),
    );
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
