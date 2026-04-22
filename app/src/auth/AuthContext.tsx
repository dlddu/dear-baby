import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { logout as apiLogout, me as apiMe } from '../api/auth';
import { createTextRecord as apiCreateTextRecord } from '../api/records';
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
  dismissVoiceCoachmark: () => Promise<void>;
  createTextRecord: (content: string) => Promise<void>;
  applyAiPreview: (preview: string) => void;
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
          u.voice_coachmark_dismissed_at,
          u.first_record_at,
        );
      } catch {
        if (cancelled) return;
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
      session.user.voice_coachmark_dismissed_at,
      session.user.first_record_at,
    );
  }, []);

  const completeOnboarding = useCallback(async (dueDate: string | null) => {
    const updated = await patchMe({ due_date: dueDate });
    setUser(updated);
    setStatus(statusForUser(updated));
    await setCachedOnboarding(
      updated.onboarded_at,
      updated.due_date,
      updated.voice_coachmark_dismissed_at,
      updated.first_record_at,
    );
  }, []);

  // dismissVoiceCoachmark is called when the user taps the close button on
  // the home-screen voice-record coachmark. The backend stamps a timestamp
  // that persists across devices; we also optimistically update local state
  // so the coachmark vanishes immediately without waiting on the response.
  const dismissVoiceCoachmark = useCallback(async () => {
    const updated = await patchMe({ dismiss_voice_coachmark: true });
    setUser(updated);
    await setCachedOnboarding(
      updated.onboarded_at,
      updated.due_date,
      updated.voice_coachmark_dismissed_at,
      updated.first_record_at,
    );
  }, []);

  // createTextRecord saves a text entry and refreshes local user state. The
  // home screen is responsible for detecting the first-record transition and
  // triggering the AI preview flow — AuthContext stays record-agnostic.
  const createTextRecord = useCallback(async (content: string) => {
    const { user: updated } = await apiCreateTextRecord(content);
    setUser(updated);
    await setCachedOnboarding(
      updated.onboarded_at,
      updated.due_date,
      updated.voice_coachmark_dismissed_at,
      updated.first_record_at,
    );
  }, []);

  // applyAiPreview merges an ai_preview string (from the SSE stream) into
  // the local user object so the UI transitions from loading → ready.
  const applyAiPreview = useCallback((preview: string) => {
    setUser((u) => (u ? { ...u, ai_preview: preview } : u));
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
      dismissVoiceCoachmark,
      createTextRecord,
      applyAiPreview,
      signOut,
    }),
    [
      status,
      user,
      setSession,
      completeOnboarding,
      dismissVoiceCoachmark,
      createTextRecord,
      applyAiPreview,
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
