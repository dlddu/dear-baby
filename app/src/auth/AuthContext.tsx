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
  createTextRecord as apiCreateTextRecord,
  createVoiceRecord as apiCreateVoiceRecord,
} from '../api/records';
import type { Record, Session, User } from '../api/types';
import {
  patchMe,
  submitOnboardingCaseA as apiSubmitCaseA,
  submitOnboardingCaseC as apiSubmitCaseC,
  type CaseAPayload,
  type CaseCPayload,
} from '../api/users';
import {
  clearOnboardingCache,
  clearOnboardingDraft,
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
  /**
   * Case A 결말 — 첫 태아 dueDate + 모든 태아 행(각 행에 동일 purposes 복제)을
   * 백엔드에 영속화하고 onboarded_at 을 스탬프한다.
   */
  completeOnboardingCaseA: (payload: CaseAPayload) => Promise<void>;
  /**
   * Case C 결말 — 모든 아이 행(각 행에 동일 purposes 복제)을 백엔드에 영속화하고
   * due_date 는 null 로, onboarded_at 만 스탬프한다.
   */
  completeOnboardingCaseC: (payload: CaseCPayload) => Promise<void>;
  dismissVoiceCoachmark: () => Promise<void>;
  createTextRecord: (content: string, questionText?: string) => Promise<void>;
  // createVoiceRecord saves the transcript with source="voice". The
  // returned Record is what the caller needs to either move on or
  // kick off the audio upload pipeline (record.id is the key for the
  // draft store + presigned URL).
  createVoiceRecord: (content: string, questionText?: string) => Promise<Record>;
  applyAiPreview: (preview: string) => Promise<void>;
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

function cacheFromUser(u: User) {
  return setCachedOnboarding(
    u.onboarded_at,
    u.due_date,
    u.voice_coachmark_dismissed_at,
    u.first_record_at,
    u.ai_preview,
  );
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
        await cacheFromUser(u);
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
    await cacheFromUser(session.user);
  }, []);

  const completeOnboarding = useCallback(async (dueDate: string | null) => {
    const updated = await patchMe({ due_date: dueDate });
    setUser(updated);
    setStatus(statusForUser(updated));
    await cacheFromUser(updated);
    // 백엔드 onboarded_at 이 스탬프되었으니 진행 중 입력 슬롯도 정리한다.
    // OnboardingProvider 가 unmount 되면서 자체 cleanup 도 하지만, 모드 전환
    // 타이밍의 누수를 막기 위해 여기서도 한 번 더 정리.
    await clearOnboardingDraft();
  }, []);

  const completeOnboardingCaseA = useCallback(async (payload: CaseAPayload) => {
    const updated = await apiSubmitCaseA(payload);
    setUser(updated);
    setStatus(statusForUser(updated));
    await cacheFromUser(updated);
    await clearOnboardingDraft();
  }, []);

  const completeOnboardingCaseC = useCallback(async (payload: CaseCPayload) => {
    const updated = await apiSubmitCaseC(payload);
    setUser(updated);
    setStatus(statusForUser(updated));
    await cacheFromUser(updated);
    await clearOnboardingDraft();
  }, []);

  // dismissVoiceCoachmark is called when the user taps the close button on
  // the home-screen voice-record coachmark. The backend stamps a timestamp
  // that persists across devices; we also optimistically update local state
  // so the coachmark vanishes immediately without waiting on the response.
  const dismissVoiceCoachmark = useCallback(async () => {
    const updated = await patchMe({ dismiss_voice_coachmark: true });
    setUser(updated);
    await cacheFromUser(updated);
  }, []);

  // createTextRecord saves a text entry and refreshes local user state.
  // Responsibility is strictly storage + user cache update — the home
  // screen observes `first_record_at` to decide when to request an AI
  // preview and subscribe to the SSE stream.
  const createTextRecord = useCallback(
    async (content: string, questionText?: string) => {
      const { user: updated } = await apiCreateTextRecord(content, questionText);
      setUser(updated);
      await cacheFromUser(updated);
    },
    [],
  );

  // createVoiceRecord saves the transcript half of a voice record. The
  // audio upload (or the decision to keep the audio local-only) is
  // handled by the review screen, which uses the returned record_id
  // to feed the draft store and/or uploadAudio orchestrator.
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

  // applyAiPreview is called by the home screen when the SSE stream
  // delivers a `ready` event. It merges the new preview text into the
  // current user without hitting /me again.
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
    setUser(null);
    setStatus('unauthenticated');
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      setSession,
      completeOnboarding,
      completeOnboardingCaseA,
      completeOnboardingCaseC,
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
      completeOnboarding,
      completeOnboardingCaseA,
      completeOnboardingCaseC,
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
