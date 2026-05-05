// Pill-style gender picker. Three options because the PRD requires
// "미정" always be available (docs/wireframes/onboarding.md "입력 허들
// 낮추는 장치").

import { Pressable, StyleSheet, View } from 'react-native';

import { caseAccent } from './caseTheme';
import type { CaseKind, Gender } from '../../api/onboarding';
import { Text } from '../Text';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

export type GenderPickerProps = {
  value: Gender | null;
  onChange: (next: Gender) => void;
  caseKind?: CaseKind | null;
  /** Show "남아/여아" (default) or "남자/여자" — child screens use the
   *  baby form, fetus screens too in the wireframes. */
  variant?: 'baby' | 'adult';
  testID?: string;
};

const LABELS: Record<'baby' | 'adult', Record<Gender, string>> = {
  baby: { male: '남아', female: '여아', undecided: '미정' },
  adult: { male: '남자', female: '여자', undecided: '미정' },
};

export function GenderPicker({
  value,
  onChange,
  caseKind,
  variant = 'baby',
  testID,
}: GenderPickerProps) {
  const accent = caseAccent(caseKind);
  return (
    <View style={styles.row} testID={testID}>
      {(['male', 'female', 'undecided'] as Gender[]).map((g) => {
        const selected = value === g;
        return (
          <Pressable
            key={g}
            onPress={() => onChange(g)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            testID={testID ? `${testID}-${g}` : undefined}
            style={({ pressed }) => [
              styles.pill,
              selected && {
                backgroundColor: accent.tint,
                borderColor: colors.text.primary,
                borderWidth: 1.5,
              },
              pressed && styles.pressed,
            ]}
          >
            <Text
              variant="caption"
              style={{
                color: colors.text.primary,
                fontWeight: selected ? '700' : '400',
              }}
            >
              {LABELS[variant][g]}
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
  },
  pill: {
    flex: 1,
    paddingVertical: spacing[3],
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: colors.bg.beige,
    backgroundColor: colors.surface.ivory,
    alignItems: 'center',
  },
  pressed: { opacity: 0.85 },
});
