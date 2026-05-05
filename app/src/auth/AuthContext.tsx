import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { logout as apiLogout, me as apiMe } from '../api/auth';
import {
  submitCaseOnboarding as apiSubmitCaseOnboarding,
  type CaseOnboardingPayload,
} from '../api/onboarding';
import {
  createTextRecord as apiCreateTextRecord,
  createVoiceRecord as apiCreateVoiceRecord,
} from '../api/records';
import type { Record, Session, User } from '../api/types';
import { patchMe } from '../api/users';
import { clearDraft } from '../onboarding/draft';
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
  /** Submits the case-branched onboarding payload (PRD-006) and flips
   *  status to 'authenticated'. Replaces the old completeOnboarding
   *  due-date path. */
  submitCaseOnboarding: (payload: CaseOnboardingPayload) => Promise<void>;
  dismissVoiceCoachmark: () => Promise<void>;
  createTextRecord: (content: string, questionText?: string) => Promise<void>;
  createVoiceRecord: (content: string, questionText?: string) => Promise<Record>;
  applyAiPreview: (preview: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

// statusForUser decides whether a signed-in user should be directed to
// the onboarding funnel or straight to the app. `onboarded_at` is the
// backend's completion marker — we check that rather than `case_kind`
// because the two are stamped together on a successful submit.
function statusForUser(u: User): AuthStatus {
  return u.onboarded_at ? 'authenticated' : 'onboarding';
}

function cacheFromUser(u: User) {
  return setCachedOnboarding(
    u.onboarded_at,
    u.case_kind,
    u.voice_coachmark_dismissed_at,
    u.first_record_at,
    u.ai_preview,
  );
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<User | null>(null);

  // Boot: if there is a stored access token, try /me. This is the only
  // place where status flips to 'authenticated'/'onboarding'
  // automatically. While we are waiting on /me (or if no token exists)
  // status stays 'loading' → 'unauthenticated' and the router keeps the
  // user on the landing screen, which preserves the Maestro health
  // flow on cold start.
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
        await cacheFromUser(u);
      } catch {
        if (cancelled) return;
        // /me failed. If we have a cached completion marker, the user
        // has definitely completed onboarding before — treat as
        // authenticated so they aren't pushed back into the funnel on
        // a transient error.
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
    await cacheFromUser(session.user);
  }, []);

  const submitCaseOnboarding = useCallback(
    async (payload: CaseOnboardingPayload) => {
      const updated = await apiSubmitCaseOnboarding(payload);
      setUser(updated);
      setStatus(statusForUser(updated));
      await cacheFromUser(updated);
      // Server has the data — local draft is no longer authoritative.
      await clearDraft();
    },
    [],
  );

  // dismissVoiceCoachmark is called when the user taps the close
  // button on the home-screen voice-record coachmark. The backend
  // stamps a timestamp that persists across devices.
  const dismissVoiceCoachmark = useCallback(async () => {
    const updated = await patchMe({ dismiss_voice_coachmark: true });
    setUser(updated);
    await cacheFromUser(updated);
  }, []);

  const createTextRecord = useCallback(
    async (content: string, questionText?: string) => {
      const { user: updated } = await apiCreateTextRecord(content, questionText);
      setUser(updated);
      await cacheFromUser(updated);
    },
    [],
  );

  const createVoiceRecord = useCallback(
    async (content: string, questionText?: string) => {
      const { record, user: updated } = await apiCreateVoiceRecord(
        content,
        questionText,
      );
      setUser(updated);
      await cacheFromUser(updated);
      return record;
    },
    [],
  );

  const applyAiPreview = useCallback(async (preview: string) => {
    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ai_preview: preview };
      void cacheFromUser(next);
      return next;
    });
  }, []);

  const signOut = useCallback(async () => {
    const refresh = await getRefreshToken();
    if (refresh) {
      await apiLogout(refresh);
    }
    await clearTokens();
    await clearOnboardingCache();
    await clearDraft();
    setUser(null);
    setStatus('unauthenticated');
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      setSession,
      submitCaseOnboarding,
      dismissVoiceCoachmark,
      createTextRecord,
      createVoiceRecord,
      applyAiPreview,
      signOut,
    }),
    [
      status,
      user,
      setSession,
      submitCaseOnboarding,
      dismissVoiceCoachmark,
      createTextRecord,
      createVoiceRecord,
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
