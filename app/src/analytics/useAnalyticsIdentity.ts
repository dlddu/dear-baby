import { useEffect, useRef } from 'react';
import { usePostHog } from 'posthog-react-native';

import { useAuth } from '../auth/AuthContext';

// useAnalyticsIdentity keeps PostHog's distinct ID in sync with the auth
// state. It identifies on sign-in / onboarding completion and resets on
// sign-out so events from a shared device are not attributed to the wrong
// account. The hook is a no-op when PostHog isn't initialized (no API key),
// because `usePostHog()` returns undefined in that case.
export function useAnalyticsIdentity(): void {
  const posthog = usePostHog();
  const { status, user } = useAuth();
  const lastIdentifiedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!posthog) return;
    if (status === 'loading') return;

    if (user) {
      if (lastIdentifiedRef.current === user.id) return;
      lastIdentifiedRef.current = user.id;
      posthog.identify(user.id, {
        onboarded: user.onboarded_at != null,
        case_kind: user.case_kind ?? 'unset',
        has_first_record: user.first_record_at != null,
      });
      return;
    }

    if (lastIdentifiedRef.current) {
      lastIdentifiedRef.current = null;
      posthog.reset();
    }
  }, [posthog, status, user]);
}
