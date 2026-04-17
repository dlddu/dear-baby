import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { logout as apiLogout, me as apiMe } from '../api/auth';
import type { Session, User } from '../api/types';
import { patchMe } from '../api/users';
import {
  clearOnboardingCache,
  getCachedOnboardedAt,
  setCachedOnboarding,
} from './onboardingCache';
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  setTokens,
} from './tokens';

export type AuthStatus =
  | 'loading'
  | 'unauthenticated'
  | 'onboarding'
  | 'authenticated';

type AuthContextValue = {
  status: AuthStatus;
  user: User | null;
  setSession: (session: Session) => Promise<void>;
  completeOnboarding: (dueDate: string | null) => Promise<void>;
  dismissStage2Coachmark: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

// statusForUser decides whether a signed-in user should be directed to the
// onboarding funnel or straight to the app. `onboarded_at` is the backend's
// completion marker — we check that rather than `due_date` because the
// escape-hatch path intentionally leaves due_date null.
function statusForUser(u: User): AuthStatus {
  return u.onboarded_at ? 'authenticated' : 'onboarding';
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<User | null>(null);

  // Boot: if there is a stored access token, try /me. This is the only place
  // where status flips to 'authenticated'/'onboarding' automatically. While
  // we are waiting on /me (or if no token exists) status stays 'loading' →
  // 'unauthenticated' and the router keeps the user on the landing screen,
  // which preserves the Maestro health-check flow on cold start.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const access = await getAccessToken();
      if (!access) {
        if (!cancelled) setStatus('unauthenticated');
        return;
      }
      try {
        const u = await apiMe();
        if (cancelled) return;
        setUser(u);
        setStatus(statusForUser(u));
        await setCachedOnboarding(
          u.onboarded_at,
          u.due_date,
          u.stage2_coachmark_dismissed_at,
        );
      } catch {
        if (cancelled) return;
        // /me failed. If we have a cached onboarding marker, the user has
        // definitely completed onboarding before — treat as authenticated
        // so they aren't pushed back into the funnel on a transient error.
        // Otherwise clear tokens and send them to the landing screen.
        const cachedOnboardedAt = await getCachedOnboardedAt();
        if (cachedOnboardedAt) {
          setStatus('authenticated');
          return;
        }
        await clearTokens();
        setStatus('unauthenticated');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setSession = useCallback(async (session: Session) => {
    await setTokens(session.accessToken, session.refreshToken);
    setUser(session.user);
    setStatus(statusForUser(session.user));
    await setCachedOnboarding(
      session.user.onboarded_at,
      session.user.due_date,
      session.user.stage2_coachmark_dismissed_at,
    );
  }, []);

  const completeOnboarding = useCallback(async (dueDate: string | null) => {
    const updated = await patchMe({ due_date: dueDate });
    setUser(updated);
    setStatus(statusForUser(updated));
    await setCachedOnboarding(
      updated.onboarded_at,
      updated.due_date,
      updated.stage2_coachmark_dismissed_at,
    );
  }, []);

  // dismissStage2Coachmark is called when the user taps the close button on
  // the home-screen voice-record coachmark. The backend stamps a timestamp
  // that persists across devices; we also optimistically update local state
  // so the coachmark vanishes immediately without waiting on the response.
  const dismissStage2Coachmark = useCallback(async () => {
    const updated = await patchMe({ dismiss_stage2_coachmark: true });
    setUser(updated);
    await setCachedOnboarding(
      updated.onboarded_at,
      updated.due_date,
      updated.stage2_coachmark_dismissed_at,
    );
  }, []);

  const signOut = useCallback(async () => {
    const refresh = await getRefreshToken();
    if (refresh) {
      await apiLogout(refresh);
    }
    await clearTokens();
    await clearOnboardingCache();
    setUser(null);
    setStatus('unauthenticated');
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      setSession,
      completeOnboarding,
      dismissStage2Coachmark,
      signOut,
    }),
    [
      status,
      user,
      setSession,
      completeOnboarding,
      dismissStage2Coachmark,
      signOut,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
