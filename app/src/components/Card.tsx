// Card — see docs/design-system/components.md
// 기본 카드: Cream White 배경, radius.md(16), shadows.card.

import { StyleSheet, View, type ViewProps } from 'react-native';

import { colors } from '../theme/colors';
import { radius } from '../theme/radius';
import { shadows } from '../theme/shadows';
import { spacing } from '../theme/spacing';

export type CardProps = ViewProps & {
  /** 카드 내부 여백 프리셋. 기본 'md'(20). */
  padding?: 'sm' | 'md' | 'lg';
  /** 표면 톤. 기본은 Ivory(흰). 질문카드 같은 경우 cream 으로 전환. */
  surface?: 'ivory' | 'cream' | 'beige';
};

const paddingMap = {
  sm: spacing[4],
  md: spacing[5],
  lg: spacing[6],
} as const;

const surfaceMap = {
  ivory: colors.surface.ivory,
  cream: colors.bg.cream,
  beige: colors.bg.beige,
} as const;

export function Card({
  padding = 'md',
  surface = 'ivory',
  style,
  children,
  ...rest
}: CardProps) {
  return (
    <View
      {...rest}
      style={[
        styles.card,
        {
          padding: paddingMap[padding],
          backgroundColor: surfaceMap[surface],
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.md,
    ...shadows.card,
  },
});
