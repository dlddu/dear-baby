import React from 'react';
import { PostHogProvider } from 'posthog-react-native';

import { posthogClient } from './client';

// AnalyticsProvider exposes the shared PostHog client to the React tree.
// When no API key is configured, `posthogClient` is null and we render the
// children directly so local development, Maestro runs, and forks without
// analytics credentials don't trigger SDK warnings or network calls.
export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  if (!posthogClient) {
    return <>{children}</>;
  }
  return <PostHogProvider client={posthogClient}>{children}</PostHogProvider>;
}
