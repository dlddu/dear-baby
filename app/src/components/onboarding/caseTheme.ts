// Case accent palette mapping. The wireframes
// (docs/wireframes/onboarding.md "케이스 시각 구분") pin one accent
// color per case so users can visually identify which branch they're
// on. The deeper "label" color is used for badge text against a tinted
// background; the soft "tint" color is the badge background.

import type { CaseKind } from '../../api/onboarding';

export type CaseAccent = {
  bar: string; // progress-bar fill
  label: string; // accent label / badge text
  tint: string; // badge background, soft
};

const ACCENTS: Record<CaseKind | 'common', CaseAccent> = {
  common: { bar: '#888780', label: '#5F5E5A', tint: '#F1EFE8' },
  A: { bar: '#D85A30', label: '#993C1D', tint: '#FBE6DC' },
  B: { bar: '#EF9F27', label: '#854F0B', tint: '#FAEEDA' },
  C: { bar: '#378ADD', label: '#0C447C', tint: '#DCE9F7' },
};

export function caseAccent(c: CaseKind | null | undefined): CaseAccent {
  if (!c) return ACCENTS.common;
  return ACCENTS[c];
}
