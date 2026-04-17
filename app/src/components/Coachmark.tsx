// Coachmark — single-shot tooltip used in Stage 2 of onboarding
// (docs/design-system/onboarding.md).
//
// Shape: rounded ivory card with the hint text and a close button, plus a
// downward-pointing arrow beneath it so the reader connects the tip to the
// element below. Per spec, only one coachmark shows per screen and it never
// reappears after dismissal — the parent is responsible for both rules.

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

export type CoachmarkProps = {
  label: string;
  onDismiss: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  dismissTestID?: string;
};

export function Coachmark({
  label,
  onDismiss,
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
      <View style={styles.arrow} />
    </View>
  );
}

const ARROW_SIZE = 10;

const styles = StyleSheet.create({
  wrapper: {
    alignSelf: 'center',
    alignItems: 'center',
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
