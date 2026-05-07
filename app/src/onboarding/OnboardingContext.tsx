// OnboardingContext — 케이스 분기 온보딩(M-02 / M-03)에서 들어오는
// Q1·Q2 답변을 가입 직후 인메모리 상태로 들고 다니다가, Case A → 예정일
// 입력 화면 → 홈으로 이어지는 흐름이나 Case B/C → "준비 중" 안내 화면으로
// 분기시키기 위해 사용한다.
//
// PRD-006 AC-006-01 의 분기 규칙을 그대로 코드화한다:
//
//   임신 O · 양육 X → 'A'
//   임신 O · 양육 O → 'B'
//   임신 X · 양육 O → 'C'
//   임신 X · 양육 X → 'fallback-A' (현재 정의되지 않은 조합 — Case A 입력 흐름으로 안내)
//
// 백엔드 영속화는 본 단계에 포함되지 않는다. Case A 결말은 기존 welcome
// 화면(예정일 입력)이 담당하고, Case B/C 결말은 not-ready placeholder 가
// `completeOnboarding(null)` 으로 닫는다.

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { useAuth } from '../auth/AuthContext';

export type OnboardingCase = 'A' | 'B' | 'C' | 'fallback-A';

type OnboardingContextValue = {
  q1Pregnant: boolean | null;
  q2HasChildren: boolean | null;
  setQ1: (value: boolean) => void;
  setQ2: (value: boolean) => void;
  /** 현재 답변 조합으로 결정된 Case. 둘 다 입력되지 않았으면 null. */
  caseDecision: () => OnboardingCase | null;
  /** Case B/C 결말에서 "홈으로 시작하기" 처리 — onboarded_at 만 스탬프, due_date 는 null. */
  completeAsBC: () => Promise<void>;
};

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

function decide(
  q1: boolean | null,
  q2: boolean | null,
): OnboardingCase | null {
  if (q1 === null || q2 === null) return null;
  if (q1 && !q2) return 'A';
  if (q1 && q2) return 'B';
  if (!q1 && q2) return 'C';
  return 'fallback-A';
}

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const { completeOnboarding } = useAuth();
  const [q1Pregnant, setQ1Pregnant] = useState<boolean | null>(null);
  const [q2HasChildren, setQ2HasChildren] = useState<boolean | null>(null);

  const setQ1 = useCallback((value: boolean) => setQ1Pregnant(value), []);
  const setQ2 = useCallback((value: boolean) => setQ2HasChildren(value), []);

  const caseDecision = useCallback(
    () => decide(q1Pregnant, q2HasChildren),
    [q1Pregnant, q2HasChildren],
  );

  const completeAsBC = useCallback(async () => {
    await completeOnboarding(null);
  }, [completeOnboarding]);

  const value = useMemo<OnboardingContextValue>(
    () => ({
      q1Pregnant,
      q2HasChildren,
      setQ1,
      setQ2,
      caseDecision,
      completeAsBC,
    }),
    [q1Pregnant, q2HasChildren, setQ1, setQ2, caseDecision, completeAsBC],
  );

  return (
    <OnboardingContext.Provider value={value}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding(): OnboardingContextValue {
  const ctx = useContext(OnboardingContext);
  if (!ctx) {
    throw new Error('useOnboarding must be used inside OnboardingProvider');
  }
  return ctx;
}
