// Multi-select for the four record purposes used in A3 / B6 / C3. The
// purposes match backend onboarding.RecordPurpose. Per the PRD users
// must pick at least one, so the parent screen gates the CTA on
// length > 0.

import { Pressable, StyleSheet, View } from 'react-native';

import { caseAccent } from './caseTheme';
import type { CaseKind, RecordPurpose } from '../../api/onboarding';
import { Text } from '../Text';
import { colors } from '../../theme/colors';
import { radius } from '../../theme/radius';
import { spacing } from '../../theme/spacing';

const ORDER: RecordPurpose[] = [
  'book_making',
  'memory_keeping',
  'family_share',
  'emotion_diary',
];

const LABELS: Record<RecordPurpose, string> = {
  book_making: '아이에게 줄 책 만들기',
  memory_keeping: '추억 보관',
  family_share: '가족과 공유',
  emotion_diary: '감정 일기',
};

export type PurposesPickerProps = {
  value: RecordPurpose[];
  onChange: (next: RecordPurpose[]) => void;
  caseKind?: CaseKind | null;
};

export function PurposesPicker({
  value,
  onChange,
  caseKind,
}: PurposesPickerProps) {
  const accent = caseAccent(caseKind);
  const toggle = (p: RecordPurpose) => {
    if (value.includes(p)) {
      onChange(value.filter((v) => v !== p));
    } else {
      onChange([...value, p]);
    }
  };
  return (
    <View style={styles.list}>
      {ORDER.map((p) => {
        const selected = value.includes(p);
        return (
          <Pressable
            key={p}
            onPress={() => toggle(p)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: selected }}
            testID={`purpose-${p}`}
            style={({ pressed }) => [
              styles.tile,
              selected && {
                backgroundColor: accent.tint,
                borderColor: colors.text.primary,
                borderWidth: 1.5,
              },
              pressed && styles.pressed,
            ]}
          >
            <View style={[styles.box, selected && styles.boxSelected]}>
              {selected ? (
                <Text variant="caption" color="primary">
                  ✓
                </Text>
              ) : null}
            </View>
            <Text
              variant="body"
              style={{
                color: colors.text.primary,
                fontWeight: selected ? '600' : '400',
              }}
            >
              {LABELS[p]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing[2] },
  tile: {
    borderRadius: radius.xs,
    borderWidth: 1,
    borderColor: colors.bg.beige,
    backgroundColor: colors.surface.ivory,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  pressed: { opacity: 0.85 },
  box: {
    width: 18,
    height: 18,
    borderWidth: 1,
    borderColor: colors.text.muted,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 3,
  },
  boxSelected: {
    backgroundColor: colors.surface.ivory,
    borderColor: colors.text.primary,
  },
});
