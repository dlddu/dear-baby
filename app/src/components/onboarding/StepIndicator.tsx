// StepIndicator — Case B's ① → ② two-step badge pair shown on B0 and B3.
// "stage 1" highlights bubble 1 in the case accent; "stage 2" marks 1
// as done (filled tint + check) and highlights bubble 2.
//
// Wire-frame: case-b.svg B0 (one) and B3 (two). Also rendered above the
// title block on those intro screens.

import { StyleSheet, View } from 'react-native';

import { spacing } from '../../theme/spacing';
import { radius } from '../../theme/radius';
import { colors } from '../../theme/colors';

import { Text } from '../Text';
import { accentFor } from './caseAccent';

export type StepIndicatorProps = {
  active: 'one' | 'two';
};

export function StepIndicator({ active }: StepIndicatorProps) {
  const accent = accentFor('B');
  const oneActive = active === 'one';
  return (
    <View style={styles.row} accessibilityLabel={`단계 ${active === 'one' ? '1' : '2'} / 2`}>
      <View
        style={[
          styles.bubble,
          oneActive
            ? { backgroundColor: accent.bar }
            : { backgroundColor: accent.surface, borderColor: accent.bar, borderWidth: 1 },
        ]}
      >
        {oneActive ? (
          <Text variant="badge" style={{ color: accent.text }}>
            1
          </Text>
        ) : (
          <Text variant="badge" style={{ color: accent.text }}>
            ✓
          </Text>
        )}
      </View>
      <View
        style={[styles.connector, { backgroundColor: oneActive ? colors.bg.beige : accent.bar }]}
      />
      <View
        style={[
          styles.bubble,
          oneActive
            ? { backgroundColor: colors.bg.beige }
            : { backgroundColor: accent.bar },
        ]}
      >
        <Text
          variant="badge"
          style={{ color: oneActive ? colors.text.muted : accent.text }}
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
    gap: spacing[1],
  },
  bubble: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  connector: {
    flex: 1,
    height: 2,
    minWidth: spacing[6],
  },
});
