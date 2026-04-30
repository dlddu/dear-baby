// Primary / Secondary button — see docs/design-system/components.md
//
// - Primary: Warm Coral 배경 + 흰 글씨 + coral tint shadow
// - Secondary: Cream White 배경 + beige 테두리 + 진한 글씨
// 라운드 12 (radius.sm), 수직 패딩 14.

import {
  Pressable,
  type PressableProps,
  StyleSheet,
  View,
} from 'react-native';

import { colors } from '../theme/colors';
import { radius } from '../theme/radius';
import { shadows } from '../theme/shadows';
import { spacing } from '../theme/spacing';

import { Text } from './Text';

type Variant = 'primary' | 'secondary';

export type ButtonProps = Omit<PressableProps, 'children' | 'style'> & {
  title: string;
  variant?: Variant;
  /** 좌측 이모지/아이콘 텍스트 (예: `🎙`, `✏️`) */
  leading?: string;
  fullWidth?: boolean;
};

export function Button({
  title,
  variant = 'primary',
  leading,
  fullWidth,
  disabled,
  ...rest
}: ButtonProps) {
  const isPrimary = variant === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      // Pin the a11y label to the title so iOS Maestro / VoiceOver pick
      // up "업로드" / "삭제" cleanly. Without this, multi-Text children
      // (leading icon + label) inside a Pressable can fail to surface
      // their text on iOS, making text-based selectors miss the button.
      accessibilityLabel={title}
      disabled={disabled}
      {...rest}
      style={({ pressed }) => [
        styles.base,
        isPrimary ? styles.primary : styles.secondary,
        fullWidth && styles.fullWidth,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <View style={styles.content}>
        {leading ? (
          <Text
            variant="body"
            color={isPrimary ? 'onPrimary' : 'primary'}
            style={styles.leading}
          >
            {leading}
          </Text>
        ) : null}
        <Text
          variant="body"
          color={isPrimary ? 'onPrimary' : 'primary'}
          style={styles.label}
        >
          {title}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.sm,
    paddingVertical: 14,
    paddingHorizontal: spacing[5],
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: {
    backgroundColor: colors.primary.coral,
    ...shadows.coral,
  },
  secondary: {
    backgroundColor: colors.bg.cream,
    borderWidth: 1,
    borderColor: colors.bg.beige,
  },
  fullWidth: { alignSelf: 'stretch' },
  pressed: { opacity: 0.9 },
  disabled: { opacity: 0.5 },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  leading: { fontSize: 16 },
  label: { fontWeight: '600' },
});
