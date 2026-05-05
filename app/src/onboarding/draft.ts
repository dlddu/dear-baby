// Onboarding draft — case-branching funnel progress kept on the device.
//
// The server stamps `onboarded_at` exactly once when the user finishes
// the funnel. Everything else (the case decision, the per-child input
// they've filled in so far, which screen they were last on) lives here
// so a mid-funnel app kill resumes from the right step rather than
// starting over.
//
// AsyncStorage is the right home: small, synchronous-ish access, never
// transmitted over the wire, and isolated per device — exactly the
// constraints docs/prd/PRD-006 calls for in [O5].
//
// The shape generalizes child input across kinds — both fetus and
// post-birth child rows live in one ChildDraft union. Case A/C are
// natural subsets (only fetuses or only children) and Case B's mixed
// input drops in without a separate schema.

import AsyncStorage from '@react-native-async-storage/async-storage';

import type {
  ChildGender,
  ChildKind,
  OnboardingCase,
  RecordPurpose,
} from '../api/types';

const STORAGE_KEY = 'db_onboarding_draft_v1';

export type ChildDraft = {
  // Internal id used to address this draft slot inside the screens'
  // repeat loops (B2/B5 reuse the same draft when the user goes back).
  // Not the server-side child id.
  draft_id: string;
  kind: ChildKind;
  display_name?: string;
  gender?: ChildGender;
  introduction?: string;
  birth_date?: string;
  pregnancy_weeks?: number;
  due_date?: string;
  photo_tmp_key?: string;
  // Local file URI of the picked photo. Kept so the user can preview
  // the chosen image before submission and so a failed upload can be
  // retried without re-picking.
  photo_local_uri?: string;
  // Per-child purposes. A/C copy the same array onto every child;
  // B6 stamps each child individually.
  purposes?: RecordPurpose[];
};

export type OnboardingDraft = {
  // Q1/Q2 raw answers. Both retained so we can show "you said X earlier"
  // when the user backs up to revisit.
  q1?: boolean; // pregnant?
  q2?: boolean; // parenting?
  // Derived from (q1, q2). Once the user advances past Q2 this is
  // pinned and the case-specific screens consume it.
  case?: OnboardingCase;
  // Active step id — used by the layout's first-render redirect when
  // the user re-enters the funnel after a crash.
  last_step?: string;
  // Submission accumulator. Always ordered: caregiver children first
  // for Case B (matches the wireframe order B1→B2 then B4→B5).
  children: ChildDraft[];
};

export const EMPTY_DRAFT: OnboardingDraft = { children: [] };

export async function loadDraft(): Promise<OnboardingDraft> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return { ...EMPTY_DRAFT };
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && Array.isArray(parsed.children)) {
      return parsed as OnboardingDraft;
    }
  } catch {
    // fall through
  }
  return { ...EMPTY_DRAFT };
}

export async function saveDraft(
  patch: (draft: OnboardingDraft) => OnboardingDraft,
): Promise<OnboardingDraft> {
  const current = await loadDraft();
  const next = patch({ ...current, children: [...current.children] });
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export async function clearDraft(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}

// determineCase picks the case bucket from the two yes/no answers. The
// (no, no) corner steers to A — the PRD asks us to be welcoming there
// rather than blocking the user with "we built this for someone else".
export function determineCase(q1: boolean, q2: boolean): OnboardingCase {
  if (q1 && q2) return 'B';
  if (q1 && !q2) return 'A';
  if (!q1 && q2) return 'C';
  return 'A';
}

// makeDraftID returns a small unique-per-session identifier for slots
// inside the children array. Crypto-grade randomness isn't needed —
// this never escapes the device.
export function makeDraftID(): string {
  return `draft-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// resizeFetusChildren / resizeChildren keep the children array in sync
// with the count screen (A1 / B1 / B4 / C1). On count change we keep
// existing entries (preserving any data the user filled in) and add or
// drop slots from the tail.
export function resizeKind(
  draft: OnboardingDraft,
  kind: ChildKind,
  count: number,
): OnboardingDraft {
  const same = draft.children.filter((c) => c.kind === kind);
  const other = draft.children.filter((c) => c.kind !== kind);
  let next = same.slice(0, count);
  while (next.length < count) {
    next.push({ draft_id: makeDraftID(), kind });
  }
  // Maintain wireframe order: caregiver children first, then fetus.
  const before: ChildDraft[] = [];
  const after: ChildDraft[] = [];
  for (const c of other) {
    if (kind === 'child' && c.kind === 'fetus') after.push(c);
    else if (kind === 'fetus' && c.kind === 'child') before.push(c);
    else after.push(c);
  }
  return { ...draft, children: [...before, ...next, ...after] };
}

export function updateChild(
  draft: OnboardingDraft,
  draftID: string,
  patch: Partial<ChildDraft>,
): OnboardingDraft {
  return {
    ...draft,
    children: draft.children.map((c) =>
      c.draft_id === draftID ? { ...c, ...patch } : c,
    ),
  };
}

// applyPurposesToAll is the helper A3 / C3 use — they collect a single
// purpose set and copy it onto every child. B6 sets purposes per child
// so it doesn't go through this helper.
export function applyPurposesToAll(
  draft: OnboardingDraft,
  purposes: RecordPurpose[],
): OnboardingDraft {
  return {
    ...draft,
    children: draft.children.map((c) => ({ ...c, purposes: [...purposes] })),
  };
}
