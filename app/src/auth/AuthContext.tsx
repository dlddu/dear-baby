import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { logout as apiLogout, me as apiMe } from '../api/auth';
import { setSessionExpiredHandler } from '../api/client';
import {
  createTextRecord as apiCreateTextRecord,
  createVoiceRecord as apiCreateVoiceRecord,
} from '../api/records';
import type { CreateRecordOptions } from '../api/records';
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
  cleanupLegacyDueDateKey,
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
   * Case A 결말 — 모든 태아 행(각 행에 동일 purposes 복제)을 백엔드에
   * 영속화하고 onboarded_at 을 스탬프한다.
   */
  completeOnboardingCaseA: (payload: CaseAPayload) => Promise<void>;
  /**
   * Case B 결말 — 양육 아이 + 태아 양쪽 행을 한 번의 트랜잭션으로 영속화하고
   * onboarded_at 을 스탬프한다. 양육 아이의 purposes 는 슬롯별로 다르게,
   * 태아의 purposes 는 모든 행에 동일하게 복제되어 있다 (클라이언트가 보낸
   * 그대로 저장).
   */
  completeOnboardingCaseB: (payload: CaseBPayload) => Promise<void>;
  /**
   * Case C 결말 — 모든 아이 행(각 행에 동일 purposes 복제)을 백엔드에
   * 영속화하고 onboarded_at 을 스탬프한다.
   */
  completeOnboardingCaseC: (payload: CaseCPayload) => Promise<void>;
  createTextRecord: (
    content: string,
    options: CreateRecordOptions,
  ) => Promise<void>;
  // createVoiceRecord saves the transcript with source="voice". The
  // returned Record is what the caller needs to either move on or
  // kick off the audio upload pipeline (record.id is the key for the
  // draft store + presigned URL).
  createVoiceRecord: (
    content: string,
    options: CreateRecordOptions,
  ) => Promise<Record>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

// statusForUser decides whether a signed-in user should be directed to the
// onboarding funnel or straight to the app. `onboarded_at` is the backend's
// completion marker.
function statusForUser(u: User): AuthStatus {
  return u.onboarded_at ? 'authenticated' : 'onboarding';
}

function cacheFromUser(u: User) {
  return setCachedOnboarding(u.onboarded_at, u.first_record_at);
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
      // 이전 빌드의 stale `db_due_date` SecureStore 키를 부팅 시 1회 정리.
      void cleanupLegacyDueDateKey();
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
        // /me failed. Distinguish two cases before falling back:
        //
        // 1) The session is definitively dead: apiFetch's 401→refresh path
        //    got a 401 for the refresh token itself (expired/revoked after a
        //    long absence) and cleared both tokens. Falling back to
        //    'authenticated' here would strand the user on a home screen
        //    where every call 401s — with no access token there is no
        //    refresh retry, and no route back to the landing screen until an
        //    app restart. Detect it by the tokens' absence and re-login.
        // 2) Transient failure (airplane mode, backend hiccup): the tokens
        //    survived. If we also have a cached onboarding marker, the user
        //    has definitely completed onboarding before — treat as
        //    authenticated so they aren't pushed back into the funnel.
        const accessAfterMe = await getAccessToken();
        if (!accessAfterMe) {
          // Mirror signOut's local cleanup: a dead session is a forced
          // sign-out, so the next boot must not consult this user's cache.
          await clearOnboardingCache();
          setStatus('unauthenticated');
          return;
        }
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

  // Forced sign-out bridge. apiFetch clears the token pair when the refresh
  // token itself is rejected (401), but it lives outside React and can't move
  // the UI. Register a handler so a mid-session session death drops the user
  // to the landing screen right away instead of leaving them on an
  // authenticated screen where every call 401s until the next launch. Mirrors
  // signOut's local cleanup — tokens are already gone, and there is no server
  // revoke to attempt (the refresh token is what just got rejected).
  useEffect(() => {
    setSessionExpiredHandler(() => {
      void clearOnboardingCache();
      setUser(null);
      setStatus('unauthenticated');
    });
    return () => setSessionExpiredHandler(null);
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
    async (content: string, options: CreateRecordOptions) => {
      const { user: updated } = await apiCreateTextRecord(content, options);
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
    async (content: string, options: CreateRecordOptions) => {
      const { record, user: updated } = await apiCreateVoiceRecord(content, options);
      setUser(updated);
      await cacheFromUser(updated);
      return record;
    },
    [],
  );

  const signOut = useCallback(async () => {
    const refresh = await getRefreshToken();
    if (refresh) {
      // Best-effort server revoke, fire-and-forget: local token deletion is
      // the source of truth for sign-out, so we don't block the UI on a
      // network round-trip. Awaiting it froze the button on slow/offline
      // networks; apiLogout swallows its own errors so this never rejects.
      void apiLogout(refresh);
    }
    // Let SecureStore failures propagate so the caller (settings screen) can
    // surface an error and leave the session intact. Flipping to
    // 'unauthenticated' while the tokens survive on disk would silently
    // auto-log-in again on the next launch — better to fail loudly and retry.
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
