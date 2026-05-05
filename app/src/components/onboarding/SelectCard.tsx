// SelectCard — 옵션 단일/복수 선택용 큰 카드. 와이어프레임의
// 옵션 버튼(예: A1 단태/다태, B1 1명/2명/3명+, C1 양육 아이 수,
// 기록 목적 체크박스)을 모두 동일한 컴포넌트로 표현한다.
//
// 선택 상태에서는 케이스 액센트의 soft 배경 + base 윤곽으로 강조한다.

import { Keyboard, Pressable, StyleSheet, View } from 'react-native';
import type { ReactNode } from 'react';

import { Text } from '../Text';
import { colors } from '../../theme/colors';
import { radius } from '../../theme/radius';
import { spacing } from '../../theme/spacing';

import { useCaseAccent } from './CaseAccent';

export type SelectCardProps = {
  selected?: boolean;
  onPress: () => void;
  /** 좌측 시각 요소(아이콘/체크박스 등). */
  leading?: ReactNode;
  /** 메인 라벨 — 한국어 카피 (예: "1명", "단태"). */
  title: string;
  /** 보조 라벨 — 옵션의 부가 설명 (예: "1명", "2명 이상"). */
  subtitle?: string;
  testID?: string;
};

export function SelectCard({
  selected,
  onPress,
  leading,
  title,
  subtitle,
  testID,
}: SelectCardProps) {
  const accent = useCaseAccent();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={() => {
        Keyboard.dismiss();
        onPress();
      }}
      testID={testID}
      style={({ pressed }) => [
        styles.card,
        selected
          ? {
              backgroundColor: accent.soft,
              borderColor: accent.base,
              borderWidth: 1.5,
            }
          : {
              backgroundColor: colors.surface.ivory,
              borderColor: colors.bg.beige,
              borderWidth: 1,
            },
        pressed && { opacity: 0.85 },
      ]}
    >
      {leading ? <View style={styles.leading}>{leading}</View> : null}
      <View style={styles.text}>
        <Text variant="body" color="primary" style={styles.title}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" color="secondary">
            {subtitle}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    borderRadius: radius.md,
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[4],
  },
  leading: { width: 28, alignItems: 'center' },
  text: { flex: 1, gap: spacing[1] },
  title: { fontWeight: '600' },
});
