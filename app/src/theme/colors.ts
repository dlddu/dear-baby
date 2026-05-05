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
  // 케이스 분기 온보딩 액센트 (docs/wireframes/onboarding.md "케이스 시각 구분")
  // 진행 바와 배지 텍스트 색만 사용. 본 토큰을 직접 쓰지 말고
  // <CaseAccentTheme/> 또는 caseAccents 헬퍼를 통해 접근한다.
  caseAccent: {
    a: { bar: '#D85A30', text: '#993C1D', surface: '#FCEAE2' },
    b: { bar: '#EF9F27', text: '#854F0B', surface: '#FAEEDA' },
    c: { bar: '#378ADD', text: '#0C447C', surface: '#DEEBF8' },
    neutral: { bar: '#888780', text: '#5F5E5A', surface: '#F1EFE8' },
  },
  // 그림자 기준 색
  shadow: '#3D2E1E',
} as const;

export type ColorTokens = typeof colors;
