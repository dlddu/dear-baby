// Three-way segmented control for gender input (여아 / 남아 / 미정).
// `unknown` is always available so the wireframe's "아직 모르겠어요"
// option works for early pregnancies (and Case C "보호자가 모름" edge
// cases — currently treated identically).

import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '../Text';
import { colors } from '../../theme/colors';
import { radius } from '../../theme/radius';
import { spacing } from '../../theme/spacing';

export type Gender = 'female' | 'male' | 'unknown';

export type GenderPickerProps = {
  value: Gender;
  onChange: (next: Gender) => void;
  /** When true, the unknown option is omitted (Case C parenting flow). */
  hideUnknown?: boolean;
  testIDPrefix?: string;
};

const ALL_OPTIONS: { id: Gender; label: string }[] = [
  { id: 'female', label: '여아' },
  { id: 'male', label: '남아' },
  { id: 'unknown', label: '아직 모름' },
];

export function GenderPicker({
  value,
  onChange,
  hideUnknown,
  testIDPrefix = 'gender',
}: GenderPickerProps) {
  const options = hideUnknown ? ALL_OPTIONS.slice(0, 2) : ALL_OPTIONS;
  return (
    <View style={styles.row}>
      {options.map((opt) => {
        const selected = value === opt.id;
        return (
          <Pressable
            key={opt.id}
            onPress={() => onChange(opt.id)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={opt.label}
            testID={`${testIDPrefix}-${opt.id}`}
            style={({ pressed }) => [
              styles.option,
              selected && styles.optionSelected,
              pressed && styles.optionPressed,
            ]}
          >
            <Text
              variant="body"
              color={selected ? 'onPrimary' : 'primary'}
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
  row: { flexDirection: 'row', gap: spacing[2] },
  option: {
    flex: 1,
    paddingVertical: spacing[3],
    alignItems: 'center',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.bg.beige,
    backgroundColor: colors.surface.ivory,
  },
  optionSelected: {
    backgroundColor: colors.primary.coral,
    borderColor: colors.primary.coral,
  },
  optionPressed: { opacity: 0.85 },
});
