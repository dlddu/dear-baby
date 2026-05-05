// StepIndicator renders Case B's two-step ① → ② markers on the
// transition screens (B0 양육 인디케이터, B3 임신 인디케이터). The
// active step takes the case accent fill, the previous step shows a
// check, and the upcoming step is the muted neutral.
//
// Wireframe: docs/wireframes/onboarding/case-b.svg, B0 (active=1) and
// B3 (active=2 with first step checked).

import { StyleSheet, View } from 'react-native';

import { colors } from '../../theme/colors';
import { Text } from '../Text';

import { useCaseAccent } from './CaseAccentTheme';

export type StepIndicatorProps = {
  /** 1 → first step active, 2 → second step active (first one checked). */
  active: 1 | 2;
};

export function StepIndicator({ active }: StepIndicatorProps) {
  const accent = useCaseAccent();
  const firstChecked = active === 2;
  return (
    <View style={styles.row}>
      <View
        style={[
          styles.circle,
          {
            backgroundColor: firstChecked ? accent.bg : accent.bar,
            borderColor: firstChecked ? accent.bar : 'transparent',
            borderWidth: firstChecked ? 1 : 0,
          },
        ]}
      >
        <Text
          variant="badge"
          style={{ color: firstChecked ? accent.text : colors.text.onPrimary }}
        >
          {firstChecked ? '✓' : '1'}
        </Text>
      </View>
      <View
        style={[
          styles.bar,
          { backgroundColor: firstChecked ? accent.bar : colors.bg.beige },
        ]}
      />
      <View
        style={[
          styles.circle,
          {
            backgroundColor: active === 2 ? accent.bar : colors.bg.beige,
          },
        ]}
      >
        <Text
          variant="badge"
          style={{
            color: active === 2 ? colors.text.onPrimary : colors.text.muted,
          }}
        >
          2
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  circle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bar: {
    width: 40,
    height: 2,
  },
});
