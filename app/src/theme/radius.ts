// Border radius tokens — see docs/design-system/tokens.md
// 부드러움(Softness) 원칙: 큰 라운드를 기본으로 사용.

export const radius = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  full: 9999,
} as const;

export type RadiusToken = keyof typeof radius;
