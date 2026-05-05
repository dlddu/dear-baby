// ProgressBar renders the case-tinted "n / total" bar that sits at the
// top of every onboarding screen. The wireframe (docs/wireframes/onboarding/
// case-a.svg, case-b.svg, case-c.svg) keeps the bar above any heading
// text and above the page-level horizontal padding, so callers should
// place this at the very top of their content area.

import { StyleSheet, View } from 'react-native';

import { colors } from '../../theme/colors';
import { radius } from '../../theme/radius';
import { spacing } from '../../theme/spacing';

import { useCaseAccent } from './CaseAccentTheme';

export type ProgressBarProps = {
  /** 1-indexed current step. */
  current: number;
  /** Total steps in the case. */
  total: number;
  /**
   * Optional override colour — used by the common Q1/Q2 screens which
   * have not yet resolved a case. Defaults to the case accent.
   */
  tone?: 'case' | 'neutral';
};

export function ProgressBar({ current, total, tone = 'case' }: ProgressBarProps) {
  const accent = useCaseAccent();
  const ratio = Math.max(0, Math.min(1, current / Math.max(total, 1)));
  const fillColor = tone === 'neutral' ? colors.text.muted : accent.bar;
  return (
    <View style={styles.track}>
      <View
        style={[
          styles.fill,
          { width: `${ratio * 100}%`, backgroundColor: fillColor },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 3,
    backgroundColor: colors.bg.beige,
    borderRadius: radius.xs,
    overflow: 'hidden',
    marginBottom: spacing[3],
  },
  fill: {
    height: '100%',
    borderRadius: radius.xs,
  },
});
