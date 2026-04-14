// Elevation / shadow tokens — see docs/design-system/tokens.md
// iOS 의 shadow* props 와 Android 의 elevation 을 함께 제공한다.
// 그림자 색은 항상 따뜻한 브라운(`#3D2E1E`).

import type { ViewStyle } from 'react-native';

import { colors } from './colors';

type ShadowStyle = Pick<
  ViewStyle,
  'shadowColor' | 'shadowOffset' | 'shadowOpacity' | 'shadowRadius' | 'elevation'
>;

export const shadows = {
  soft: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  card: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  elevated: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 6,
  },
  // FAB 전용 — Primary Coral 틴트가 들어간 강조 그림자 (docs/design-system/components.md)
  coral: {
    shadowColor: colors.primary.coral,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 8,
  },
} satisfies Record<string, ShadowStyle>;

export type ShadowToken = keyof typeof shadows;
