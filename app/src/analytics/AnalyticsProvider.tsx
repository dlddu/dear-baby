import React from 'react';
import { PostHogProvider } from 'posthog-react-native';

import { posthogClient } from './client';

// AnalyticsProvider exposes the shared PostHog client to the React tree.
// When no API key is configured, `posthogClient` is null and we render the
// children directly so local development, Maestro runs, and forks without
// analytics credentials don't trigger SDK warnings or network calls.
//
// `captureScreens` is disabled because PostHog's built-in screen autocapture
// relies on React Navigation hooks that changed in v7, and we're on
// @react-navigation/native v7. Screen views are emitted manually from
// `useScreenTracking`, driven by Expo Router's URL state.
export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  if (!posthogClient) {
    return <>{children}</>;
  }
  return (
    <PostHogProvider client={posthogClient} autocapture={{ captureScreens: false }}>
      {children}
    </PostHogProvider>
  );
}
