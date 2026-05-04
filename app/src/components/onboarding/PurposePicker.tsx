// PurposePicker — multi-select check list for the AC-006-02/03/04 record
// purposes. Layout follows the wireframe (docs/wireframes/onboarding/*.svg):
// a single full-width column where each row is a checkbox on the left
// followed by the option label.
//
// Labels are case-aware — the wireframes copy varies between cases
// (예: A 의 "임신 추억 보관" vs B/C 의 "성장 일기"). The four enum values
// remain constant on the API side.

import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '../Text';
import { colors } from '../../theme/colors';
import { radius } from '../../theme/radius';
import { spacing } from '../../theme/spacing';

import { useCaseAccent, type OnboardingCase } from './CaseAccentTheme';
import type { RecordPurpose } from '../../api/onboarding';

type PurposeOption = { value: RecordPurpose; label: string };

const LABELS: Record<Exclude<OnboardingCase, 'common'>, PurposeOption[]> = {
  A: [
    { value: 'book_making', label: '아이에게 줄 책 만들기' },
    { value: 'memory_keeping', label: '임신 추억 보관' },
    { value: 'family_share', label: '가족과 공유' },
    { value: 'emotion_diary', label: '감정 일기' },
  ],
  B: [
    { value: 'book_making', label: '책 만들기' },
    { value: 'memory_keeping', label: '성장 일기' },
    { value: 'family_share', label: '가족과 공유' },
    { value: 'emotion_diary', label: '감정 정리' },
  ],
  C: [
    { value: 'book_making', label: '아이에게 줄 책 만들기' },
    { value: 'memory_keeping', label: '성장 일기' },
    { value: 'family_share', label: '가족과 공유' },
    { value: 'emotion_diary', label: '육아 회고' },
  ],
};

const FALLBACK: PurposeOption[] = LABELS.B;

export type PurposePickerProps = {
  value: RecordPurpose[];
  onChange: (next: RecordPurpose[]) => void;
  testID?: string;
};

export function PurposePicker({ value, onChange, testID }: PurposePickerProps) {
  const { color, tintColor, case: c } = useCaseAccent();
  const options = c === 'common' ? FALLBACK : LABELS[c];
  const toggle = (p: RecordPurpose) => {
    onChange(value.includes(p) ? value.filter((v) => v !== p) : [...value, p]);
  };
  return (
    <View style={styles.list} testID={testID}>
      {options.map((opt) => {
        const selected = value.includes(opt.value);
        return (
          <Pressable
            key={opt.value}
            onPress={() => toggle(opt.value)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: selected }}
            testID={`${testID}-${opt.value}`}
            style={({ pressed }) => [
              styles.row,
              selected && { borderColor: color, backgroundColor: tintColor },
              pressed && styles.pressed,
            ]}
          >
            <View
              style={[
                styles.checkbox,
                selected
                  ? { borderColor: color, backgroundColor: color }
                  : { borderColor: colors.text.muted },
              ]}
            >
              {selected ? <View style={styles.checkmark} /> : null}
            </View>
            <Text
              variant="body"
              color="primary"
              style={[styles.label, selected && { color, fontWeight: '700' }]}
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
  list: { gap: spacing[3] },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    minHeight: 56,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: colors.bg.beige,
    backgroundColor: colors.surface.ivory,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: radius.xs,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: {
    width: 10,
    height: 6,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    borderColor: colors.text.onPrimary,
    transform: [{ rotate: '-45deg' }, { translateY: -2 }],
  },
  label: { flex: 1, fontWeight: '500' },
  pressed: { opacity: 0.85 },
});
