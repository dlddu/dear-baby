// submit translates the on-device OnboardingDraft into the wire-format
// CaseSubmission and forwards it to POST /onboarding/case. Validation
// (required fields per kind, etc.) lives on the server — the client
// only enforces the obvious "is the field present" before letting the
// user reach the final submit screen.

import type { CaseSubmission, ChildSubmission } from '../api/onboarding';

import type { ChildDraft, OnboardingDraft } from './draft';

export class OnboardingDraftError extends Error {
  field: string;
  constructor(field: string, message: string) {
    super(message);
    this.field = field;
    this.name = 'OnboardingDraftError';
  }
}

function requireString(value: string | undefined, field: string): string {
  if (value === undefined || value.trim() === '') {
    throw new OnboardingDraftError(field, `${field} 가 비어 있어요`);
  }
  return value.trim();
}

function requireField<T>(value: T | undefined, field: string): T {
  if (value === undefined) {
    throw new OnboardingDraftError(field, `${field} 가 비어 있어요`);
  }
  return value;
}

function buildChild(c: ChildDraft, fallbackPurposes: ChildDraft['purposes'] | undefined, idx: number): ChildSubmission {
  const gender = requireField(c.gender, `children[${idx}].gender`);
  const purposes = c.purposes && c.purposes.length > 0 ? c.purposes : fallbackPurposes;
  if (!purposes || purposes.length === 0) {
    throw new OnboardingDraftError(
      `children[${idx}].purposes`,
      `children[${idx}] 의 기록 목적이 비어 있어요`,
    );
  }
  if (c.kind === 'fetus') {
    return {
      kind: 'fetus',
      display_name: c.display_name?.trim() || undefined,
      gender,
      pregnancy_weeks: requireField(c.pregnancy_weeks, `children[${idx}].pregnancy_weeks`),
      due_date: requireString(c.due_date, `children[${idx}].due_date`),
      purposes,
    };
  }
  return {
    kind: 'child',
    display_name: requireString(c.display_name, `children[${idx}].display_name`),
    gender,
    introduction: c.introduction?.trim() || undefined,
    birth_date: requireString(c.birth_date, `children[${idx}].birth_date`),
    photo_tmp_key: c.photo_tmp_key,
    purposes,
  };
}

// buildSubmission converts a draft into the server payload. For Case A
// and C, the wireframes ask for a single shared "기록 목적" set — when
// individual children don't carry their own list, fall back to
// `sharedPurposes` so the call site doesn't have to duplicate the
// array onto each child.
export function buildSubmission(
  draft: OnboardingDraft,
  sharedPurposes?: ChildDraft['purposes'],
): CaseSubmission {
  if (!draft.case) {
    throw new OnboardingDraftError('case', '케이스가 결정되지 않았어요');
  }
  if (draft.children.length === 0) {
    throw new OnboardingDraftError('children', '아이 정보가 비어 있어요');
  }
  return {
    case: draft.case,
    children: draft.children.map((c, i) => buildChild(c, sharedPurposes, i)),
  };
}
