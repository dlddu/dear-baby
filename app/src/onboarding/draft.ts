// On-device draft store for the case-branching onboarding funnel
// (PRD-006 AC-006-01~04). The funnel is multi-step (up to 7 screens
// for Case B), so each user transition writes back the partial state
// here. If the app is force-killed mid-funnel, the next launch resumes
// at `lastStep`.
//
// The draft is intentionally local-only ([O5] in the implementation
// plan): the server only learns about the user's choices when the
// final POST /onboarding/case lands. Until then, `clearDraft()` from
// the success path is the only thing that wipes the store.

import AsyncStorage from '@react-native-async-storage/async-storage';

import type {
  CaseKind,
  ChildKind,
  Gender,
  RecordPurpose,
} from '../api/onboarding';

const DRAFT_KEY = 'db_onboarding_draft_v1';

// ChildDraft is the per-child entry the user is filling out. All fields
// are optional during input — validation only happens at submit time.
export type ChildDraft = {
  /** Stable client-side id so reorder + edit operations are idempotent. */
  draft_id: string;
  kind: ChildKind;
  display_name?: string;
  gender?: Gender;
  introduction?: string;
  /** S3 tmp key after a successful photo upload. Empty until the user picks one. */
  photo_tmp_key?: string;
  /** Local file uri (file://) — kept for re-render even before the upload completes. */
  photo_local_uri?: string;
  birth_date?: string; // YYYY-MM-DD
  pregnancy_weeks?: number;
  due_date?: string; // YYYY-MM-DD
  purposes?: RecordPurpose[];
};

export type OnboardingDraft = {
  /** True/false flags from the two independent checks (Q1, Q2). */
  q1_pregnant?: boolean;
  q2_caregiver?: boolean;
  /** Resolved case after the two checks. */
  case?: CaseKind;
  /** Children captured so far. Order matches input sequence. */
  children: ChildDraft[];
  /** Last route the user was on, e.g. "/case-b/child". Used on resume. */
  last_step?: string;
  /** Last write time — handy for debugging stale state. */
  updated_at: string;
};

const EMPTY: OnboardingDraft = { children: [], updated_at: '' };

export async function loadDraft(): Promise<OnboardingDraft> {
  try {
    const raw = await AsyncStorage.getItem(DRAFT_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<OnboardingDraft>;
    return {
      children: parsed.children ?? [],
      updated_at: parsed.updated_at ?? '',
      q1_pregnant: parsed.q1_pregnant,
      q2_caregiver: parsed.q2_caregiver,
      case: parsed.case,
      last_step: parsed.last_step,
    };
  } catch {
    return EMPTY;
  }
}

// saveDraft merges the patch into the current draft. Children are
// replaced verbatim when the patch carries a `children` array — that
// matches how the screens build out the list (the screen owns the
// canonical view).
export async function saveDraft(
  patch: Partial<OnboardingDraft>,
): Promise<OnboardingDraft> {
  const current = await loadDraft();
  const next: OnboardingDraft = {
    ...current,
    ...patch,
    children: patch.children ?? current.children,
    updated_at: new Date().toISOString(),
  };
  await AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(next));
  return next;
}

export async function clearDraft(): Promise<void> {
  await AsyncStorage.removeItem(DRAFT_KEY);
}

// resolveCase translates the two booleans into a CaseKind. The
// undefined → undefined branch covers the "still answering" case so
// callers can treat it uniformly.
//
// Per AC-006-01: when both answers are 'no' (no pregnancy, no children)
// the user is asked for a sympathetic carry-over copy and routed into
// Case A — there is no "Case D".
export function resolveCase(q1: boolean, q2: boolean): CaseKind {
  if (q1 && !q2) return 'A';
  if (q1 && q2) return 'B';
  if (!q1 && q2) return 'C';
  return 'A';
}

// genDraftId generates a stable identifier for a ChildDraft. Avoids
// importing 'uuid' (a heavier dependency) — random + timestamp is
// plenty for client-side identifiers.
export function genDraftId(): string {
  return `d_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`;
}
