// RepeatBadge — 와이어프레임 우상단의 "반복 n/N" 표시
// (B2·B5·C2 반복 입력 화면 전용). 케이스 액센트 soft 배경 + ink 글씨.

import { StyleSheet, View, type ViewProps } from 'react-native';

import { Text } from '../Text';
import { radius } from '../../theme/radius';
import { spacing } from '../../theme/spacing';

import { useCaseAccent } from './CaseAccent';

export type RepeatBadgeProps = ViewProps & {
  current: number;
  total: number;
};

export function RepeatBadge({ current, total, style, ...rest }: RepeatBadgeProps) {
  const accent = useCaseAccent();
  return (
    <View
      {...rest}
      style={[styles.badge, { backgroundColor: accent.soft }, style]}
    >
      <Text variant="badge" style={{ color: accent.ink }}>
        반복 {current}/{total}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderRadius: radius.full,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
  },
});
