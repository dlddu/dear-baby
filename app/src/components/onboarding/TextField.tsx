// Themed text input matching the Card/Tile look used elsewhere in the
// app. Wrapping TextInput keeps every onboarding text field on the
// same border / background / padding without copy-paste.

import {
  StyleSheet,
  TextInput,
  type TextInputProps,
} from 'react-native';

import { colors } from '../../theme/colors';
import { radius } from '../../theme/radius';
import { spacing } from '../../theme/spacing';

export type TextFieldProps = TextInputProps;

export function TextField(props: TextFieldProps) {
  return (
    <TextInput
      placeholderTextColor={colors.text.muted}
      style={[styles.input, props.style]}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderColor: colors.bg.beige,
    borderRadius: radius.sm,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    backgroundColor: colors.surface.ivory,
    color: colors.text.primary,
    fontSize: 15,
    lineHeight: 22,
  },
});
