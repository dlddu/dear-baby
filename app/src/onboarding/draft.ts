// OnboardingDraft is the device-local in-progress copy of the
// case-branching onboarding payload. We keep it in AsyncStorage rather
// than React state alone so that:
//
//   - the user can background the app mid-funnel and return to where
//     they left off (Q1 → A2 → A3 funnel can take >60 seconds)
//   - a hard kill / OS reclaim doesn't lose 5 minutes of typing
//   - successful submission is the only path that wipes the draft
//
// The draft is intentionally untyped at the children-array boundary —
// fields are added field-by-field as the user progresses. The funnel
// screen calling submitCaseOnboarding() is responsible for assembling
// a valid payload before posting.

import AsyncStorage from '@react-native-async-storage/async-storage';

import type {
  CaseKind,
  ChildKind,
  Gender,
  RecordPurpose,
} from '../api/onboarding';

const STORAGE_KEY = 'db_onboarding_draft_v1';

// ChildDraft mirrors api/onboarding ChildSubmission but every field is
// optional, since the user fills them in over multiple screens. The
// funnel's last step normalises this into a valid ChildSubmission.
export type ChildDraft = {
  // Tracks the per-child id used by the UI for keying repeat-input
  // lists. Not sent to the server (the server issues canonical ids on
  // commit).
  local_id: string;
  kind: ChildKind;
  display_name?: string;
  gender?: Gender;
  introduction?: string;
  birth_date?: string;
  pregnancy_weeks?: number;
  due_date?: string;
  // photo_tmp_key is set after the photo upload completes; null/undefined
  // means "no photo selected" or "still uploading".
  photo_tmp_key?: string;
  photo_local_uri?: string;
  // purposes is per-child. Case A/C show the same purpose set on the
  // last screen and copy it into every entry; Case B lets the user pick
  // per child on B6.
  purposes?: RecordPurpose[];
};

export type OnboardingDraft = {
  // Q1 / Q2 answers. These are kept around so the user can navigate back
  // and verify their pick rather than having to redo the case decision.
  q1_pregnant?: boolean;
  q2_caregiver?: boolean;
  // case is decided at the end of Q2 — once set, the funnel routes off
  // /q2 to the case-specific entry screen.
  case?: CaseKind;
  // For Case A/C, this is the count picked on A1/C1. For Case B, two
  // separate counts are tracked (caregiver_count, fetus_count) so the
  // intermediate B3 step can render a progress meter.
  caregiver_count?: number;
  fetus_count?: number;
  children: ChildDraft[];
  // last_step lets the funnel restore the user to the screen they were
  // on (Expo Router pathname). Optional — a fresh installer starts at /q1.
  last_step?: string;
};

const EMPTY_DRAFT: OnboardingDraft = { children: [] };

export async function loadDraft(): Promise<OnboardingDraft> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...EMPTY_DRAFT, children: [] };
    const parsed = JSON.parse(raw) as OnboardingDraft;
    return {
      ...EMPTY_DRAFT,
      ...parsed,
      children: Array.isArray(parsed?.children) ? parsed.children : [],
    };
  } catch {
    return { ...EMPTY_DRAFT, children: [] };
  }
}

// saveDraft merges a partial patch into the persisted draft. Returns the
// new draft so callers can use it for immediate UI updates without
// re-reading from storage.
export async function saveDraft(
  patch: Partial<OnboardingDraft>,
): Promise<OnboardingDraft> {
  const current = await loadDraft();
  const next: OnboardingDraft = {
    ...current,
    ...patch,
    children:
      patch.children !== undefined ? patch.children : current.children,
  };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

// updateChild merges a partial patch into one child entry by local_id,
// inserting it if no entry with that id exists yet.
export async function updateChild(
  localID: string,
  patch: Partial<Omit<ChildDraft, 'local_id'>>,
): Promise<OnboardingDraft> {
  const current = await loadDraft();
  const idx = current.children.findIndex((c) => c.local_id === localID);
  let nextChildren: ChildDraft[];
  if (idx === -1) {
    nextChildren = [...current.children, { local_id: localID, kind: 'child', ...patch } as ChildDraft];
  } else {
    nextChildren = current.children.map((c, i) =>
      i === idx ? { ...c, ...patch } : c,
    );
  }
  const next: OnboardingDraft = { ...current, children: nextChildren };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

// resetChildren replaces the whole children array — used when the count
// screen changes the number of child slots so old over-allocated rows
// don't linger.
export async function resetChildren(
  children: ChildDraft[],
): Promise<OnboardingDraft> {
  return saveDraft({ children });
}

export async function clearDraft(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}

// makeLocalID returns a short opaque string used for in-memory
// child identification. Not exposed to the server.
export function makeLocalID(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}
