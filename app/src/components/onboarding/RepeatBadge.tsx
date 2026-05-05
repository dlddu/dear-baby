// "반복 n/N" badge shown on the repeat-input screens (B2, B5, C2, A2
// when multiple). Top-right of the screen content area in the
// wireframes.

import { StyleSheet, View } from 'react-native';

import { caseAccent } from './caseTheme';
import type { CaseKind } from '../../api/onboarding';
import { Text } from '../Text';

export type RepeatBadgeProps = {
  index: number;
  total: number;
  caseKind?: CaseKind | null;
};

export function RepeatBadge({ index, total, caseKind }: RepeatBadgeProps) {
  const accent = caseAccent(caseKind);
  return (
    <View style={[styles.badge, { backgroundColor: accent.tint }]}>
      <Text variant="badge" style={{ color: accent.label }}>
        반복 {index}/{total}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
});
