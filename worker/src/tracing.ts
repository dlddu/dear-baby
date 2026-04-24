import { NodeSDK } from '@opentelemetry/sdk-node';
import { LangfuseSpanProcessor } from '@langfuse/otel';
import type { Logger } from 'pino';

// TracingHandle is what the rest of the worker holds. Exposes a flush
// hook so tasks can await trace delivery synchronously after each LLM
// call — critical in CI where the pod is killed ~1s after a job.
//
// Neither method throws: tracing is non-critical, so a flush or shutdown
// failure logs via the bootstrap logger and resolves cleanly. Letting
// flush errors propagate would mark the preview as failed whenever
// Langfuse ingestion is degraded, which we explicitly don't want.
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
// forceFlush() explicitly after each LLM call as belt-and-braces.
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
    { baseUrl: process.env.LANGFUSE_BASE_URL ?? '<sdk default>' },
    'langfuse tracing enabled',
  );

  const logFailure = (phase: string) => (err: unknown) => {
    logger.warn(
      { err: err instanceof Error ? err.message : String(err), phase },
      'langfuse tracing error',
    );
  };

  return {
    flush: async () => {
      await processor.forceFlush().catch(logFailure('flush'));
    },
    shutdown: async () => {
      // sdk.shutdown() already calls forceFlush on every processor, but
      // we invoke it first explicitly so a shutdown failure downstream
      // (e.g. the SDK failing to unregister) doesn't rob us of the last
      // in-flight spans.
      await processor.forceFlush().catch(logFailure('shutdown-flush'));
      await sdk.shutdown().catch(logFailure('shutdown'));
    },
  };
}
