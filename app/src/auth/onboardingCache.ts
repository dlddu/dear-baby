import * as SecureStore from 'expo-secure-store';

import type {
  ChildCount,
  ChildDraft,
  FetusCount,
  FetusDraft,
} from '../onboarding/types';

// Lightweight local cache of onboarding state. This lets the app stay on the
// correct screen when /me fails on cold boot (airplane mode, backend hiccup)
// instead of dropping the user back into the onboarding funnel or re-showing
// the home coachmark. The backend remains the source of truth — this
// cache is only a graceful-fallback hint.

const ONBOARDED_AT_KEY = 'db_onboarded_at';
const FIRST_RECORD_AT_KEY = 'db_first_record_at';
// 이전 빌드에서 쓰던 `db_due_date` 키. 이미 설치된 디바이스에 남아 있을 수
// 있어 부팅 시 한 번 정리한다 (`cleanupLegacyDueDateKey`).
const LEGACY_DUE_DATE_KEY = 'db_due_date';

// Draft keys — 진행 중인 온보딩 입력의 영속화. 위의 `db_*` 키와 의미가
// 다르므로 (백엔드 응답 미러 vs. 진행 중 입력) 별도 네임스페이스를 쓴다.
const DRAFT_Q1_KEY = 'db_draft_q1_pregnant';
const DRAFT_Q2_KEY = 'db_draft_q2_has_children';
const DRAFT_FETUS_COUNT_KEY = 'db_draft_fetus_count';
const DRAFT_FETUSES_KEY = 'db_draft_fetuses';
const DRAFT_CURRENT_FETUS_INDEX_KEY = 'db_draft_current_fetus_index';
const DRAFT_CHILD_COUNT_KEY = 'db_draft_child_count';
const DRAFT_CHILDREN_KEY = 'db_draft_children';
const DRAFT_CURRENT_CHILD_INDEX_KEY = 'db_draft_current_child_index';
const DRAFT_PURPOSES_KEY = 'db_draft_purposes';

export async function getCachedOnboardedAt(): Promise<string | null> {
  return SecureStore.getItemAsync(ONBOARDED_AT_KEY);
}

export async function getCachedFirstRecordAt(): Promise<string | null> {
  return SecureStore.getItemAsync(FIRST_RECORD_AT_KEY);
}

export async function setCachedOnboarding(
  onboardedAt: string | null,
  firstRecordAt: string | null,
): Promise<void> {
  if (onboardedAt) {
    await SecureStore.setItemAsync(ONBOARDED_AT_KEY, onboardedAt);
  } else {
    await SecureStore.deleteItemAsync(ONBOARDED_AT_KEY);
  }
  if (firstRecordAt) {
    await SecureStore.setItemAsync(FIRST_RECORD_AT_KEY, firstRecordAt);
  } else {
    await SecureStore.deleteItemAsync(FIRST_RECORD_AT_KEY);
  }
}

export async function clearOnboardingCache(): Promise<void> {
  await SecureStore.deleteItemAsync(ONBOARDED_AT_KEY);
  await SecureStore.deleteItemAsync(FIRST_RECORD_AT_KEY);
}

// cleanupLegacyDueDateKey 는 이전 빌드에서 SecureStore 에 저장하던
// `db_due_date` 키를 부팅 시 한 번 지운다. 데이터는 더 이상 읽히지 않으므로
// 보안·디스크 위생 차원의 1회 cleanup 이다. 다음 메이저 정리 때 호출 자체를
// 제거할 수 있다.
export async function cleanupLegacyDueDateKey(): Promise<void> {
  await SecureStore.deleteItemAsync(LEGACY_DUE_DATE_KEY);
}

// ─────────────────────────────────────────────────────────────────────────────
// Onboarding draft (진행 중 입력) — `db_draft_*` 키 그룹.
//
// 사용자가 온보딩 도중 앱을 닫더라도 마지막 입력 지점부터 이어갈 수 있도록
// SecureStore 에 영속화한다. `completeOnboarding` 성공 시 모두 삭제된다.
// ─────────────────────────────────────────────────────────────────────────────

export type OnboardingDraft = {
  q1Pregnant: boolean | null;
  q2HasChildren: boolean | null;
  fetusCount: FetusCount | null;
  fetuses: FetusDraft[];
  currentFetusIndex: number;
  childCount: ChildCount | null;
  children: ChildDraft[];
  currentChildIndex: number;
  /**
   * A3/C3 의 기록 목적 칩 선택. 한국어 라벨 그대로 저장 — PRD-006
   * AC-006-02·04 의 단일 SoT.
   */
  purposes: string[];
};

const EMPTY_DRAFT: OnboardingDraft = {
  q1Pregnant: null,
  q2HasChildren: null,
  fetusCount: null,
  fetuses: [],
  currentFetusIndex: 0,
  childCount: null,
  children: [],
  currentChildIndex: 0,
  purposes: [],
};

function parseBool(raw: string | null): boolean | null {
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return null;
}

function parseFetusCount(raw: string | null): FetusCount | null {
  if (raw === '1' || raw === '2' || raw === '3') {
    return Number(raw) as FetusCount;
  }
  return null;
}

function parseFetuses(raw: string | null): FetusDraft[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as FetusDraft[]) : [];
  } catch {
    return [];
  }
}

function parseChildCount(raw: string | null): ChildCount | null {
  if (raw === '1' || raw === '2' || raw === '3') {
    return Number(raw) as ChildCount;
  }
  return null;
}

function parseChildren(raw: string | null): ChildDraft[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ChildDraft[]) : [];
  } catch {
    return [];
  }
}

function parsePurposes(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? (parsed.filter((v) => typeof v === 'string') as string[])
      : [];
  } catch {
    return [];
  }
}

export async function loadOnboardingDraft(): Promise<OnboardingDraft> {
  const [q1, q2, count, fetuses, idx, childCount, children, childIdx, purposes] =
    await Promise.all([
      SecureStore.getItemAsync(DRAFT_Q1_KEY),
      SecureStore.getItemAsync(DRAFT_Q2_KEY),
      SecureStore.getItemAsync(DRAFT_FETUS_COUNT_KEY),
      SecureStore.getItemAsync(DRAFT_FETUSES_KEY),
      SecureStore.getItemAsync(DRAFT_CURRENT_FETUS_INDEX_KEY),
      SecureStore.getItemAsync(DRAFT_CHILD_COUNT_KEY),
      SecureStore.getItemAsync(DRAFT_CHILDREN_KEY),
      SecureStore.getItemAsync(DRAFT_CURRENT_CHILD_INDEX_KEY),
      SecureStore.getItemAsync(DRAFT_PURPOSES_KEY),
    ]);
  const parsedIdx = idx ? Number.parseInt(idx, 10) : 0;
  const parsedChildIdx = childIdx ? Number.parseInt(childIdx, 10) : 0;
  return {
    q1Pregnant: parseBool(q1),
    q2HasChildren: parseBool(q2),
    fetusCount: parseFetusCount(count),
    fetuses: parseFetuses(fetuses),
    currentFetusIndex: Number.isFinite(parsedIdx) ? parsedIdx : 0,
    childCount: parseChildCount(childCount),
    children: parseChildren(children),
    currentChildIndex: Number.isFinite(parsedChildIdx) ? parsedChildIdx : 0,
    purposes: parsePurposes(purposes),
  };
}

export async function saveOnboardingDraft(
  partial: Partial<OnboardingDraft>,
): Promise<void> {
  const writes: Promise<void>[] = [];
  if ('q1Pregnant' in partial) {
    writes.push(
      partial.q1Pregnant === null
        ? SecureStore.deleteItemAsync(DRAFT_Q1_KEY)
        : SecureStore.setItemAsync(DRAFT_Q1_KEY, String(partial.q1Pregnant)),
    );
  }
  if ('q2HasChildren' in partial) {
    writes.push(
      partial.q2HasChildren === null
        ? SecureStore.deleteItemAsync(DRAFT_Q2_KEY)
        : SecureStore.setItemAsync(
            DRAFT_Q2_KEY,
            String(partial.q2HasChildren),
          ),
    );
  }
  if ('fetusCount' in partial) {
    writes.push(
      partial.fetusCount === null || partial.fetusCount === undefined
        ? SecureStore.deleteItemAsync(DRAFT_FETUS_COUNT_KEY)
        : SecureStore.setItemAsync(
            DRAFT_FETUS_COUNT_KEY,
            String(partial.fetusCount),
          ),
    );
  }
  if ('fetuses' in partial) {
    writes.push(
      SecureStore.setItemAsync(
        DRAFT_FETUSES_KEY,
        JSON.stringify(partial.fetuses ?? []),
      ),
    );
  }
  if ('currentFetusIndex' in partial) {
    writes.push(
      SecureStore.setItemAsync(
        DRAFT_CURRENT_FETUS_INDEX_KEY,
        String(partial.currentFetusIndex ?? 0),
      ),
    );
  }
  if ('childCount' in partial) {
    writes.push(
      partial.childCount === null || partial.childCount === undefined
        ? SecureStore.deleteItemAsync(DRAFT_CHILD_COUNT_KEY)
        : SecureStore.setItemAsync(
            DRAFT_CHILD_COUNT_KEY,
            String(partial.childCount),
          ),
    );
  }
  if ('children' in partial) {
    writes.push(
      SecureStore.setItemAsync(
        DRAFT_CHILDREN_KEY,
        JSON.stringify(partial.children ?? []),
      ),
    );
  }
  if ('currentChildIndex' in partial) {
    writes.push(
      SecureStore.setItemAsync(
        DRAFT_CURRENT_CHILD_INDEX_KEY,
        String(partial.currentChildIndex ?? 0),
      ),
    );
  }
  if ('purposes' in partial) {
    writes.push(
      SecureStore.setItemAsync(
        DRAFT_PURPOSES_KEY,
        JSON.stringify(partial.purposes ?? []),
      ),
    );
  }
  await Promise.all(writes);
}

export async function clearOnboardingDraft(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(DRAFT_Q1_KEY),
    SecureStore.deleteItemAsync(DRAFT_Q2_KEY),
    SecureStore.deleteItemAsync(DRAFT_FETUS_COUNT_KEY),
    SecureStore.deleteItemAsync(DRAFT_FETUSES_KEY),
    SecureStore.deleteItemAsync(DRAFT_CURRENT_FETUS_INDEX_KEY),
    SecureStore.deleteItemAsync(DRAFT_CHILD_COUNT_KEY),
    SecureStore.deleteItemAsync(DRAFT_CHILDREN_KEY),
    SecureStore.deleteItemAsync(DRAFT_CURRENT_CHILD_INDEX_KEY),
    SecureStore.deleteItemAsync(DRAFT_PURPOSES_KEY),
  ]);
}

export const emptyOnboardingDraft = EMPTY_DRAFT;
