// Onboarding 종결/관문 화면에서 [기본 CTA] 위에 노출되는 보조 [이전으로] 링크.
// a3·b2-purpose·b6·c3 처럼 흐름의 종결 위치, 그리고 a2·b2·b5·c2 처럼 다태/다자녀
// 반복 입력 중 [이전 아이로] 돌아가는 위치에서 동일한 시각·동작으로 쓰인다.

import { Pressable, type PressableProps, StyleSheet } from 'react-native';

import { spacing } from '../theme/spacing';
import { Text } from './Text';

export type BackLinkProps = {
  onPress: () => void;
  /** 링크 라벨. 기본은 "← 이전으로". 다태/다자녀 반복에서는 "← 이전 아이로". */
  label?: string;
  testID?: string;
} & Pick<PressableProps, 'accessibilityLabel'>;

export function BackLink({
  onPress,
  label = '← 이전으로',
  testID,
  accessibilityLabel,
}: BackLinkProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      testID={testID}
      style={({ pressed }) => [styles.link, pressed && styles.pressed]}
    >
      <Text variant="caption" color="secondary" style={styles.text}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  link: {
    alignSelf: 'flex-start',
    paddingVertical: spacing[2],
  },
  text: { textDecorationLine: 'underline' },
  pressed: { opacity: 0.85 },
});
