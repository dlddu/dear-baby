import PostHog from 'posthog-react-native';

import { POSTHOG_HOST, POSTHOG_KEY } from '../config/env';

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
      // Forward unhandled JS exceptions to PostHog Error Tracking. The SDK
      // wires into the global error handlers itself; we only flip the bit.
      // https://posthog.com/docs/error-tracking/installation/react-native
      enableExceptionAutocapture: true,
      sessionReplayConfig: {
        maskAllTextInputs: true,
        maskAllImages: true,
        captureLog: true,
        captureNetworkTelemetry: true,
      },
    })
  : null;

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
