// ChipRow — single-select pill row (성별 chips on A2/B2/B5/C2).
// Selected chip uses the case-neutral selected style (beige tint +
// dark border) — case accent is reserved for the progress bar.

import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '../Text';
import { colors } from '../../theme/colors';
import { radius } from '../../theme/radius';
import { spacing } from '../../theme/spacing';

export type ChipOption<T> = {
  label: string;
  value: T;
};

export type ChipRowProps<T extends string> = {
  options: ChipOption<T>[];
  value?: T;
  onChange: (v: T) => void;
  testID?: string;
};

export function ChipRow<T extends string>({
  options,
  value,
  onChange,
  testID,
}: ChipRowProps<T>) {
  return (
    <View style={styles.row} testID={testID}>
      {options.map((o) => {
        const selected = value === o.value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={o.label}
            testID={testID ? `${testID}-${o.value}` : undefined}
            style={({ pressed }) => [
              styles.chip,
              selected ? styles.chipSelected : styles.chipUnselected,
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text variant="caption" style={selected ? styles.labelSelected : undefined}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing[2],
    flexWrap: 'wrap',
  },
  chip: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: radius.full,
    borderWidth: 1,
  },
  chipUnselected: {
    backgroundColor: colors.surface.ivory,
    borderColor: colors.bg.beige,
  },
  chipSelected: {
    backgroundColor: colors.bg.beige,
    borderColor: colors.text.primary,
    borderWidth: 1.5,
  },
  labelSelected: { fontWeight: '600' },
});
