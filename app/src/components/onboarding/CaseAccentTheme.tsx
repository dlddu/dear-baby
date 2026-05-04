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

// Darker shade used for label/badge text per the wireframe — improves
// contrast over the cream background while staying inside the case hue.
export const caseLabelColors: Record<OnboardingCase, string> = {
  A: '#993C1D',
  B: '#854F0B',
  C: '#0C447C',
  common: '#5F5E5A',
};

// Tinted background used for soft chips (B6 active tab in the wireframe
// uses a 10% wash of the case hue).
export const caseTintColors: Record<OnboardingCase, string> = {
  A: '#FBE4DA',
  B: '#FAEEDA',
  C: '#DDEBF8',
  common: '#F1EFE8',
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

export function useCaseAccent(): {
  case: OnboardingCase;
  color: string;
  labelColor: string;
  tintColor: string;
} {
  const c = useContext(CaseAccentContext);
  return {
    case: c,
    color: caseColors[c],
    labelColor: caseLabelColors[c],
    tintColor: caseTintColors[c],
  };
}
