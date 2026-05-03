// PRD-006 onboarding step header — back arrow + per-step progress label
// (e.g. `Case A · 1/3`) and an optional repeat counter (`아이 1/N`).
// Pulled out of the screens so the wireframe's compact top-row stays
// visually identical across all 10+ funnel screens.

import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Text } from '../Text';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

export type StepHeaderProps = {
  /** e.g. `Case A · 1/3`. Hidden when omitted (S0 intro). */
  progress?: string;
  /** e.g. `아이 1/3`. Hidden when omitted. */
  counter?: string;
  /** Hide the back arrow on screens that aren't reachable from the
   * stack (S0, terminal celebrations). */
  showBack?: boolean;
};

export function StepHeader({ progress, counter, showBack = true }: StepHeaderProps) {
  const router = useRouter();
  return (
    <View style={styles.row}>
      {showBack ? (
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="뒤로"
          hitSlop={12}
          testID="onboarding-back"
        >
          <Text variant="h3" color="primary">
            ←
          </Text>
        </Pressable>
      ) : (
        <View style={styles.spacer} />
      )}
      <View style={styles.center}>
        {progress ? (
          <Text variant="caption" color="secondary">
            {progress}
          </Text>
        ) : null}
      </View>
      <View style={styles.right}>
        {counter ? (
          <Text variant="caption" color="muted">
            {counter}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    backgroundColor: colors.bg.cream,
  },
  spacer: { width: 24 },
  center: { flex: 1, alignItems: 'center' },
  right: { minWidth: 56, alignItems: 'flex-end' },
});
