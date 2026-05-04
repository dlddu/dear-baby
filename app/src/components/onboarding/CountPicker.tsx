// CountPicker — used on A1 / B1 / B4 / C1 to pick "how many children".
// Always renders three options: "1명", "2명", "3명 이상". The 3+ option
// commits a value of 3 to the draft (which the funnel's repeat loop
// treats literally — users with 4+ children pick 3 and add the rest in
// the post-onboarding settings flow when AC-006-10 lands).

import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '../Text';
import { colors } from '../../theme/colors';
import { radius } from '../../theme/radius';
import { spacing } from '../../theme/spacing';

import { useCaseAccent } from './CaseAccentTheme';

export type CountPickerProps = {
  value: number | null;
  onChange: (n: number) => void;
  // mode='multi' renders 1/2/3+ for caregiver counts (Case B/C).
  // mode='multiple-pregnancy' renders 단태/다태 for pregnancy counts
  // (Case A/B's 임신 아이 수). 다태 commits 2.
  mode: 'caregiver' | 'pregnancy';
  testID?: string;
};

const caregiverOptions = [
  { label: '1명', value: 1 },
  { label: '2명', value: 2 },
  { label: '3명 이상', value: 3 },
];

const pregnancyOptions = [
  { label: '단태 (1명)', value: 1 },
  { label: '다태 (2명 이상)', value: 2 },
];

export function CountPicker({ value, onChange, mode, testID }: CountPickerProps) {
  const { color } = useCaseAccent();
  const options = mode === 'caregiver' ? caregiverOptions : pregnancyOptions;
  return (
    <View style={styles.row} testID={testID}>
      {options.map((opt) => {
        const selected = value === opt.value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            testID={`${testID}-${opt.value}`}
            style={({ pressed }) => [
              styles.tile,
              selected && { borderColor: color, backgroundColor: color + '14' },
              pressed && styles.pressed,
            ]}
          >
            <Text
              variant="body"
              color={selected ? 'primary' : 'secondary'}
              style={[styles.label, selected && { color }]}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3] },
  tile: {
    flexBasis: '48%',
    minHeight: 64,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: colors.bg.beige,
    backgroundColor: colors.surface.ivory,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[3],
  },
  pressed: { opacity: 0.85 },
  label: { fontWeight: '600', textAlign: 'center' },
});
