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
  // Case-branching 온보딩 (PRD-006) 액센트.
  // 와이어프레임 docs/wireframes/onboarding/case-{a,b,c}.svg 의 진행 바·
  // 배지 색상을 그대로 토큰화. 각 케이스의 시각 구분에만 사용한다.
  caseAccent: {
    a: { bar: '#D85A30', text: '#993C1D', bg: '#FBE8E1' },
    b: { bar: '#EF9F27', text: '#854F0B', bg: '#FAEEDA' },
    c: { bar: '#378ADD', text: '#0C447C', bg: '#DCE9F7' },
  },
  // 그림자 기준 색
  shadow: '#3D2E1E',
} as const;

export type ColorTokens = typeof colors;
