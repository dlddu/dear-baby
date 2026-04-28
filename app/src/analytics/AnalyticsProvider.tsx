import React from 'react';
import { PostHogProvider } from 'posthog-react-native';

import { POSTHOG_HOST, POSTHOG_KEY } from '../config/env';

// AnalyticsProvider wraps the app with PostHog when an API key is present.
// We deliberately fall through to a plain pass-through when POSTHOG_KEY is
// empty so that local development, Maestro runs, and forks without analytics
// credentials don't trigger the SDK's "missing API key" warnings or attempt
// network calls.
export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  if (!POSTHOG_KEY) {
    return <>{children}</>;
  }
  return (
    <PostHogProvider apiKey={POSTHOG_KEY} options={{ host: POSTHOG_HOST }}>
      {children}
    </PostHogProvider>
  );
}
