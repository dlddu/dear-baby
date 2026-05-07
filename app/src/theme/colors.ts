// Color palette — see docs/design-system/colors.md
// Warm Coral / Cream White 기반의 따뜻한 톤. 그레이 대신 브라운 계열 사용.

export const colors = {
  primary: {
    coral: '#D4836B',
    peach: '#F5C6A8',
    /** Coral 10% alpha — 선택 옵션 카드 등 약한 강조 배경 */
    coralTint: '#D4836B1A',
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
  // 그림자 기준 색
  shadow: '#3D2E1E',
} as const;

export type ColorTokens = typeof colors;
