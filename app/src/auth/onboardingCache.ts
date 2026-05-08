import * as SecureStore from 'expo-secure-store';

import type { FetusCount, FetusDraft } from '../onboarding/types';

// Lightweight local cache of onboarding state. This lets the app stay on the
// correct screen when /me fails on cold boot (airplane mode, backend hiccup)
// instead of dropping the user back into the onboarding funnel or re-showing
// the home coachmark. The backend remains the source of truth — this
// cache is only a graceful-fallback hint.

const ONBOARDED_AT_KEY = 'db_onboarded_at';
const DUE_DATE_KEY = 'db_due_date';
const VOICE_COACHMARK_DISMISSED_AT_KEY = 'db_voice_coachmark_dismissed_at';
const FIRST_RECORD_AT_KEY = 'db_first_record_at';
const AI_PREVIEW_KEY = 'db_ai_preview';

// Draft keys — 진행 중인 온보딩 입력의 영속화. 위의 `db_*` 키와 의미가
// 다르므로 (백엔드 응답 미러 vs. 진행 중 입력) 별도 네임스페이스를 쓴다.
const DRAFT_Q1_KEY = 'db_draft_q1_pregnant';
const DRAFT_Q2_KEY = 'db_draft_q2_has_children';
const DRAFT_FETUS_COUNT_KEY = 'db_draft_fetus_count';
const DRAFT_FETUSES_KEY = 'db_draft_fetuses';
const DRAFT_CURRENT_FETUS_INDEX_KEY = 'db_draft_current_fetus_index';

export async function getCachedOnboardedAt(): Promise<string | null> {
  return SecureStore.getItemAsync(ONBOARDED_AT_KEY);
}

export async function getCachedDueDate(): Promise<string | null> {
  return SecureStore.getItemAsync(DUE_DATE_KEY);
}

export async function getCachedVoiceCoachmarkDismissedAt(): Promise<string | null> {
  return SecureStore.getItemAsync(VOICE_COACHMARK_DISMISSED_AT_KEY);
}

export async function getCachedFirstRecordAt(): Promise<string | null> {
  return SecureStore.getItemAsync(FIRST_RECORD_AT_KEY);
}

export async function getCachedAiPreview(): Promise<string | null> {
  return SecureStore.getItemAsync(AI_PREVIEW_KEY);
}

export async function setCachedOnboarding(
  onboardedAt: string | null,
  dueDate: string | null,
  voiceCoachmarkDismissedAt: string | null,
  firstRecordAt: string | null,
  aiPreview: string | null,
): Promise<void> {
  if (onboardedAt) {
    await SecureStore.setItemAsync(ONBOARDED_AT_KEY, onboardedAt);
  } else {
    await SecureStore.deleteItemAsync(ONBOARDED_AT_KEY);
  }
  if (dueDate) {
    await SecureStore.setItemAsync(DUE_DATE_KEY, dueDate);
  } else {
    await SecureStore.deleteItemAsync(DUE_DATE_KEY);
  }
  if (voiceCoachmarkDismissedAt) {
    await SecureStore.setItemAsync(
      VOICE_COACHMARK_DISMISSED_AT_KEY,
      voiceCoachmarkDismissedAt,
    );
  } else {
    await SecureStore.deleteItemAsync(VOICE_COACHMARK_DISMISSED_AT_KEY);
  }
  if (firstRecordAt) {
    await SecureStore.setItemAsync(FIRST_RECORD_AT_KEY, firstRecordAt);
  } else {
    await SecureStore.deleteItemAsync(FIRST_RECORD_AT_KEY);
  }
  if (aiPreview) {
    await SecureStore.setItemAsync(AI_PREVIEW_KEY, aiPreview);
  } else {
    await SecureStore.deleteItemAsync(AI_PREVIEW_KEY);
  }
}

export async function clearOnboardingCache(): Promise<void> {
  await SecureStore.deleteItemAsync(ONBOARDED_AT_KEY);
  await SecureStore.deleteItemAsync(DUE_DATE_KEY);
  await SecureStore.deleteItemAsync(VOICE_COACHMARK_DISMISSED_AT_KEY);
  await SecureStore.deleteItemAsync(FIRST_RECORD_AT_KEY);
  await SecureStore.deleteItemAsync(AI_PREVIEW_KEY);
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
};

const EMPTY_DRAFT: OnboardingDraft = {
  q1Pregnant: null,
  q2HasChildren: null,
  fetusCount: null,
  fetuses: [],
  currentFetusIndex: 0,
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

export async function loadOnboardingDraft(): Promise<OnboardingDraft> {
  const [q1, q2, count, fetuses, idx] = await Promise.all([
    SecureStore.getItemAsync(DRAFT_Q1_KEY),
    SecureStore.getItemAsync(DRAFT_Q2_KEY),
    SecureStore.getItemAsync(DRAFT_FETUS_COUNT_KEY),
    SecureStore.getItemAsync(DRAFT_FETUSES_KEY),
    SecureStore.getItemAsync(DRAFT_CURRENT_FETUS_INDEX_KEY),
  ]);
  const parsedIdx = idx ? Number.parseInt(idx, 10) : 0;
  return {
    q1Pregnant: parseBool(q1),
    q2HasChildren: parseBool(q2),
    fetusCount: parseFetusCount(count),
    fetuses: parseFetuses(fetuses),
    currentFetusIndex: Number.isFinite(parsedIdx) ? parsedIdx : 0,
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
  await Promise.all(writes);
}

export async function clearOnboardingDraft(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(DRAFT_Q1_KEY),
    SecureStore.deleteItemAsync(DRAFT_Q2_KEY),
    SecureStore.deleteItemAsync(DRAFT_FETUS_COUNT_KEY),
    SecureStore.deleteItemAsync(DRAFT_FETUSES_KEY),
    SecureStore.deleteItemAsync(DRAFT_CURRENT_FETUS_INDEX_KEY),
  ]);
}

export const emptyOnboardingDraft = EMPTY_DRAFT;
