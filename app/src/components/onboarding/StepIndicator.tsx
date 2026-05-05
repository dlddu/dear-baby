// StepIndicator — Case B 의 ① → ② 두-단계 안내 표시 (B0, B3 화면).
// 와이어프레임:
//   one  : ●1 ━ ○2     (1단계 활성)
//   two  : ●✓ ━ ●2     (1단계 완료, 2단계 활성)

import { StyleSheet, View } from 'react-native';

import { Text } from '../Text';
import { colors } from '../../theme/colors';
import { radius } from '../../theme/radius';
import { spacing } from '../../theme/spacing';

import { useCaseAccent } from './CaseAccent';

export type StepIndicatorProps = {
  /** 'one' = 1단계 활성, 2단계 대기. 'two' = 1단계 완료 체크, 2단계 활성. */
  step: 'one' | 'two';
};

export function StepIndicator({ step }: StepIndicatorProps) {
  const accent = useCaseAccent();
  const stepOneActive = step === 'one';
  const stepTwoActive = step === 'two';
  return (
    <View style={styles.row}>
      <View
        style={[
          styles.dot,
          stepOneActive
            ? { backgroundColor: accent.base }
            : { backgroundColor: accent.soft, borderColor: accent.base },
          !stepOneActive && styles.dotComplete,
        ]}
      >
        {stepOneActive ? (
          <Text variant="badge" style={styles.label}>
            1
          </Text>
        ) : (
          <Text variant="badge" style={[styles.label, { color: accent.ink }]}>
            ✓
          </Text>
        )}
      </View>
      <View
        style={[
          styles.line,
          { backgroundColor: stepTwoActive ? accent.base : colors.bg.beige },
        ]}
      />
      <View
        style={[
          styles.dot,
          stepTwoActive
            ? { backgroundColor: accent.base }
            : { backgroundColor: colors.bg.beige },
        ]}
      >
        <Text
          variant="badge"
          style={[
            styles.label,
            stepTwoActive ? styles.label : { color: colors.text.muted },
          ]}
        >
          2
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  dot: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0,
  },
  dotComplete: {
    borderWidth: 1,
  },
  label: {
    color: colors.text.onPrimary,
    fontSize: 12,
  },
  line: {
    flex: 1,
    maxWidth: 56,
    height: 2,
    borderRadius: 1,
  },
});
