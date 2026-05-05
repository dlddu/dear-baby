// Coalesces an OnboardingDraft into the CaseOnboardingPayload shape
// the server accepts. Returns null if the draft isn't far enough along
// to submit — callers should never reach this point but guarding here
// keeps the contract explicit.

import type {
  CaseOnboardingPayload,
  ChildPayload,
  Gender,
  RecordPurpose,
} from '../api/onboarding';
import type { ChildDraft, OnboardingDraft } from './draft';

export function buildCasePayload(
  draft: OnboardingDraft,
): CaseOnboardingPayload | null {
  if (!draft.case || draft.children.length === 0) return null;
  const children: ChildPayload[] = [];
  for (const c of draft.children) {
    const built = buildChild(c);
    if (!built) return null;
    children.push(built);
  }
  return { case: draft.case, children };
}

function buildChild(c: ChildDraft): ChildPayload | null {
  if (!c.gender || !c.purposes || c.purposes.length === 0) return null;
  if (c.kind === 'fetus') {
    if (c.pregnancyWeeks === undefined || !c.dueDate) return null;
    const out: ChildPayload = {
      kind: 'fetus',
      gender: c.gender as Gender,
      pregnancy_weeks: c.pregnancyWeeks,
      due_date: c.dueDate,
      purposes: c.purposes as RecordPurpose[],
    };
    if (c.displayName) out.display_name = c.displayName;
    if (c.photoTmpKey) out.photo_tmp_key = c.photoTmpKey;
    return out;
  }
  // kind === 'child'
  if (!c.displayName || !c.birthDate) return null;
  const out: ChildPayload = {
    kind: 'child',
    display_name: c.displayName,
    gender: c.gender as Gender,
    birth_date: c.birthDate,
    purposes: c.purposes as RecordPurpose[],
  };
  if (c.introduction) out.introduction = c.introduction;
  if (c.photoTmpKey) out.photo_tmp_key = c.photoTmpKey;
  return out;
}
