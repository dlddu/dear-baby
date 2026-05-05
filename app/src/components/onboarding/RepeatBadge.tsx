// RepeatBadge renders the "반복 n/N" pill in the upper-right of repeat
// input screens (B2 양육 아이 정보, B5 태아 정보, A2/C2 다태/다자녀 입력).
// Tone is the case-tint (faint background + dark accent text).

import { StyleSheet, View } from 'react-native';

import { radius } from '../../theme/radius';
import { spacing } from '../../theme/spacing';
import { Text } from '../Text';

import { useCaseAccent } from './CaseAccentTheme';

export type RepeatBadgeProps = {
  current: number;
  total: number;
};

export function RepeatBadge({ current, total }: RepeatBadgeProps) {
  const accent = useCaseAccent();
  return (
    <View style={[styles.pill, { backgroundColor: accent.bg }]}>
      <Text variant="badge" style={{ color: accent.text }}>
        반복 {current}/{total}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing[2],
    paddingVertical: 4,
    borderRadius: radius.full,
  },
});
