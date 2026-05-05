// CaseAccent helpers expose the per-case palette + a tiny context that
// progress + repeat badges read from. The wireframes
// (`docs/wireframes/onboarding.md`) define the case accents (A=코랄,
// B=앰버, C=블루) — these components apply the tokens declared in
// theme/colors.ts so screens never reach into the palette directly.

import { createContext, useContext, type ReactNode } from 'react';

import { colors, type CaseAccentTokens } from '../../theme/colors';

import type { OnboardingCase } from '../../api/onboarding';

const NEUTRAL: CaseAccentTokens = {
  base: colors.text.muted,
  soft: colors.bg.beige,
  ink: colors.text.secondary,
};

export function caseAccent(c: OnboardingCase | null | undefined): CaseAccentTokens {
  if (c === 'A') return colors.caseAccent.a;
  if (c === 'B') return colors.caseAccent.b;
  if (c === 'C') return colors.caseAccent.c;
  return NEUTRAL;
}

const CaseAccentContext = createContext<CaseAccentTokens>(NEUTRAL);

export type CaseAccentProviderProps = {
  case: OnboardingCase | null | undefined;
  children: ReactNode;
};

export function CaseAccentProvider({
  case: c,
  children,
}: CaseAccentProviderProps) {
  return (
    <CaseAccentContext.Provider value={caseAccent(c)}>
      {children}
    </CaseAccentContext.Provider>
  );
}

export function useCaseAccent(): CaseAccentTokens {
  return useContext(CaseAccentContext);
}
