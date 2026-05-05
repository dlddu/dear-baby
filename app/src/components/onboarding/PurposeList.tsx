// PurposeList — multi-select list shown on A3 / B6 / C3.
//
// Selected rows use the case-neutral selected style (beige tint + dark
// border) for consistency with ChoiceCard / ChipRow. The case accent is
// reserved for the progress bar.

import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '../Text';
import { colors } from '../../theme/colors';
import { radius } from '../../theme/radius';
import { spacing } from '../../theme/spacing';

import type { RecordPurpose } from '../../api/types';

export type PurposeOption = {
  label: string;
  value: RecordPurpose;
};

export type PurposeListProps = {
  options: PurposeOption[];
  values: RecordPurpose[];
  onChange: (next: RecordPurpose[]) => void;
  testID?: string;
};

export const DEFAULT_PURPOSE_OPTIONS: PurposeOption[] = [
  { label: '아이에게 줄 책 만들기', value: 'book_making' },
  { label: '추억 보관', value: 'memory_keeping' },
  { label: '가족과 공유', value: 'family_share' },
  { label: '감정 일기', value: 'emotion_diary' },
];

export function PurposeList({
  options,
  values,
  onChange,
  testID,
}: PurposeListProps) {
  const toggle = (v: RecordPurpose) => {
    if (values.includes(v)) onChange(values.filter((x) => x !== v));
    else onChange([...values, v]);
  };

  return (
    <View style={styles.list} testID={testID}>
      {options.map((o) => {
        const checked = values.includes(o.value);
        return (
          <Pressable
            key={o.value}
            onPress={() => toggle(o.value)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked }}
            accessibilityLabel={o.label}
            testID={testID ? `${testID}-${o.value}` : undefined}
            style={({ pressed }) => [
              styles.row,
              checked ? styles.rowChecked : styles.rowUnchecked,
              pressed && { opacity: 0.85 },
            ]}
          >
            <View
              style={[
                styles.box,
                checked ? styles.boxChecked : styles.boxUnchecked,
              ]}
            >
              {checked ? (
                <Text variant="badge" color="onPrimary">
                  ✓
                </Text>
              ) : null}
            </View>
            <Text
              variant="body"
              color="primary"
              style={checked ? styles.labelChecked : undefined}
            >
              {o.label}
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
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[4],
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  rowUnchecked: {
    backgroundColor: colors.surface.ivory,
    borderColor: colors.bg.beige,
  },
  rowChecked: {
    backgroundColor: colors.bg.beige,
    borderColor: colors.text.primary,
    borderWidth: 1.5,
  },
  box: {
    width: 18,
    height: 18,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  boxUnchecked: {
    borderColor: colors.text.muted,
    backgroundColor: 'transparent',
  },
  boxChecked: {
    borderColor: colors.text.primary,
    backgroundColor: colors.text.primary,
  },
  labelChecked: { fontWeight: '600' },
});
