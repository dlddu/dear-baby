import { useEffect } from 'react';
import { useGlobalSearchParams, usePathname } from 'expo-router';
import { usePostHog } from 'posthog-react-native';

// useScreenTracking captures a PostHog `$screen` event whenever the active
// Expo Router pathname or search params change. PostHog's built-in screen
// autocapture relies on React Navigation hooks that changed in v7, so the
// SDK no longer reports screen views on its own (we're on
// @react-navigation/native v7). Following PostHog's and Expo Router's
// recommendations, we drive the capture manually from the router's URL
// state, which is the canonical source of truth for the current screen.
export function useScreenTracking(): void {
  const posthog = usePostHog();
  const pathname = usePathname();
  const params = useGlobalSearchParams();

  useEffect(() => {
    if (!posthog) return;
    if (!pathname) return;
    posthog.screen(pathname, params);
  }, [posthog, pathname, params]);
}
