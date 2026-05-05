// CaseAccentTheme exposes the case-specific accent palette (coral / amber /
// blue) via React context so descendant onboarding screens can render
// the progress bar, "Case X · n/N" badge text, and lightly-tinted card
// backgrounds without re-deriving the case at every level.
//
// Tokens come from `theme/colors.ts` `caseAccent` — any palette change
// belongs there, not here.

import { createContext, type ReactNode, useContext, useMemo } from 'react';

import type { CaseKind } from '../../api/onboarding';
import { colors } from '../../theme/colors';

export type CaseAccent = (typeof colors.caseAccent)[keyof typeof colors.caseAccent];

const CaseAccentContext = createContext<CaseAccent | null>(null);

export function CaseAccentTheme({
  case: caseKind,
  children,
}: {
  case: CaseKind;
  children: ReactNode;
}) {
  const palette = useMemo<CaseAccent>(() => {
    switch (caseKind) {
      case 'A':
        return colors.caseAccent.a;
      case 'B':
        return colors.caseAccent.b;
      case 'C':
        return colors.caseAccent.c;
    }
  }, [caseKind]);
  return (
    <CaseAccentContext.Provider value={palette}>
      {children}
    </CaseAccentContext.Provider>
  );
}

// useCaseAccent returns the active palette. Falls back to Case A so
// reusable widgets that aren't placed under CaseAccentTheme still
// render rather than crashing — defensive default, not an expected
// usage pattern.
export function useCaseAccent(): CaseAccent {
  const ctx = useContext(CaseAccentContext);
  if (ctx) return ctx;
  return colors.caseAccent.a;
}
