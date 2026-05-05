// Persistent draft for the case-branching onboarding (PRD-006). The
// server treats `case_kind + onboarded_at` as the only completion
// flags ([O5] in the implementation plan); the client owns the
// per-step input buffer until the final submit. Persisting in
// AsyncStorage keeps the funnel resumable across app kills, force
// quits, and a/c restarts.
//
// Data structure note: a single `children` array generalises Case A
// (fetus-only), Case B (fetus + child mixed) and Case C (child-only).
// Screen-specific state (counts, current repeat index, last route) sits
// at the top level so screens don't reach into the array to track
// progress.

import AsyncStorage from '@react-native-async-storage/async-storage';

import type {
  ChildGender,
  ChildKind,
  ChildPhotoFormat,
  OnboardingCase,
  RecordPurpose,
} from '../api/onboarding';

const STORAGE_KEY = 'db_onboarding_draft_v1';

// ChildDraft is the per-child entry the user is filling in. The same
// shape covers fetus + child kinds; required fields per kind are
// validated only at submission time, since intermediate states are
// inevitably partial.
export type ChildDraft = {
  kind: ChildKind;
  // optional / shared
  display_name?: string;
  gender?: ChildGender;
  introduction?: string;
  // child-only
  birth_date?: string; // YYYY-MM-DD
  // fetus-only
  pregnancy_weeks?: number;
  due_date?: string; // YYYY-MM-DD
  // photo (양육 only in this PRD; tmp key returned by upload-url)
  photo_tmp_key?: string;
  photo_format?: ChildPhotoFormat;
  photo_local_uri?: string; // for re-display while still in funnel
  // per-child purposes; filled at the last step (A3 / B6 / C3)
  purposes?: RecordPurpose[];
};

export type OnboardingDraft = {
  // Q1/Q2 answers, used to derive `case`. Stored as booleans so the
  // route guards can re-derive even when `case` is the source of
  // truth — useful while debugging.
  q1_pregnant?: boolean;
  q2_parenting?: boolean;
  case?: OnboardingCase;
  // Counts captured by the count screens before children are
  // expanded. Preserved so users returning mid-funnel can re-enter
  // the same loop.
  child_count?: number; // Case B/C 양육 아이 수
  fetus_count?: number; // Case A/B 임신 아이 수 (1=단태, 2+=다태)
  // Children buffer. Order matters — index 0 is "첫째" (양육) or
  // "단태/다태 N번째" (임신). Mixed types in Case B follow the
  // wireframe order (양육 first → 임신 next).
  children: ChildDraft[];
  // Path of the last route the user landed on, used to resume.
  last_step?: string;
  updated_at?: string;
};

const EMPTY: OnboardingDraft = { children: [] };

export async function loadDraft(): Promise<OnboardingDraft> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...EMPTY };
    const parsed = JSON.parse(raw) as OnboardingDraft;
    // Defensive — old shapes without `children` should still load.
    return { ...EMPTY, ...parsed, children: parsed.children ?? [] };
  } catch {
    return { ...EMPTY };
  }
}

// saveDraft applies a shallow patch and persists. Children arrays are
// replaced wholesale when present in the patch — callers are expected
// to splice/push and pass the new array.
export async function saveDraft(
  patch: Partial<OnboardingDraft>,
): Promise<OnboardingDraft> {
  const current = await loadDraft();
  const next: OnboardingDraft = {
    ...current,
    ...patch,
    updated_at: new Date().toISOString(),
  };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export async function clearDraft(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}

// upsertChild replaces (or appends) a child at the given index. Used
// by the repeat-input screens (B2 / B5 / C2) so each iteration writes
// just its own slot.
export async function upsertChild(
  index: number,
  patch: Partial<ChildDraft> & { kind: ChildKind },
): Promise<OnboardingDraft> {
  const current = await loadDraft();
  const children = [...current.children];
  const existing = children[index] ?? { kind: patch.kind };
  children[index] = { ...existing, ...patch };
  return saveDraft({ children });
}

// resizeChildren grows/shrinks the children array to the requested
// length while preserving existing entries. New slots are
// pre-populated with the supplied kind so subsequent screens can read
// `children[i].kind` without a null check.
export async function resizeChildren(
  startIndex: number,
  count: number,
  kind: ChildKind,
): Promise<OnboardingDraft> {
  const current = await loadDraft();
  const before = current.children.slice(0, startIndex);
  const middle = current.children.slice(startIndex, startIndex + count);
  while (middle.length < count) {
    middle.push({ kind });
  }
  const after = current.children.slice(startIndex + count);
  return saveDraft({ children: [...before, ...middle, ...after] });
}
