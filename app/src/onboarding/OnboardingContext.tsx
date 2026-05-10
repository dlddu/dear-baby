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

import {
  CASE_A_PURPOSES,
  CASE_C_PURPOSES,
  type ChildCount,
  type ChildDraft,
  type FetusCount,
  type FetusDraft,
} from './types';

function toggleLabel(prev: string[], label: string): string[] {
  return prev.includes(label) ? prev.filter((p) => p !== label) : [...prev, label];
}

function defaultPurposesForCase(c: OnboardingCase | null): string[] {
  if (c === 'C') {
    return CASE_C_PURPOSES.filter((p) => p.defaultSelected).map((p) => p.label);
  }
  // Case A 가 기본값 — fallback-A 와 아직 결정되지 않은 시점도 Case A 기본을
  // 보여 주는 게 자연스럽다. Case B 는 단일 슬롯을 쓰지 않고 child·fetus 별
  // 슬롯에 따로 채우므로 여기서는 다루지 않는다.
  return CASE_A_PURPOSES.filter((p) => p.defaultSelected).map((p) => p.label);
}

/** Case B 양육 아이의 기본 칩 — C 와 동일한 8 종 (양육 톤). */
export function defaultChildPurposes(): string[] {
  return CASE_C_PURPOSES.filter((p) => p.defaultSelected).map((p) => p.label);
}

/** Case B 태아의 기본 칩 — A 와 동일한 8 종 (임신 톤). */
export function defaultFetusPurposes(): string[] {
  return CASE_A_PURPOSES.filter((p) => p.defaultSelected).map((p) => p.label);
}

export type OnboardingCase = 'A' | 'B' | 'C' | 'fallback-A';

type OnboardingContextValue = {
  /** SecureStore hydrate 진행 중. true 동안 화면을 가리거나 스플래시로 대체. */
  hydrating: boolean;
  q1Pregnant: boolean | null;
  q2HasChildren: boolean | null;
  fetusCount: FetusCount | null;
  fetuses: FetusDraft[];
  currentFetusIndex: number;
  childCount: ChildCount | null;
  children: ChildDraft[];
  currentChildIndex: number;
  /** A3/C3 기록 목적 칩 선택. 한국어 라벨 그대로 (PRD-006 AC-006-02·04 SoT). */
  purposes: string[];
  setQ1: (value: boolean) => void;
  setQ2: (value: boolean) => void;
  setFetusCount: (value: FetusCount) => void;
  updateFetus: (index: number, patch: Partial<FetusDraft>) => void;
  setCurrentFetusIndex: (index: number) => void;
  setChildCount: (value: ChildCount) => void;
  updateChild: (index: number, patch: Partial<ChildDraft>) => void;
  setCurrentChildIndex: (index: number) => void;
  /** A3/C3 칩 토글. 다중 선택 가능. */
  togglePurpose: (label: string) => void;
  /**
   * Case B B2-purpose 칩 토글 — 지정한 양육 아이 슬롯의 purposes 만 갱신.
   * 슬롯이 비어 있으면 양육 톤의 기본 칩으로 초기화 후 토글한다.
   */
  togglePurposeForChild: (index: number, label: string) => void;
  /**
   * Case B B6 칩 토글 — 지정한 태아 슬롯의 purposes 만 갱신.
   * 슬롯이 비어 있으면 임신 톤의 기본 칩으로 초기화 후 토글한다.
   */
  togglePurposeForFetus: (index: number, label: string) => void;
  /** 현재 답변 조합으로 결정된 Case. 둘 다 입력되지 않았으면 null. */
  caseDecision: () => OnboardingCase | null;
  /** Case B/C 결말에서 "홈으로 시작하기" 처리 — onboarded_at 만 스탬프, due_date 는 null. */
  completeAsBC: () => Promise<void>;
  /**
   * Case A 결말 — 모든 태아 행(각 행에 동일 purposes 복제)과 첫 태아의 dueDate 를
   * 백엔드에 영속화하고 onboarded_at 을 스탬프한다.
   */
  completeAsA: () => Promise<void>;
  /**
   * Case B 결말 — 양육 아이는 B2-purpose 에서 1:1 로 채운 child.purposes 를,
   * 태아는 B6 에서 일괄 채운 fetus.purposes 를 그대로 영속화한다. 첫 태아의
   * dueDate 가 onboarding.due_date 로도 복사된다.
   */
  completeAsB: () => Promise<void>;
  /**
   * Case C 결말 — 모든 양육 아이 행(각 행에 동일 purposes 복제)을 백엔드에
   * 영속화하고 due_date 는 null 로, onboarded_at 만 스탬프한다.
   */
  completeAsC: () => Promise<void>;
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

export function OnboardingProvider({
  children: reactChildren,
}: {
  children: ReactNode;
}) {
  const {
    completeOnboarding,
    completeOnboardingCaseA,
    completeOnboardingCaseB,
    completeOnboardingCaseC,
  } = useAuth();
  const [hydrating, setHydrating] = useState(true);
  const [q1Pregnant, setQ1Pregnant] = useState<boolean | null>(null);
  const [q2HasChildren, setQ2HasChildren] = useState<boolean | null>(null);
  const [fetusCount, setFetusCountState] = useState<FetusCount | null>(null);
  const [fetuses, setFetuses] = useState<FetusDraft[]>([]);
  const [currentFetusIndex, setCurrentFetusIndexState] = useState(0);
  const [childCount, setChildCountState] = useState<ChildCount | null>(null);
  const [children, setChildren] = useState<ChildDraft[]>([]);
  const [currentChildIndex, setCurrentChildIndexState] = useState(0);
  const [purposes, setPurposes] = useState<string[]>([]);

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
        setChildCountState(draft.childCount);
        setChildren(draft.children);
        setCurrentChildIndexState(draft.currentChildIndex);
        // 진행 중 입력에 purposes 가 비어 있으면(=A3/C3 도달 전) 화면 진입 시
        // 기본 칩 두 개를 미리 채워둔다. 사용자가 명시적으로 모두 해제했더라도
        // 다시 진입할 때 기본값이 부활하지 않도록, 이미 한 번이라도 저장된
        // 배열은 그대로 사용한다.
        if (draft.purposes.length === 0) {
          setPurposes(defaultPurposesForCase(decide(draft.q1Pregnant, draft.q2HasChildren)));
        } else {
          setPurposes(draft.purposes);
        }
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

  const setChildCount = useCallback((value: ChildCount) => {
    setChildCountState(value);
    // 카운트가 바뀌면 children 배열의 길이를 맞춰주고 인덱스도 0 으로 초기화.
    setChildren((prev) => {
      const next = prev.slice(0, value);
      while (next.length < value) next.push({});
      void saveOnboardingDraft({
        childCount: value,
        children: next,
        currentChildIndex: 0,
      });
      return next;
    });
    setCurrentChildIndexState(0);
  }, []);

  const updateChild = useCallback(
    (index: number, patch: Partial<ChildDraft>) => {
      setChildren((prev) => {
        const next = prev.slice();
        // 슬롯이 아직 없을 수도 있으니 채워준다.
        while (next.length <= index) next.push({});
        next[index] = { ...next[index], ...patch };
        void saveOnboardingDraft({ children: next });
        return next;
      });
    },
    [],
  );

  const setCurrentChildIndex = useCallback((index: number) => {
    setCurrentChildIndexState(index);
    void saveOnboardingDraft({ currentChildIndex: index });
  }, []);

  const togglePurpose = useCallback((label: string) => {
    setPurposes((prev) => {
      const has = prev.includes(label);
      const next = has ? prev.filter((p) => p !== label) : [...prev, label];
      void saveOnboardingDraft({ purposes: next });
      return next;
    });
  }, []);

  const togglePurposeForChild = useCallback(
    (index: number, label: string) => {
      setChildren((prev) => {
        const next = prev.slice();
        while (next.length <= index) next.push({});
        const current = next[index].purposes ?? defaultChildPurposes();
        next[index] = { ...next[index], purposes: toggleLabel(current, label) };
        void saveOnboardingDraft({ children: next });
        return next;
      });
    },
    [],
  );

  const togglePurposeForFetus = useCallback(
    (index: number, label: string) => {
      setFetuses((prev) => {
        const next = prev.slice();
        while (next.length <= index) next.push({});
        const current = next[index].purposes ?? defaultFetusPurposes();
        next[index] = { ...next[index], purposes: toggleLabel(current, label) };
        void saveOnboardingDraft({ fetuses: next });
        return next;
      });
    },
    [],
  );

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
    // 다태에서도 1회만 묻는 UX 이므로 같은 purposes 를 모든 태아 행에 복제한다.
    // 백엔드는 받은 그대로 저장 — 복제 책임은 클라이언트 측.
    const total = fetusCount ?? Math.max(fetuses.length, 1);
    const slots: FetusDraft[] = [];
    for (let i = 0; i < total; i += 1) {
      slots.push(fetuses[i] ?? {});
    }
    await completeOnboardingCaseA({
      due_date: firstDueDate,
      fetuses: slots.map((f) => ({
        nickname: f.nickname ?? null,
        gender: f.gender ?? null,
        pregnancy_week: f.pregnancyWeek ?? null,
        due_date: f.dueDate ?? null,
        purposes,
      })),
    });
    await clearOnboardingDraft();
  }, [completeOnboardingCaseA, fetusCount, fetuses, purposes]);

  const completeAsC = useCallback(async () => {
    const total = childCount ?? Math.max(children.length, 1);
    const slots: ChildDraft[] = [];
    for (let i = 0; i < total; i += 1) {
      slots.push(children[i] ?? {});
    }
    await completeOnboardingCaseC({
      children: slots.map((c) => ({
        name: c.name ?? null,
        gender: c.gender ?? null,
        birth_date: c.birthDate ?? null,
        bio: c.bio ?? null,
        purposes,
      })),
    });
    await clearOnboardingDraft();
  }, [completeOnboardingCaseC, childCount, children, purposes]);

  const completeAsB = useCallback(async () => {
    // 양육 아이는 b2-purpose 에서 1:1 로 채운 child.purposes 를, 태아는 b6 에서
    // 일괄 채운 fetus.purposes 를 그대로 사용한다 — Case A·C 처럼 단일 슬롯을
    // 복제하지 않는다. 빈 슬롯에는 케이스별 기본 칩을 채워 보낸다.
    const childTotal = childCount ?? Math.max(children.length, 1);
    const childSlots: ChildDraft[] = [];
    for (let i = 0; i < childTotal; i += 1) {
      childSlots.push(children[i] ?? {});
    }
    const fetusTotal = fetusCount ?? Math.max(fetuses.length, 1);
    const fetusSlots: FetusDraft[] = [];
    for (let i = 0; i < fetusTotal; i += 1) {
      fetusSlots.push(fetuses[i] ?? {});
    }
    const firstDueDate = fetusSlots[0]?.dueDate ?? null;
    await completeOnboardingCaseB({
      due_date: firstDueDate,
      children: childSlots.map((c) => ({
        name: c.name ?? null,
        gender: c.gender ?? null,
        birth_date: c.birthDate ?? null,
        bio: c.bio ?? null,
        purposes: c.purposes ?? defaultChildPurposes(),
      })),
      fetuses: fetusSlots.map((f) => ({
        nickname: f.nickname ?? null,
        gender: f.gender ?? null,
        pregnancy_week: f.pregnancyWeek ?? null,
        due_date: f.dueDate ?? null,
        purposes: f.purposes ?? defaultFetusPurposes(),
      })),
    });
    await clearOnboardingDraft();
  }, [completeOnboardingCaseB, childCount, children, fetusCount, fetuses]);

  const resetOnboardingDraft = useCallback(async () => {
    setQ1Pregnant(null);
    setQ2HasChildren(null);
    setFetusCountState(null);
    setFetuses([]);
    setCurrentFetusIndexState(0);
    setChildCountState(null);
    setChildren([]);
    setCurrentChildIndexState(0);
    setPurposes([]);
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
      childCount,
      children,
      currentChildIndex,
      purposes,
      setQ1,
      setQ2,
      setFetusCount,
      updateFetus,
      setCurrentFetusIndex,
      setChildCount,
      updateChild,
      setCurrentChildIndex,
      togglePurpose,
      togglePurposeForChild,
      togglePurposeForFetus,
      caseDecision,
      completeAsBC,
      completeAsA,
      completeAsB,
      completeAsC,
      resetOnboardingDraft,
    }),
    [
      hydrating,
      q1Pregnant,
      q2HasChildren,
      fetusCount,
      fetuses,
      currentFetusIndex,
      childCount,
      children,
      currentChildIndex,
      purposes,
      setQ1,
      setQ2,
      setFetusCount,
      updateFetus,
      setCurrentFetusIndex,
      setChildCount,
      updateChild,
      setCurrentChildIndex,
      togglePurpose,
      togglePurposeForChild,
      togglePurposeForFetus,
      caseDecision,
      completeAsBC,
      completeAsA,
      completeAsB,
      completeAsC,
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
      {reactChildren}
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
