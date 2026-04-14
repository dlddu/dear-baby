// Floating Action Button — see docs/design-system/components.md
// 56x56 원형, Primary Coral 배경 + coral tint elevated shadow.

import { Pressable, type PressableProps, StyleSheet } from 'react-native';

import { colors } from '../theme/colors';
import { radius } from '../theme/radius';
import { shadows } from '../theme/shadows';

import { Text } from './Text';

export type FABProps = Omit<PressableProps, 'children' | 'style'> & {
  /** 중앙에 표시할 글리프. 기본값은 `+` */
  icon?: string;
};

export function FAB({ icon = '+', disabled, ...rest }: FABProps) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      {...rest}
      style={({ pressed }) => [
        styles.fab,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Text color="onPrimary" style={styles.icon}>
        {icon}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    width: 56,
    height: 56,
    borderRadius: radius.full,
    backgroundColor: colors.primary.coral,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.coral,
  },
  icon: {
    fontSize: 24,
    fontWeight: '300',
    lineHeight: 28,
  },
  pressed: { opacity: 0.9 },
  disabled: { opacity: 0.5 },
});
