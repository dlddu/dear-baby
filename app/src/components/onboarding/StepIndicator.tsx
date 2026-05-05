// Two-dot step indicator for Case B's intro screens (B0 step ①,
// B3 step ②). Mirrors the SVG: two circles + a connector, with the
// completed step showing a check and the active step filled-coral
// (tinted to match the case accent).

import { StyleSheet, View } from 'react-native';

import { caseAccent } from './caseTheme';
import type { CaseKind } from '../../api/onboarding';
import { Text } from '../Text';
import { colors } from '../../theme/colors';

export type StepIndicatorProps = {
  /** 'one' = first step active. 'two' = first step done, second active. */
  active: 'one' | 'two';
  /** Defaults to Case B accent (the only case that uses this indicator). */
  caseKind?: CaseKind | null;
};

export function StepIndicator({
  active,
  caseKind = 'B',
}: StepIndicatorProps) {
  const accent = caseAccent(caseKind);
  const oneDone = active === 'two';
  return (
    <View style={styles.row} accessibilityRole="header">
      <View
        style={[
          styles.dot,
          {
            backgroundColor: oneDone ? accent.tint : accent.bar,
            borderColor: accent.bar,
            borderWidth: oneDone ? 1 : 0,
          },
        ]}
      >
        {oneDone ? (
          <Text variant="badge" style={{ color: accent.label }}>
            ✓
          </Text>
        ) : (
          <Text variant="badge" style={{ color: accent.label }}>
            1
          </Text>
        )}
      </View>
      <View
        style={[
          styles.connector,
          { backgroundColor: oneDone ? accent.bar : colors.bg.beige },
        ]}
      />
      <View
        style={[
          styles.dot,
          {
            backgroundColor: oneDone ? accent.bar : colors.bg.beige,
          },
        ]}
      >
        <Text
          variant="badge"
          style={{
            color: oneDone ? accent.label : colors.text.muted,
          }}
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
    gap: 6,
  },
  dot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  connector: {
    width: 28,
    height: 2,
  },
});
