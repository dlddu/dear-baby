// GenderToggle is the three-pill (남아 / 여아 / 미정) selector used on
// A2 and B5 fetal-info screens, and on B2 / C2 child-info screens.

import { Keyboard, Pressable, StyleSheet, View } from 'react-native';

import type { Gender } from '../../api/onboarding';
import { colors } from '../../theme/colors';
import { radius } from '../../theme/radius';
import { spacing } from '../../theme/spacing';
import { Text } from '../Text';

import { useCaseAccent } from './CaseAccentTheme';

export type GenderToggleProps = {
  value?: Gender;
  onChange: (gender: Gender) => void;
};

const OPTIONS: ReadonlyArray<{ value: Gender; label: string }> = [
  { value: 'male', label: '남아' },
  { value: 'female', label: '여아' },
  { value: 'undecided', label: '미정' },
];

export function GenderToggle({ value, onChange }: GenderToggleProps) {
  const accent = useCaseAccent();
  return (
    <View style={styles.row}>
      {OPTIONS.map((opt) => {
        const selected = value === opt.value;
        return (
          <Pressable
            key={opt.value}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => {
              // Dismiss any soft keyboard from a previously-focused
              // TextInput so the form's footer CTA isn't covered when
              // Maestro taps the next button afterwards.
              Keyboard.dismiss();
              onChange(opt.value);
            }}
            style={({ pressed }) => [
              styles.pill,
              {
                backgroundColor: selected ? accent.bg : colors.surface.ivory,
                borderColor: selected ? accent.bar : colors.bg.beige,
                borderWidth: selected ? 2 : 1,
              },
              pressed && styles.pressed,
            ]}
            testID={`gender-${opt.value}`}
          >
            <Text variant="body" color="primary" style={styles.label}>
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
  pill: {
    flex: 1,
    borderRadius: radius.full,
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
  },
  pressed: { opacity: 0.85 },
  label: { textAlign: 'center', fontWeight: '600' },
});
