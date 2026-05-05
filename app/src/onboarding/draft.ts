// Onboarding draft persistence.
//
// The case-branched onboarding (PRD-006) collects 1–3+ children's data
// across 3–7 screens. The server only sees the final submission, so to
// survive an app kill or screen-resume mid-funnel we mirror the in-flight
// state in AsyncStorage. Cleared on successful submit.
//
// Why AsyncStorage and not SecureStore: the contents are non-sensitive
// (display names, photo tmp keys), and AsyncStorage is the standard for
// "form draft" payloads. SecureStore is reserved for credentials.

import AsyncStorage from '@react-native-async-storage/async-storage';

import type {
  CaseKind,
  ChildKind,
  Gender,
  RecordPurpose,
} from '../api/onboarding';

const DRAFT_KEY = 'db_onboarding_draft';

// ChildDraft is the in-flight version of api/onboarding.ChildPayload.
// Fields are all optional because users fill them progressively across
// screens. localPhotoUri is kept alongside photoTmpKey so the picker can
// re-render the chosen image after the user navigates back; the upload
// flow swaps the local URI for the server-issued tmp key once the PUT
// succeeds.
export type ChildDraft = {
  kind: ChildKind;
  displayName?: string;
  gender?: Gender;
  introduction?: string;
  birthDate?: string;
  pregnancyWeeks?: number;
  dueDate?: string;
  photoTmpKey?: string;
  localPhotoUri?: string;
  purposes?: RecordPurpose[];
};

export type OnboardingDraft = {
  // Q1 / Q2 answers — booleans so 'no' is meaningful, undefined is
  // "not yet answered".
  q1Pregnant?: boolean;
  q2Parenting?: boolean;
  case?: CaseKind;
  // Children entered so far. For Case B the array holds parenting
  // children first (kind='child'), then fetus children (kind='fetus').
  // The same array shape is used for Case A (all fetus) and Case C
  // (all child); per-case branching of the list is a UI concern.
  children: ChildDraft[];
  // Last route the user successfully reached, in the same form
  // useRouter passes to replace() (e.g. '/(onboarding)/case-b/child').
  // Used by the gate to resume after an app kill.
  lastStep?: string;
};

const EMPTY_DRAFT: OnboardingDraft = { children: [] };

// loadDraft returns the persisted draft, or an empty one if none
// exists / parsing fails. Falling back to empty is intentional —
// corruption shouldn't trap a user; they can re-answer Q1.
export async function loadDraft(): Promise<OnboardingDraft> {
  try {
    const raw = await AsyncStorage.getItem(DRAFT_KEY);
    if (!raw) return { ...EMPTY_DRAFT };
    const parsed = JSON.parse(raw) as OnboardingDraft;
    if (!parsed || typeof parsed !== 'object') return { ...EMPTY_DRAFT };
    if (!Array.isArray(parsed.children)) parsed.children = [];
    return parsed;
  } catch {
    return { ...EMPTY_DRAFT };
  }
}

// saveDraft merges patch into the persisted draft. Children are
// replaced wholesale when the patch includes a children array — callers
// pass the whole new array (driving array operations from the call site
// keeps insert/replace/delete logic in one place).
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
  await AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(next));
  return next;
}

// updateChild patches a single child by index, creating it if missing.
// Returns the new draft for callers that want to chain.
export async function updateChild(
  index: number,
  patch: Partial<ChildDraft>,
): Promise<OnboardingDraft> {
  const current = await loadDraft();
  const children = [...current.children];
  while (children.length <= index) {
    // Default kind 'child' is overwritten by the caller's patch when
    // they know the kind; leaving a sane default avoids type errors
    // when callers update fields before kind.
    children.push({ kind: 'child' });
  }
  children[index] = { ...children[index], ...patch };
  return saveDraft({ children });
}

// setChildrenLength trims or extends the children array to length n,
// preserving existing entries where possible. New entries default to
// the supplied kind.
export async function setChildrenLength(
  n: number,
  kind: ChildKind,
): Promise<OnboardingDraft> {
  const current = await loadDraft();
  const children = current.children.slice(0, n);
  while (children.length < n) {
    children.push({ kind });
  }
  return saveDraft({ children });
}

// clearDraft wipes the draft after a successful submit. Errors are
// swallowed because the alternative — staying on the funnel after the
// server already accepted the data — would corrupt UX.
export async function clearDraft(): Promise<void> {
  try {
    await AsyncStorage.removeItem(DRAFT_KEY);
  } catch {
    // best-effort
  }
}
