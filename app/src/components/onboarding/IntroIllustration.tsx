// IntroIllustration — soft decorative shape rendered between the hero
// text and the CTA on Case B's bridging screens (B0 caregiver phase,
// B3 pregnancy phase). The wireframe shows a placeholder rectangle in
// this position; we render a tinted rounded shape in the case accent
// so the screen has visual rhythm without pulling in image assets.

import { StyleSheet, View } from 'react-native';

import { spacing } from '../../theme/spacing';
import { useCaseAccent } from './CaseAccentTheme';

export type IntroIllustrationProps = {
  // Placeholder marker for future asset variants. Both phases share
  // the same visual today.
  variant?: 'caregiver' | 'pregnancy';
};

export function IntroIllustration(_props: IntroIllustrationProps) {
  const { tintColor, color } = useCaseAccent();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={[styles.frame, { backgroundColor: tintColor }]}
    >
      <View style={[styles.dotLg, { backgroundColor: color, opacity: 0.25 }]} />
      <View style={[styles.dotMd, { backgroundColor: color, opacity: 0.35 }]} />
      <View style={[styles.dotSm, { backgroundColor: color, opacity: 0.5 }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: '70%',
    height: 120,
    borderRadius: 24,
    marginTop: spacing[3],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[3],
  },
  dotLg: { width: 56, height: 56, borderRadius: 28 },
  dotMd: { width: 36, height: 36, borderRadius: 18 },
  dotSm: { width: 22, height: 22, borderRadius: 11 },
});
