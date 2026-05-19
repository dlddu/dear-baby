// ActiveChildContext — PRD-007 AC-007-01·02 의 데이터 레이어.
//
// User.fetuses[] + children[] 를 하나의 정규화된 리스트(`ActiveChild[]`)로
// 합성하고, 현재 활성 인덱스를 AsyncStorage 에 영속화한다. 헤더(HomeHeader)와
// 1인칭 카드(C 작업) 가 같은 SoT 를 공유하도록 한다.
//
// 키 정책: `active_child_index:<userId>` — 멀티 계정 환경에서 충돌하지 않도록
// 유저 ID 로 prefix 한다. 로그아웃 시 별도 cleanup 은 하지 않는다 (다음 로그인 시
// 자기 키만 hydrate 하면 되므로 stale 데이터가 보이지 않는다).
//
// Case A/B/C 완료 사용자는 정상적으로 백엔드 row 를 사용한다. 레거시
// `completeOnboarding(dueDate)` 경로의 단일-fetus 호환 분기는 0009 마이그레이션
// (`backfill_legacy_fetuses`) 이후 도달 불가가 되어 제거됨.

import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import type { ChildProfile, FetusProfile, User } from '../api/types';
import { useAuth } from '../auth/AuthContext';

export type ActiveChildKind = 'fetus' | 'child';

export type ActiveChild = {
  kind: ActiveChildKind;
  ordinal: number;
  /** record_subjects.id — 기록 작성·일기 탭 필터의 key. */
  subjectId: string;
  /** fetus 의 due_date 또는 child 의 birth_date (ISO `YYYY-MM-DD`). */
  dueOrBirthDate: string | null;
  /** 헤더·카드에서 사용하는 표시 이름 (태명/이름). 빈 값일 때 fallback 처리됨. */
  displayName: string;
  /** 프로필 이미지 URL. 현재 백엔드 미설정이라 항상 null. */
  profileImageUrl: string | null;
};

type ActiveChildContextValue = {
  /** 합성된 활성 아이 리스트. 항상 children 먼저, 그 뒤에 fetuses. 각각 ordinal 오름차순. */
  children: ActiveChild[];
  activeIndex: number;
  activeChild: ActiveChild | null;
  canNavigate: boolean;
  next: () => void;
  prev: () => void;
};

const ActiveChildContext = createContext<ActiveChildContextValue | null>(null);

const STORAGE_KEY_PREFIX = 'active_child_index:';

function storageKey(userId: string): string {
  return `${STORAGE_KEY_PREFIX}${userId}`;
}

function fetusDisplayName(f: FetusProfile): string {
  const trimmed = f.nickname?.trim() ?? '';
  if (trimmed.length > 0) return trimmed;
  return '우리 아이';
}

function childDisplayName(c: ChildProfile): string {
  const trimmed = c.name?.trim() ?? '';
  if (trimmed.length > 0) return trimmed;
  return '우리 아이';
}

// buildActiveChildren — User → ActiveChild[] 정규화.
// 순서: 양육 아이(생년월일 빠른 = ordinal 작은 순) 먼저, 그 다음 태아.
export function buildActiveChildren(user: User | null): ActiveChild[] {
  if (!user) return [];
  const children: ActiveChild[] = (user.children ?? [])
    .slice()
    .sort((a, b) => a.ordinal - b.ordinal)
    .map((c) => ({
      kind: 'child' as const,
      ordinal: c.ordinal,
      subjectId: c.subject_id,
      dueOrBirthDate: c.birth_date,
      displayName: childDisplayName(c),
      profileImageUrl: null,
    }));
  const fetuses: ActiveChild[] = (user.fetuses ?? [])
    .slice()
    .sort((a, b) => a.ordinal - b.ordinal)
    .map((f) => ({
      kind: 'fetus' as const,
      ordinal: f.ordinal,
      subjectId: f.subject_id,
      dueOrBirthDate: f.due_date,
      displayName: fetusDisplayName(f),
      profileImageUrl: null,
    }));
  return [...children, ...fetuses];
}

function clampIndex(idx: number, length: number): number {
  if (length === 0) return 0;
  if (idx < 0) return 0;
  if (idx >= length) return length - 1;
  return idx;
}

export function ActiveChildProvider({
  children: kids,
}: {
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const list = useMemo(() => buildActiveChildren(user), [user]);

  const [activeIndex, setActiveIndex] = useState(0);
  // hydratedUserId 는 "마지막으로 AsyncStorage 에서 인덱스를 가져온 user.id".
  // user 가 도착하면 한 번만 hydrate 한다 — 그 이후의 인덱스 변경은 next/prev
  // 가 처리한다.
  const [hydratedUserId, setHydratedUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setHydratedUserId(null);
      setActiveIndex(0);
      return;
    }
    if (hydratedUserId === user.id) return;
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(storageKey(user.id));
        const parsed = raw != null ? Number.parseInt(raw, 10) : NaN;
        if (cancelled) return;
        setActiveIndex(
          Number.isFinite(parsed) ? clampIndex(parsed, list.length) : 0,
        );
      } catch {
        if (!cancelled) setActiveIndex(0);
      } finally {
        if (!cancelled) setHydratedUserId(user.id);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, hydratedUserId, list.length]);

  // list 크기가 줄어들면(예: 아이 삭제) 현재 인덱스가 범위를 벗어날 수 있다.
  // hydrate 후의 변동만 클램프 — hydrate 자체는 위 effect 가 책임.
  useEffect(() => {
    setActiveIndex((prev) => clampIndex(prev, list.length));
  }, [list.length]);

  const persist = useCallback(
    (next: number) => {
      if (!user) return;
      void AsyncStorage.setItem(storageKey(user.id), String(next)).catch(
        () => {},
      );
    },
    [user],
  );

  const next = useCallback(() => {
    if (list.length <= 1) return;
    setActiveIndex((curr) => {
      const n = (curr + 1) % list.length;
      persist(n);
      return n;
    });
  }, [list.length, persist]);

  const prev = useCallback(() => {
    if (list.length <= 1) return;
    setActiveIndex((curr) => {
      const n = (curr - 1 + list.length) % list.length;
      persist(n);
      return n;
    });
  }, [list.length, persist]);

  const activeChild = list.length > 0 ? list[clampIndex(activeIndex, list.length)] : null;
  const canNavigate = list.length >= 2;

  const value = useMemo<ActiveChildContextValue>(
    () => ({
      children: list,
      activeIndex,
      activeChild,
      canNavigate,
      next,
      prev,
    }),
    [list, activeIndex, activeChild, canNavigate, next, prev],
  );

  return (
    <ActiveChildContext.Provider value={value}>
      {kids}
    </ActiveChildContext.Provider>
  );
}

export function useActiveChild(): ActiveChildContextValue {
  const ctx = useContext(ActiveChildContext);
  if (!ctx) {
    throw new Error('useActiveChild must be used inside ActiveChildProvider');
  }
  return ctx;
}
