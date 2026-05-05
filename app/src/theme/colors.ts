// Color palette — see docs/design-system/colors.md
// Warm Coral / Cream White 기반의 따뜻한 톤. 그레이 대신 브라운 계열 사용.

export const colors = {
  primary: {
    coral: '#D4836B',
    peach: '#F5C6A8',
  },
  bg: {
    cream: '#FAF6F1',
    beige: '#F0E6D8',
  },
  surface: {
    ivory: '#FFFFFF',
  },
  accent: {
    sage: '#A8C5A0',
    teal: '#7BACA3',
    gold: '#D4B896',
  },
  text: {
    primary: '#3D2E1E',
    secondary: '#8C7B6B',
    muted: '#B5A898',
    onPrimary: '#FFFFFF',
  },
  // 아이콘 원형 배경색 (카테고리별)
  icon: {
    voice: '#F5C6A8',
    question: '#FDDDD5',
    questionAlt: '#C8E0E0',
    book: '#D8E8D4',
    bookAlt: '#D8E0D4',
    ai: '#E0D4C4',
    aiAlt: '#E8DCC8',
  },
  // 케이스 분기 온보딩 액센트 — docs/wireframes/onboarding.md "케이스
  // 시각 구분" 표를 그대로 옮긴 값. base 는 진행 바·강조 라인,
  // soft 는 배지 배경 / 카드 톤, ink 는 case 라벨 텍스트에 쓴다.
  caseAccent: {
    a: { base: '#D85A30', soft: '#FBE4DA', ink: '#993C1D' }, // 코랄
    b: { base: '#EF9F27', soft: '#FAEEDA', ink: '#854F0B' }, // 앰버
    c: { base: '#378ADD', soft: '#DCEAF8', ink: '#0C447C' }, // 블루
  },
  // 그림자 기준 색
  shadow: '#3D2E1E',
} as const;

export type ColorTokens = typeof colors;
// CaseAccentTokens is intentionally widened to plain strings so the
// three case palettes (A/B/C) and the neutral fallback all share a
// single type. `as const` would narrow each entry to its literal hex.
export type CaseAccentTokens = {
  base: string;
  soft: string;
  ink: string;
};
