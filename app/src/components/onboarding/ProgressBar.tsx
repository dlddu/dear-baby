// Top progress bar for the onboarding funnel. Matches the
// 160×3 rounded bar in docs/wireframes/onboarding/*.svg.

import { StyleSheet, View } from 'react-native';

import { caseAccent } from './caseTheme';
import type { CaseKind } from '../../api/onboarding';
import { colors } from '../../theme/colors';

export type ProgressBarProps = {
  /** Current step (1-indexed). */
  step: number;
  /** Total steps for this case. */
  total: number;
  /** null/undefined draws the neutral common-entry color. */
  caseKind?: CaseKind | null;
};

export function ProgressBar({ step, total, caseKind }: ProgressBarProps) {
  const accent = caseAccent(caseKind);
  const pct = Math.max(0, Math.min(1, step / total));
  return (
    <View
      style={styles.track}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: total, now: step }}
    >
      <View
        style={[
          styles.fill,
          { width: `${pct * 100}%`, backgroundColor: accent.bar },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 3,
    borderRadius: 1.5,
    backgroundColor: colors.bg.beige,
    overflow: 'hidden',
  },
  fill: {
    height: 3,
    borderRadius: 1.5,
  },
});
