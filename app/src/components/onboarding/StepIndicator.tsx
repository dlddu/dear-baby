// StepIndicator renders the ① → ② phase marker on Case B's bridging
// screens (B0 introduces the caregiver phase, B3 the pregnancy phase).
// Either step can be flagged as `done`, `active`, or `pending`; the
// component picks colors accordingly so the same component handles
// both bridge screens.

import { StyleSheet, View } from 'react-native';

import { Text } from '../Text';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

import { useCaseAccent } from './CaseAccentTheme';

type StepState = 'done' | 'active' | 'pending';

export type StepIndicatorProps = {
  // Active step: 'one' on B0, 'two' on B3. Determines which label
  // shows the highlight ring.
  active: 'one' | 'two';
  testID?: string;
};

export function StepIndicator({ active, testID }: StepIndicatorProps) {
  const { color } = useCaseAccent();
  const oneState: StepState = active === 'one' ? 'active' : 'done';
  const twoState: StepState = active === 'two' ? 'active' : 'pending';
  return (
    <View style={styles.row} testID={testID}>
      <Bubble state={oneState} accent={color} label="①" caption="양육" />
      <View style={[styles.connector, { backgroundColor: color }]} />
      <Bubble state={twoState} accent={color} label="②" caption="임신" />
    </View>
  );
}

function Bubble({
  state,
  accent,
  label,
  caption,
}: {
  state: StepState;
  accent: string;
  label: string;
  caption: string;
}) {
  const filled = state !== 'pending';
  return (
    <View style={styles.bubbleWrap}>
      <View
        style={[
          styles.bubble,
          {
            backgroundColor: filled ? accent : colors.bg.beige,
            borderColor: state === 'active' ? accent : 'transparent',
            borderWidth: state === 'active' ? 2 : 0,
          },
        ]}
      >
        <Text
          variant="h3"
          color={filled ? 'onPrimary' : 'muted'}
          style={styles.bubbleLabel}
        >
          {label}
        </Text>
      </View>
      <Text variant="caption" color={state === 'pending' ? 'muted' : 'primary'} style={styles.caption}>
        {caption}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[3],
  },
  connector: {
    width: 40,
    height: 3,
    borderRadius: 2,
    opacity: 0.4,
  },
  bubbleWrap: { alignItems: 'center', gap: spacing[1] },
  bubble: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubbleLabel: { fontSize: 20, fontWeight: '700' },
  caption: { textAlign: 'center' },
});
