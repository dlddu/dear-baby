// Badge / Tag — see docs/design-system/components.md
//
// variant:
//  - week     : Sage Green + 흰 글씨 (예: "임신 17주 3일")
//  - secondary: Beige + secondary text (예: "더보기 >")
//  - category : Coral + 흰 글씨 (예: "음성 기록")

import { StyleSheet, View, type ViewProps } from 'react-native';

import { colors } from '../theme/colors';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';

import { Text } from './Text';

type BadgeVariant = 'week' | 'secondary' | 'category';

export type BadgeProps = Omit<ViewProps, 'children'> & {
  label: string;
  variant?: BadgeVariant;
};

const palette: Record<BadgeVariant, { bg: string; color: 'onPrimary' | 'secondary' }> = {
  week: { bg: colors.accent.sage, color: 'onPrimary' },
  secondary: { bg: colors.bg.beige, color: 'secondary' },
  category: { bg: colors.primary.coral, color: 'onPrimary' },
};

export function Badge({
  label,
  variant = 'week',
  style,
  ...rest
}: BadgeProps) {
  const p = palette[variant];
  return (
    <View {...rest} style={[styles.badge, { backgroundColor: p.bg }, style]}>
      <Text variant="badge" color={p.color}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderRadius: radius.xs,
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
  },
});
