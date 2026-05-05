// caseAccents — single source of truth for the per-case accent palette
// pulled from docs/wireframes/onboarding.md ("케이스 시각 구분"). Use
// this helper from the onboarding screens instead of hard-coding hex
// values; that way any palette tweak ripples automatically.

import { colors } from '../../theme/colors';
import type { OnboardingCase } from '../../api/types';

export type CaseAccent = {
  bar: string; // progress bar fill, primary cta accent
  text: string; // case label text ("Case A · 1/3")
  surface: string; // chip / soft surface tint
};

export const caseAccents: Record<OnboardingCase, CaseAccent> = {
  A: colors.caseAccent.a,
  B: colors.caseAccent.b,
  C: colors.caseAccent.c,
};

export const neutralAccent: CaseAccent = colors.caseAccent.neutral;

export function accentFor(c: OnboardingCase | undefined | null): CaseAccent {
  if (!c) return neutralAccent;
  return caseAccents[c];
}
