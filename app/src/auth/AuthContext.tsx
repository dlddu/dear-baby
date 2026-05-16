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
  submitOnboardingCaseA as apiSubmitCaseA,
  submitOnboardingCaseB as apiSubmitCaseB,
  submitOnboardingCaseC as apiSubmitCaseC,
  type CaseAPayload,
  type CaseBPayload,
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
  /**
   * Case A 결말 — 첫 태아 dueDate + 모든 태아 행(각 행에 동일 purposes 복제)을
   * 백엔드에 영속화하고 onboarded_at 을 스탬프한다.
   */
  completeOnboardingCaseA: (payload: CaseAPayload) => Promise<void>;
  /**
   * Case B 결말 — 양육 아이 + 태아 양쪽 행을 한 번의 트랜잭션으로 영속화하고,
   * 첫 태아의 dueDate 를 onboarding.due_date 로 복사한 뒤 onboarded_at 을
   * 스탬프한다. 양육 아이의 purposes 는 슬롯별로 다르게, 태아의 purposes 는
   * 모든 행에 동일하게 복제되어 있다 (클라이언트가 보낸 그대로 저장).
   */
  completeOnboardingCaseB: (payload: CaseBPayload) => Promise<void>;
  /**
   * Case C 결말 — 모든 아이 행(각 행에 동일 purposes 복제)을 백엔드에 영속화하고
   * due_date 는 null 로, onboarded_at 만 스탬프한다.
   */
  completeOnboardingCaseC: (payload: CaseCPayload) => Promise<void>;
  createTextRecord: (content: string, questionText?: string) => Promise<void>;
  // createVoiceRecord saves the transcript with source="voice". The
  // returned Record is what the caller needs to either move on or
  // kick off the audio upload pipeline (record.id is the key for the
  // draft store + presigned URL).
  createVoiceRecord: (content: string, questionText?: string) => Promise<Record>;
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
    u.first_record_at,
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

  const completeOnboardingCaseA = useCallback(async (payload: CaseAPayload) => {
    const updated = await apiSubmitCaseA(payload);
    setUser(updated);
    setStatus(statusForUser(updated));
    await cacheFromUser(updated);
    await clearOnboardingDraft();
  }, []);

  const completeOnboardingCaseB = useCallback(async (payload: CaseBPayload) => {
    const updated = await apiSubmitCaseB(payload);
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
      completeOnboardingCaseA,
      completeOnboardingCaseB,
      completeOnboardingCaseC,
      createTextRecord,
      createVoiceRecord,
      signOut,
    }),
    [
      status,
      user,
      setSession,
      completeOnboardingCaseA,
      completeOnboardingCaseB,
      completeOnboardingCaseC,
      createTextRecord,
      createVoiceRecord,
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
