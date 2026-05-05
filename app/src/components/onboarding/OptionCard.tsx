// OptionCard is the tappable selectable surface used across the
// case-branching onboarding (e.g. Q1 예/아니요, A1 단태/다태, A3 기록
// 목적, B6 아이별 목적). When `selected` it picks up the case accent
// border + tinted background.

import { Keyboard, Pressable, StyleSheet, View, type PressableProps } from 'react-native';

import { colors } from '../../theme/colors';
import { radius } from '../../theme/radius';
import { spacing } from '../../theme/spacing';

import { useCaseAccent } from './CaseAccentTheme';

export type OptionCardProps = Omit<PressableProps, 'children' | 'style'> & {
  selected?: boolean;
  children: React.ReactNode;
  /** Tighter padding for inline option lists. Default 'md'. */
  padding?: 'sm' | 'md';
};

export function OptionCard({
  selected = false,
  padding = 'md',
  children,
  onPress,
  ...rest
}: OptionCardProps) {
  const accent = useCaseAccent();
  const padValue = padding === 'sm' ? spacing[3] : spacing[4];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={(e) => {
        // Blur any focused TextInput so the soft keyboard goes away
        // before the parent screen's footer CTA needs to be tappable.
        // Cheap on screens without a keyboard up.
        Keyboard.dismiss();
        onPress?.(e);
      }}
      {...rest}
      style={({ pressed }) => [
        styles.base,
        {
          padding: padValue,
          backgroundColor: selected ? accent.bg : colors.surface.ivory,
          borderColor: selected ? accent.bar : colors.bg.beige,
          borderWidth: selected ? 2 : 1,
        },
        pressed && styles.pressed,
      ]}
    >
      <View>{children}</View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.md,
  },
  pressed: { opacity: 0.85 },
});
