// Coachmark — single-shot tooltip used on the home screen
// (docs/wireframes/onboarding.md).
//
// Shape: rounded ivory card with the hint text and a close button, plus a
// downward-pointing arrow beneath it so the reader connects the tip to the
// element below. Per spec, only one coachmark shows per screen and it never
// reappears after dismissal — the parent is responsible for both rules.
//
// `arrowAlign` controls where the arrow sits horizontally. Use `left` when
// the coachmark is aligned against the left edge above a left-side CTA so
// the arrow points at the CTA center rather than the bubble center.

import {
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { colors } from '../theme/colors';
import { radius } from '../theme/radius';
import { shadows } from '../theme/shadows';
import { spacing } from '../theme/spacing';

import { Text } from './Text';

export type ArrowAlign = 'left' | 'center' | 'right';

export type CoachmarkProps = {
  label: string;
  onDismiss: () => void;
  arrowAlign?: ArrowAlign;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  dismissTestID?: string;
};

export function Coachmark({
  label,
  onDismiss,
  arrowAlign = 'center',
  style,
  testID,
  dismissTestID,
}: CoachmarkProps) {
  return (
    <View style={[styles.wrapper, style]} testID={testID}>
      <View style={styles.bubble}>
        <Text variant="caption" color="primary" style={styles.label}>
          {label}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="코치마크 닫기"
          onPress={onDismiss}
          hitSlop={spacing[2]}
          style={({ pressed }) => [styles.close, pressed && styles.pressed]}
          testID={dismissTestID}
        >
          <Text variant="caption" color="muted">
            ✕
          </Text>
        </Pressable>
      </View>
      <View style={[styles.arrow, arrowStyles[arrowAlign]]} />
    </View>
  );
}

const ARROW_SIZE = 10;
// ARROW_EDGE_INSET matches the dual-CTA row inset so the arrow hovers
// over the left CTA's center when `arrowAlign === 'left'`. The CTA row
// pads by spacing[5] from the screen edge and CTA width ~half of usable
// row, so ~25% of the row is a reasonable first approximation.
const ARROW_EDGE_INSET = spacing[6];

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'stretch',
  },
  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderRadius: radius.md,
    backgroundColor: colors.surface.ivory,
    ...shadows.card,
  },
  label: { flexShrink: 1 },
  close: {
    paddingHorizontal: spacing[1],
    paddingVertical: spacing[1],
  },
  pressed: { opacity: 0.6 },
  arrow: {
    width: 0,
    height: 0,
    marginTop: -1,
    borderLeftWidth: ARROW_SIZE,
    borderRightWidth: ARROW_SIZE,
    borderTopWidth: ARROW_SIZE,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: colors.surface.ivory,
  },
});

const arrowStyles = StyleSheet.create({
  center: { alignSelf: 'center' },
  left: { alignSelf: 'flex-start', marginLeft: ARROW_EDGE_INSET },
  right: { alignSelf: 'flex-end', marginRight: ARROW_EDGE_INSET },
});
