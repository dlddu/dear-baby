import { useEffect, useRef } from 'react';
import { usePathname, useGlobalSearchParams } from 'expo-router';
import { usePostHog } from 'posthog-react-native';

// useScreenTracker emits a $screen event on every expo-router pathname
// change. We do this manually instead of relying on PostHogProvider's
// `autocapture={{ captureScreens: true }}` because that path uses the
// @react-navigation/native hooks directly, which throw when called
// outside the NavigationContainer that expo-router renders internally —
// the throw is swallowed by PostHogProvider, so screen tracking
// silently no-ops.
//
// Must be mounted inside the navigation tree (e.g. AuthGate). The hook
// is a no-op when PostHog isn't initialized.
export function useScreenTracker(): void {
  const posthog = usePostHog();
  const pathname = usePathname();
  const params = useGlobalSearchParams();
  const lastPathRef = useRef<string | null>(null);

  useEffect(() => {
    if (!posthog) return;
    if (!pathname) return;
    if (lastPathRef.current === pathname) return;
    lastPathRef.current = pathname;
    // Pass the route params as $screen properties so funnels can split
    // by id (e.g. record-audio-review/{id}). Filtering / masking is
    // PostHog-side: nothing in the path or params is sensitive on its
    // own — record IDs are opaque UUIDs.
    posthog.screen(pathname, params as Record<string, unknown>);
  }, [posthog, pathname, params]);
}
