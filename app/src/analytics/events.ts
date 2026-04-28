import { posthogClient } from './client';

// captureEvent and captureException are the non-React entry points used
// from product code (e.g. the upload orchestrator) where a hook isn't
// available. Both no-op when PostHog isn't initialized (no API key — local
// dev, Maestro runs) and swallow any error inside the SDK so analytics
// failures can never propagate into product flows.

export function captureEvent(
  event: string,
  properties?: Record<string, unknown>,
): void {
  if (!posthogClient) return;
  try {
    posthogClient.capture(event, properties);
  } catch {
    // analytics must never throw into product code
  }
}

export function captureException(
  error: unknown,
  properties?: Record<string, unknown>,
): void {
  if (!posthogClient) return;
  const err = error instanceof Error ? error : new Error(String(error));
  try {
    // captureException landed in posthog-react-native v4; fall back to a
    // plain $exception event if we're on a build that lacks it.
    const ph = posthogClient as unknown as {
      captureException?: (e: Error, p?: Record<string, unknown>) => void;
    };
    if (typeof ph.captureException === 'function') {
      ph.captureException(err, properties);
      return;
    }
    posthogClient.capture('$exception', {
      ...properties,
      $exception_message: err.message,
      $exception_type: err.name,
    });
  } catch {
    // analytics must never throw into product code
  }
}
