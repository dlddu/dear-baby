// RepeatBadge — "반복 n/N" pill shown on B2 / B5 / C2 (per-child loops).
// Uses the active case's surface tint as background + accent-text color.
// Wire-frame reference: top-right of repeat screens, e.g. case-b.svg B2.

import { StyleSheet, View } from 'react-native';

import { radius } from '../../theme/radius';
import { spacing } from '../../theme/spacing';

import { Text } from '../Text';
import { accentFor } from './caseAccent';
import type { OnboardingCase } from '../../api/types';

export type RepeatBadgeProps = {
  current: number;
  total: number;
  case?: OnboardingCase | null;
};

export function RepeatBadge({ current, total, case: caseKind }: RepeatBadgeProps) {
  const accent = accentFor(caseKind);
  return (
    <View
      style={[styles.badge, { backgroundColor: accent.surface }]}
      accessibilityLabel={`반복 ${current}/${total}`}
    >
      <Text variant="badge" style={{ color: accent.text }}>
        {`반복 ${current}/${total}`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderRadius: radius.full,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
  },
});
