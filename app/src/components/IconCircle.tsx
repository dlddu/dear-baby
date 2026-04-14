// Icon container — see docs/design-system/components.md
// 48x48 원형 배경 위에 이모지/아이콘을 올리는 패턴.
// 카테고리별 배경색을 props 로 받거나 colors.icon.* 프리셋을 사용.

import { StyleSheet, View, type ViewProps } from 'react-native';

import { colors } from '../theme/colors';
import { radius } from '../theme/radius';

import { Text } from './Text';

type IconTone = keyof typeof colors.icon;

export type IconCircleProps = Omit<ViewProps, 'children'> & {
  /** 중앙에 표시할 이모지 혹은 한 글자 아이콘 */
  glyph: string;
  /** 카테고리 배경 톤. 기본 voice. */
  tone?: IconTone;
  /** 커스텀 배경색 — tone 보다 우선 적용 */
  background?: string;
  size?: number;
};

export function IconCircle({
  glyph,
  tone = 'voice',
  background,
  size = 48,
  style,
  ...rest
}: IconCircleProps) {
  const bg = background ?? colors.icon[tone];
  return (
    <View
      {...rest}
      style={[
        styles.circle,
        { width: size, height: size, backgroundColor: bg },
        style,
      ]}
    >
      <Text style={{ fontSize: Math.round(size * 0.5) }}>{glyph}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
