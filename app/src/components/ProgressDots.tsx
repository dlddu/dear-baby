// ProgressDots — onboarding 상단 진행 표시.
// docs/mockups/source/src/components/Common.tsx 의 ProgressDots 와 1:1 매핑.
//
// 규칙:
// - i <= current : Coral, width 24 (현재까지 진행한 단계)
// - i >  current : Beige, width 6 (남은 단계)
// 모든 도트는 height 6, 완전 원형 라디우스.

import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors } from '../theme/colors';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';

export type ProgressDotsProps = {
  total: number;
  current: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const DOT_HEIGHT = 6;
const DOT_ACTIVE_WIDTH = 24;
const DOT_INACTIVE_WIDTH = 6;
const DOT_GAP = 6;

export function ProgressDots({
  total,
  current,
  style,
  testID,
}: ProgressDotsProps) {
  return (
    <View style={[styles.wrap, style]} testID={testID}>
      {Array.from({ length: total }).map((_, i) => {
        const active = i <= current;
        return (
          <View
            key={i}
            style={[
              styles.dot,
              {
                width: active ? DOT_ACTIVE_WIDTH : DOT_INACTIVE_WIDTH,
                backgroundColor: active
                  ? colors.primary.coral
                  : colors.bg.beige,
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DOT_GAP,
    paddingHorizontal: spacing[6],
    paddingTop: spacing[3],
  },
  dot: {
    height: DOT_HEIGHT,
    borderRadius: radius.full,
  },
});
