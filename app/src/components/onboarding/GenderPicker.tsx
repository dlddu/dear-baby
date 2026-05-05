// GenderPicker — 성별 선택 (남아·여아·미정). 와이어프레임 A2/B5 의
// pill 형태를 그대로 따른다.

import { Keyboard, Pressable, StyleSheet, View } from 'react-native';

import { Text } from '../Text';
import { colors } from '../../theme/colors';
import { radius } from '../../theme/radius';
import { spacing } from '../../theme/spacing';

import { useCaseAccent } from './CaseAccent';

import type { ChildGender } from '../../api/onboarding';

const OPTIONS: Array<{ value: ChildGender; label: string }> = [
  { value: 'male', label: '남아' },
  { value: 'female', label: '여아' },
  { value: 'undecided', label: '미정' },
];

export type GenderPickerProps = {
  value: ChildGender | undefined;
  onChange: (g: ChildGender) => void;
  testID?: string;
};

export function GenderPicker({ value, onChange, testID }: GenderPickerProps) {
  const accent = useCaseAccent();
  return (
    <View style={styles.row} testID={testID}>
      {OPTIONS.map((opt) => {
        const selected = value === opt.value;
        return (
          <Pressable
            key={opt.value}
            accessibilityRole="button"
            accessibilityLabel={opt.label}
            onPress={() => {
              // RN Pressable doesn't auto-dismiss the soft keyboard
              // when transitioning from a TextInput; without this the
              // pill tap can land on the keyboard's overlay rect on
              // Android. Dismiss explicitly so the pill always wins.
              Keyboard.dismiss();
              onChange(opt.value);
            }}
            testID={testID ? `${testID}-${opt.value}` : undefined}
            style={({ pressed }) => [
              styles.pill,
              selected
                ? {
                    backgroundColor: accent.soft,
                    borderColor: accent.base,
                    borderWidth: 1.5,
                  }
                : {
                    backgroundColor: colors.surface.ivory,
                    borderColor: colors.bg.beige,
                    borderWidth: 1,
                  },
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text
              variant="caption"
              color={selected ? 'primary' : 'secondary'}
              style={styles.label}
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
  row: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  pill: {
    flex: 1,
    borderRadius: radius.full,
    paddingVertical: spacing[2],
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontWeight: '600' },
});
