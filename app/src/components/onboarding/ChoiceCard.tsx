// ChoiceCard — selectable card used on Q1/Q2/A1/B1/B4/C1.
//
// Visual states (matches docs/wireframes/onboarding/*.svg):
//   - default : Ivory surface, beige border
//   - selected: Beige tint + dark border (case accent unused — the
//     wireframe consistently uses neutral dark borders for the active
//     state, with the case accent reserved for the progress bar)
//
// Use the `tall` variant for the A1/B4 단태/다태 grid where each card
// is square-ish; the default is a wide row used by Q1/Q2/B1/C1.

import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { colors } from '../../theme/colors';
import { radius } from '../../theme/radius';
import { spacing } from '../../theme/spacing';

import { Text } from '../Text';

export type ChoiceCardProps = {
  label: string;
  description?: string;
  selected: boolean;
  onPress: () => void;
  testID?: string;
  variant?: 'row' | 'tall';
  style?: ViewStyle;
  accessibilityLabel?: string;
};

export function ChoiceCard({
  label,
  description,
  selected,
  onPress,
  testID,
  variant = 'row',
  style,
  accessibilityLabel,
}: ChoiceCardProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={accessibilityLabel ?? label}
      testID={testID}
      style={({ pressed }) => [
        styles.card,
        variant === 'tall' && styles.tall,
        selected ? styles.selected : styles.unselected,
        pressed && styles.pressed,
        style,
      ]}
    >
      <View style={variant === 'tall' ? styles.tallContent : styles.rowContent}>
        <Text variant="body" color="primary" style={styles.label}>
          {label}
        </Text>
        {description ? (
          <Text variant="caption" color="secondary" style={styles.description}>
            {description}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.md,
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[4],
    backgroundColor: colors.surface.ivory,
    borderWidth: 1,
    borderColor: colors.bg.beige,
  },
  tall: {
    paddingVertical: spacing[5],
    alignItems: 'center',
  },
  rowContent: {
    flexDirection: 'column',
    gap: spacing[1],
  },
  tallContent: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: spacing[1],
  },
  selected: {
    backgroundColor: colors.bg.beige,
    borderColor: colors.text.primary,
    borderWidth: 1.5,
  },
  unselected: {},
  pressed: {
    opacity: 0.85,
  },
  label: {
    fontWeight: '600',
  },
  description: {},
});
