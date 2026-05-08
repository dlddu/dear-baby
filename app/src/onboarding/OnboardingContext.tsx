// OnboardingContext — 케이스 분기 온보딩(M-02 / M-03)에서 들어오는
// Q1·Q2 답변과 Case A 의 A1·A2 입력을 가입 직후부터 들고 다닌다. 단순
// 인메모리 상태가 아니라 SecureStore 에도 영속화하여 앱 강제 종료 후
// 재진입 시 마지막 입력 상태로 복원된다.
//
// PRD-006 AC-006-01 의 분기 규칙:
//
//   임신 O · 양육 X → 'A'
//   임신 O · 양육 O → 'B'
//   임신 X · 양육 O → 'C'
//   임신 X · 양육 X → 'fallback-A' (현재 정의되지 않은 조합 — Case A 입력 흐름으로 안내)
//
// 라우팅 정책: hydrate 후 마지막 입력 지점으로 자동 점프하지 않는다. 화면
// 진입은 q1 부터 그대로, 다만 각 화면이 컨텍스트의 기존 값을 default
// selected/filled 상태로 표시한다. 사용자가 [다음] 버튼을 빠르게 눌러
// 진행한다.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { useAuth } from '../auth/AuthContext';
import {
  clearOnboardingDraft,
  loadOnboardingDraft,
  saveOnboardingDraft,
} from '../auth/onboardingCache';

import type { FetusCount, FetusDraft } from './types';

export type OnboardingCase = 'A' | 'B' | 'C' | 'fallback-A';

type OnboardingContextValue = {
  /** SecureStore hydrate 진행 중. true 동안 화면을 가리거나 스플래시로 대체. */
  hydrating: boolean;
  q1Pregnant: boolean | null;
  q2HasChildren: boolean | null;
  fetusCount: FetusCount | null;
  fetuses: FetusDraft[];
  currentFetusIndex: number;
  setQ1: (value: boolean) => void;
  setQ2: (value: boolean) => void;
  setFetusCount: (value: FetusCount) => void;
  updateFetus: (index: number, patch: Partial<FetusDraft>) => void;
  setCurrentFetusIndex: (index: number) => void;
  /** 현재 답변 조합으로 결정된 Case. 둘 다 입력되지 않았으면 null. */
  caseDecision: () => OnboardingCase | null;
  /** Case B/C 결말에서 "홈으로 시작하기" 처리 — onboarded_at 만 스탬프, due_date 는 null. */
  completeAsBC: () => Promise<void>;
  /**
   * Case A 결말 — 첫 태아의 dueDate 만 백엔드에 흘려보내고 onboarded_at 을
   * 스탬프한다. 다태 다중 dueDate 영속화는 별도 작업.
   */
  completeAsA: () => Promise<void>;
  /** 진행 중 입력 초기화. 비상 상황·디버그 용도. */
  resetOnboardingDraft: () => Promise<void>;
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
  const [hydrating, setHydrating] = useState(true);
  const [q1Pregnant, setQ1Pregnant] = useState<boolean | null>(null);
  const [q2HasChildren, setQ2HasChildren] = useState<boolean | null>(null);
  const [fetusCount, setFetusCountState] = useState<FetusCount | null>(null);
  const [fetuses, setFetuses] = useState<FetusDraft[]>([]);
  const [currentFetusIndex, setCurrentFetusIndexState] = useState(0);

  // SecureStore 에서 마지막 입력 상태를 hydrate. 마운트 한 번만.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const draft = await loadOnboardingDraft();
        if (cancelled) return;
        setQ1Pregnant(draft.q1Pregnant);
        setQ2HasChildren(draft.q2HasChildren);
        setFetusCountState(draft.fetusCount);
        setFetuses(draft.fetuses);
        setCurrentFetusIndexState(draft.currentFetusIndex);
      } catch (e) {
        console.warn('[onboarding] loadOnboardingDraft failed', e);
      } finally {
        if (!cancelled) setHydrating(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setQ1 = useCallback((value: boolean) => {
    setQ1Pregnant(value);
    void saveOnboardingDraft({ q1Pregnant: value });
  }, []);

  const setQ2 = useCallback((value: boolean) => {
    setQ2HasChildren(value);
    void saveOnboardingDraft({ q2HasChildren: value });
  }, []);

  const setFetusCount = useCallback(
    (value: FetusCount) => {
      setFetusCountState(value);
      // 카운트가 바뀌면 fetuses 배열의 길이를 맞춰주고 인덱스도 0 으로 초기화.
      setFetuses((prev) => {
        const next = prev.slice(0, value);
        while (next.length < value) next.push({});
        void saveOnboardingDraft({
          fetusCount: value,
          fetuses: next,
          currentFetusIndex: 0,
        });
        return next;
      });
      setCurrentFetusIndexState(0);
    },
    [],
  );

  const updateFetus = useCallback(
    (index: number, patch: Partial<FetusDraft>) => {
      setFetuses((prev) => {
        const next = prev.slice();
        // 슬롯이 아직 없을 수도 있으니 채워준다.
        while (next.length <= index) next.push({});
        next[index] = { ...next[index], ...patch };
        void saveOnboardingDraft({ fetuses: next });
        return next;
      });
    },
    [],
  );

  const setCurrentFetusIndex = useCallback((index: number) => {
    setCurrentFetusIndexState(index);
    void saveOnboardingDraft({ currentFetusIndex: index });
  }, []);

  const caseDecision = useCallback(
    () => decide(q1Pregnant, q2HasChildren),
    [q1Pregnant, q2HasChildren],
  );

  const completeAsBC = useCallback(async () => {
    await completeOnboarding(null);
    await clearOnboardingDraft();
  }, [completeOnboarding]);

  const completeAsA = useCallback(async () => {
    const firstDueDate = fetuses[0]?.dueDate ?? null;
    await completeOnboarding(firstDueDate);
    await clearOnboardingDraft();
  }, [completeOnboarding, fetuses]);

  const resetOnboardingDraft = useCallback(async () => {
    setQ1Pregnant(null);
    setQ2HasChildren(null);
    setFetusCountState(null);
    setFetuses([]);
    setCurrentFetusIndexState(0);
    await clearOnboardingDraft();
  }, []);

  const value = useMemo<OnboardingContextValue>(
    () => ({
      hydrating,
      q1Pregnant,
      q2HasChildren,
      fetusCount,
      fetuses,
      currentFetusIndex,
      setQ1,
      setQ2,
      setFetusCount,
      updateFetus,
      setCurrentFetusIndex,
      caseDecision,
      completeAsBC,
      completeAsA,
      resetOnboardingDraft,
    }),
    [
      hydrating,
      q1Pregnant,
      q2HasChildren,
      fetusCount,
      fetuses,
      currentFetusIndex,
      setQ1,
      setQ2,
      setFetusCount,
      updateFetus,
      setCurrentFetusIndex,
      caseDecision,
      completeAsBC,
      completeAsA,
      resetOnboardingDraft,
    ],
  );

  // hydrate 가 끝나기 전 첫 렌더에서 빈 q1 화면이 깜빡이는 것을 막는다.
  // 매우 짧은 구간이지만, 사용자 입력이 있던 디바이스에서는 selected 상태
  // 까지 함께 노출되는 게 자연스럽다.
  if (hydrating) {
    return (
      <OnboardingContext.Provider value={value}>
        {null}
      </OnboardingContext.Provider>
    );
  }

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
