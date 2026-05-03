// Generic labeled input row used across the onboarding forms. Stripped-
// down because the funnel only needs single-line text + a label + an
// optional hint. Wraps RN TextInput; parents own the value.

import { StyleSheet, TextInput, type TextInputProps, View } from 'react-native';

import { Text } from '../Text';
import { colors } from '../../theme/colors';
import { radius } from '../../theme/radius';
import { spacing } from '../../theme/spacing';

export type FieldProps = TextInputProps & {
  label: string;
  hint?: string;
};

export function Field({ label, hint, style, ...rest }: FieldProps) {
  return (
    <View style={styles.wrap}>
      <Text variant="body" color="secondary" style={styles.label}>
        {label}
      </Text>
      <TextInput
        {...rest}
        placeholderTextColor={colors.text.muted}
        style={[styles.input, style]}
      />
      {hint ? (
        <Text variant="caption" color="muted" style={styles.hint}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing[2] },
  label: {},
  input: {
    borderWidth: 1,
    borderColor: colors.bg.beige,
    borderRadius: radius.sm,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    backgroundColor: colors.surface.ivory,
    color: colors.text.primary,
    fontSize: 15,
  },
  hint: {},
});
