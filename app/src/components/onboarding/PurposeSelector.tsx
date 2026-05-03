// PRD-006 PurposeSelector — multi-select chips used by Case A/B/C 기록
// 목적 화면. Stateless: parent owns the selected list. Order is
// preserved so the draft replays in tap-order at submit time.

import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '../Text';
import { colors } from '../../theme/colors';
import { radius } from '../../theme/radius';
import { spacing } from '../../theme/spacing';

export type PurposeOption = {
  id: string;
  label: string;
};

export type PurposeSelectorProps = {
  options: PurposeOption[];
  selected: string[];
  onToggle: (id: string) => void;
  testIDPrefix?: string;
};

export function PurposeSelector({
  options,
  selected,
  onToggle,
  testIDPrefix = 'purpose',
}: PurposeSelectorProps) {
  return (
    <View style={styles.list}>
      {options.map((opt) => {
        const checked = selected.includes(opt.id);
        return (
          <Pressable
            key={opt.id}
            onPress={() => onToggle(opt.id)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked }}
            accessibilityLabel={opt.label}
            testID={`${testIDPrefix}-${opt.id}`}
            style={({ pressed }) => [
              styles.row,
              checked && styles.rowChecked,
              pressed && styles.rowPressed,
            ]}
          >
            <Text variant="body" color={checked ? 'coral' : 'primary'} style={styles.box}>
              {checked ? '☑' : '□'}
            </Text>
            <Text variant="body" color="primary" style={styles.label}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// DEFAULT_PURPOSES mirrors the wireframe's checkbox copy. Cases share
// the same canonical set so the backend stores a stable string key
// regardless of which case picked it.
export const DEFAULT_PURPOSES: PurposeOption[] = [
  { id: 'letter', label: '아기에게 보내는 편지' },
  { id: 'pregnancy_diary', label: '임신 일기로 남기기' },
  { id: 'growth_diary', label: '아이의 성장 일기' },
  { id: 'family_share', label: '가족과 추억 공유' },
  { id: 'book', label: '실물 책으로 만들기' },
  { id: 'daily_one_liner', label: '매일의 한 마디' },
];

const styles = StyleSheet.create({
  list: { gap: spacing[2] },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    borderRadius: radius.sm,
    backgroundColor: colors.surface.ivory,
    borderWidth: 1,
    borderColor: colors.bg.beige,
    gap: spacing[3],
  },
  rowChecked: {
    borderColor: colors.primary.coral,
    backgroundColor: colors.bg.cream,
  },
  rowPressed: { opacity: 0.85 },
  box: { fontSize: 18 },
  label: { flex: 1 },
});
