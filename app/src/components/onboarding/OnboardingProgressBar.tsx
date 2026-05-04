// Top-of-screen progress bar shown on every onboarding screen. The
// filled portion uses the active case accent (or neutral gray on Q1/Q2).
// `n` is the 1-indexed current step; `of` is the total steps in the
// active funnel slice, e.g. Case A renders n/3.
//
// `label` (optional) renders a small case-tinted text under the bar —
// e.g. "Case A · 1/3" or "Case B · 1단계 ①". The wireframe shows this
// badge directly below the progress bar on every funnel screen.

import { StyleSheet, View } from 'react-native';

import { Text } from '../Text';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

import { useCaseAccent } from './CaseAccentTheme';

export type OnboardingProgressBarProps = {
  n: number;
  of: number;
  label?: string;
  testID?: string;
};

export function OnboardingProgressBar({ n, of, label, testID }: OnboardingProgressBarProps) {
  const { color, labelColor } = useCaseAccent();
  const ratio = of <= 0 ? 0 : Math.min(1, Math.max(0, n / of));
  return (
    <View style={styles.wrap}>
      <View style={styles.track} testID={testID}>
        <View
          style={[
            styles.fill,
            { width: `${ratio * 100}%`, backgroundColor: color },
          ]}
        />
      </View>
      {label ? (
        <Text variant="caption" style={[styles.label, { color: labelColor }]}>
          {label}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: spacing[6],
    marginTop: spacing[2],
    gap: spacing[2],
  },
  track: {
    height: 6,
    backgroundColor: colors.bg.beige,
    borderRadius: 3,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 3,
  },
  label: {
    fontWeight: '600',
  },
});
