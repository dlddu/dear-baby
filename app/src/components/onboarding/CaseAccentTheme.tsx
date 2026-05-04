// CaseAccentTheme exposes the per-case accent palette via React context
// so deeply-nested progress bars / badges can pick up the right color
// without prop-drilling. The wireframes spec each case to its own hue
// (docs/wireframes/onboarding.md):
//
//   Case A (pregnancy only)        — coral  #D85A30
//   Case B (caregiver + pregnancy) — amber  #EF9F27
//   Case C (caregiver only)        — blue   #378ADD
//   common entry (Q1, Q2)          — neutral gray
//
// The provider only carries the accent — fonts, layout, etc. continue
// through the global theme. Keeps the case visualisation orthogonal
// from the rest of the design system.

import { createContext, useContext, type ReactNode } from 'react';

export type OnboardingCase = 'A' | 'B' | 'C' | 'common';

export const caseColors: Record<OnboardingCase, string> = {
  A: '#D85A30',
  B: '#EF9F27',
  C: '#378ADD',
  // Neutral gray for the pre-decision Q1/Q2 screens.
  common: '#8C7B6B',
};

const CaseAccentContext = createContext<OnboardingCase>('common');

export type CaseAccentThemeProps = {
  case: OnboardingCase;
  children: ReactNode;
};

export function CaseAccentTheme({ case: caseKind, children }: CaseAccentThemeProps) {
  return (
    <CaseAccentContext.Provider value={caseKind}>{children}</CaseAccentContext.Provider>
  );
}

export function useCaseAccent(): { case: OnboardingCase; color: string } {
  const c = useContext(CaseAccentContext);
  return { case: c, color: caseColors[c] };
}
