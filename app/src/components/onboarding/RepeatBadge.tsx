// Top-right badge shown on the repeat-input screens (B2 caregiver entry,
// B5 fetus entry, C2 caregiver entry). Format: "반복 n/N". Uses the
// active case accent for the chip background.

import { StyleSheet, View } from 'react-native';

import { Text } from '../Text';
import { spacing } from '../../theme/spacing';

import { useCaseAccent } from './CaseAccentTheme';

export type RepeatBadgeProps = {
  n: number;
  of: number;
  testID?: string;
};

export function RepeatBadge({ n, of, testID }: RepeatBadgeProps) {
  const { color } = useCaseAccent();
  return (
    <View style={[styles.chip, { backgroundColor: color }]} testID={testID}>
      <Text variant="caption" color="onPrimary" style={styles.label}>
        반복 {n}/{of}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: 999,
  },
  label: { fontWeight: '600' },
});
