import { NodeSDK } from '@opentelemetry/sdk-node';
import { LangfuseSpanProcessor } from '@langfuse/otel';
import type { Logger } from 'pino';

// TracingHandle is what the rest of the worker holds. Exposes a flush
// hook so tasks can await trace delivery synchronously after each LLM
// call — critical in CI where the pod is killed ~1s after a job.
export interface TracingHandle {
  flush(): Promise<void>;
  shutdown(): Promise<void>;
}

// bootstrapTracing wires @langfuse/otel's LangfuseSpanProcessor into an
// OpenTelemetry NodeSDK. Returns null when credentials are missing, so
// the worker can run without tracing in dev/tests. Reads config from
// LANGFUSE_PUBLIC_KEY / LANGFUSE_SECRET_KEY / LANGFUSE_BASE_URL.
//
// exportMode: "immediate" flushes each span as it ends — the batched
// default would queue spans for up to flushInterval seconds, which
// short-lived workers (CI, per-job pods) can't afford. We still call
// forceFlush() explicitly after each LLM call for belt-and-braces.
export function bootstrapTracing(logger: Logger): TracingHandle | null {
  const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
  const secretKey = process.env.LANGFUSE_SECRET_KEY;
  if (!publicKey || !secretKey) {
    logger.info(
      'langfuse tracing disabled — LANGFUSE_PUBLIC_KEY / LANGFUSE_SECRET_KEY not set',
    );
    return null;
  }

  const processor = new LangfuseSpanProcessor({ exportMode: 'immediate' });
  const sdk = new NodeSDK({ spanProcessors: [processor] });
  sdk.start();

  logger.info(
    {
      baseUrl: process.env.LANGFUSE_BASE_URL ?? 'https://cloud.langfuse.com (SDK default EU)',
    },
    'langfuse tracing enabled',
  );

  return {
    flush: () => processor.forceFlush(),
    shutdown: async () => {
      await processor.forceFlush().catch(() => {});
      await sdk.shutdown().catch(() => {});
    },
  };
}
