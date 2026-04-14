// Spacing tokens — see docs/design-system/tokens.md
// 기본 단위는 4px 배수.

export const spacing = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
} as const;

export type SpacingToken = keyof typeof spacing;
