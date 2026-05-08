// Pill — 선택형 알약 모양 칩.
// docs/mockups/source/src/components/Common.tsx 의 `Pill` 과 1:1 매핑.
//
// 성별 선택(여자아이/남자아이/아직 몰라요) 처럼 라디오 그룹 형태로 쓰인다.
// 선택 시 Coral 배경 + 흰 글씨, 비선택 시 Cream 배경 + 회갈색 글씨.

import {
  Pressable,
  StyleSheet,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { colors } from '../theme/colors';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';

import { Text } from './Text';

export type PillProps = Omit<PressableProps, 'children' | 'style'> & {
  label: string;
  selected?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Pill({
  label,
  selected = false,
  style,
  ...rest
}: PillProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      {...rest}
      style={({ pressed }) => [
        styles.base,
        selected ? styles.selected : styles.idle,
        pressed && styles.pressed,
        style as ViewStyle,
      ]}
    >
      <Text
        variant="caption"
        color={selected ? 'onPrimary' : 'secondary'}
        style={styles.label}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  idle: {
    backgroundColor: colors.bg.cream,
  },
  selected: {
    backgroundColor: colors.primary.coral,
  },
  pressed: { opacity: 0.85 },
  label: {
    fontWeight: '600',
  },
});
