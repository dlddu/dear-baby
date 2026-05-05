// ProgressBar — onboarding funnel progress.
//
// Two layers: a beige track + a colored fill. The fill width is
// `current / total` and the color comes from the active case's
// accent (or neutral on Q1/Q2). Wire-frame reference: top-of-card
// 3px bar in docs/wireframes/onboarding/{common,case-a,case-b,case-c}.svg

import { StyleSheet, View } from 'react-native';

import { colors } from '../../theme/colors';
import { radius } from '../../theme/radius';

import { accentFor } from './caseAccent';
import type { OnboardingCase } from '../../api/types';

export type ProgressBarProps = {
  current: number;
  total: number;
  case?: OnboardingCase | null;
};

export function ProgressBar({
  current,
  total,
  case: caseKind,
}: ProgressBarProps) {
  const ratio = total > 0 ? Math.max(0, Math.min(1, current / total)) : 0;
  const accent = accentFor(caseKind);
  return (
    <View style={styles.track} accessibilityRole="progressbar">
      <View
        style={[
          styles.fill,
          { width: `${ratio * 100}%`, backgroundColor: accent.bar },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 4,
    backgroundColor: colors.bg.beige,
    borderRadius: radius.xs,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radius.xs,
  },
});
