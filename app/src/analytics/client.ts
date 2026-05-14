import PostHog from 'posthog-react-native';

import { APP_ENV, POSTHOG_HOST, POSTHOG_KEY } from '../config/env';

// Module-level PostHog singleton. Created once at bundle load so that
// non-React callers (e.g. the apiFetch wrapper) can attach the current
// session/distinct IDs to outbound requests for backend log correlation.
//
// Session replay is enabled with conservative privacy defaults: text
// inputs and images are masked unconditionally because user records hold
// personal pregnancy notes that must never leave the device unredacted.
// Network telemetry is on so backend calls show up in the replay timeline,
// which is what makes the app→backend trace usable in the PostHog UI.
export const posthogClient: PostHog | null = POSTHOG_KEY
  ? new PostHog(POSTHOG_KEY, {
      host: POSTHOG_HOST,
      enableSessionReplay: true,
      sessionReplayConfig: {
        maskAllTextInputs: true,
        maskAllImages: true,
        captureLog: true,
        captureNetworkTelemetry: true,
      },
      errorTracking: {
        autocapture: {
          uncaughtExceptions: true,
          unhandledRejections: true,
          console: ['error', 'warn'],
        },
      },
    })
  : null;

// Pin the deployment environment as a super property so every captured
// event, screen view, and replay carries `environment=development|staging|
// production`. Lets a single PostHog project serve all three environments
// without dev/staging traffic polluting production dashboards — filter or
// segment on the `environment` property in PostHog instead. register()
// queues internally until the SDK finishes loading, so the call is safe
// to make synchronously right after construction.
posthogClient?.register({ environment: APP_ENV });

// posthogHeaders returns the PostHog correlation headers to attach to
// backend requests. Returns an empty object when analytics is disabled or
// the SDK has not yet produced a session ID, so callers can spread it
// unconditionally into a Headers init.
export function posthogHeaders(): Record<string, string> {
  if (!posthogClient) return {};
  const headers: Record<string, string> = {};
  const sessionId = posthogClient.getSessionId?.();
  if (sessionId) headers['X-PostHog-Session-Id'] = sessionId;
  const distinctId = posthogClient.getDistinctId?.();
  if (distinctId) headers['X-PostHog-Distinct-Id'] = distinctId;
  return headers;
}
