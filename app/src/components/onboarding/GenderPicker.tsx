// Three-button gender picker. "미정" is always present per
// docs/wireframes/onboarding.md ("입력 허들 낮추는 장치").

import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '../Text';
import { colors } from '../../theme/colors';
import { radius } from '../../theme/radius';
import { spacing } from '../../theme/spacing';

import { useCaseAccent } from './CaseAccentTheme';
import type { Gender } from '../../api/onboarding';

export type GenderPickerProps = {
  value: Gender | null;
  onChange: (g: Gender) => void;
  testID?: string;
};

// Order matches the wireframe (남아 → 여아 → 미정) per
// docs/wireframes/onboarding/case-a.svg.
const options: { label: string; value: Gender }[] = [
  { label: '남아', value: 'male' },
  { label: '여아', value: 'female' },
  { label: '미정', value: 'undecided' },
];

export function GenderPicker({ value, onChange, testID }: GenderPickerProps) {
  const { color } = useCaseAccent();
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
              styles.chip,
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
  row: { flexDirection: 'row', gap: spacing[2] },
  chip: {
    flex: 1,
    paddingVertical: spacing[3],
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: colors.bg.beige,
    backgroundColor: colors.surface.ivory,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.85 },
  label: { fontWeight: '600' },
});
