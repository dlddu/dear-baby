// Top-of-screen progress bar shown on every onboarding screen. The
// filled portion uses the active case accent (or neutral gray on Q1/Q2).
// `n` is the 1-indexed current step; `of` is the total steps in the
// active funnel slice, e.g. Case A renders n/3.

import { StyleSheet, View } from 'react-native';

import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

import { useCaseAccent } from './CaseAccentTheme';

export type OnboardingProgressBarProps = {
  n: number;
  of: number;
  testID?: string;
};

export function OnboardingProgressBar({ n, of, testID }: OnboardingProgressBarProps) {
  const { color } = useCaseAccent();
  const ratio = of <= 0 ? 0 : Math.min(1, Math.max(0, n / of));
  return (
    <View style={styles.track} testID={testID}>
      <View
        style={[
          styles.fill,
          { width: `${ratio * 100}%`, backgroundColor: color },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 6,
    backgroundColor: colors.bg.beige,
    borderRadius: 3,
    overflow: 'hidden',
    marginHorizontal: spacing[6],
    marginTop: spacing[2],
  },
  fill: {
    height: '100%',
    borderRadius: 3,
  },
});
