// PurposePicker — multi-select chip grid for the AC-006-02/03/04 record
// purposes. Each option toggles independently; the parent owns the
// array state.

import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '../Text';
import { colors } from '../../theme/colors';
import { radius } from '../../theme/radius';
import { spacing } from '../../theme/spacing';

import { useCaseAccent } from './CaseAccentTheme';
import type { RecordPurpose } from '../../api/onboarding';

const PURPOSE_OPTIONS: { value: RecordPurpose; label: string; hint: string }[] = [
  { value: 'book_making', label: '책 만들기', hint: '훗날 자서전으로 묶고 싶어요' },
  { value: 'memory_keeping', label: '추억 보관', hint: '평범한 순간을 기록하고 싶어요' },
  { value: 'family_share', label: '가족 공유', hint: '가족과 같이 보고 싶어요' },
  { value: 'emotion_diary', label: '감정 일기', hint: '내 마음을 글로 남기고 싶어요' },
];

export type PurposePickerProps = {
  value: RecordPurpose[];
  onChange: (next: RecordPurpose[]) => void;
  testID?: string;
};

export function PurposePicker({ value, onChange, testID }: PurposePickerProps) {
  const { color } = useCaseAccent();
  const toggle = (p: RecordPurpose) => {
    onChange(value.includes(p) ? value.filter((v) => v !== p) : [...value, p]);
  };
  return (
    <View style={styles.grid} testID={testID}>
      {PURPOSE_OPTIONS.map((opt) => {
        const selected = value.includes(opt.value);
        return (
          <Pressable
            key={opt.value}
            onPress={() => toggle(opt.value)}
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
            <Text variant="caption" color="muted" style={styles.hint}>
              {opt.hint}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3] },
  tile: {
    flexBasis: '48%',
    minHeight: 84,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: colors.bg.beige,
    backgroundColor: colors.surface.ivory,
    gap: spacing[1],
  },
  pressed: { opacity: 0.85 },
  label: { fontWeight: '700' },
  hint: { lineHeight: 16 },
});
