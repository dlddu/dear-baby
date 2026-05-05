// Small wrapper that renders a caption-style label above a child input.
// Keeps every form field's label spacing identical without repeating
// the same View+Text+marginTop block in 6+ places.

import { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from '../Text';
import { spacing } from '../../theme/spacing';

export type LabeledFieldProps = {
  label: string;
  optional?: boolean;
  children: ReactNode;
};

export function LabeledField({ label, optional, children }: LabeledFieldProps) {
  return (
    <View style={styles.field}>
      <Text variant="caption" color="muted" style={styles.label}>
        {label}
        {optional ? ' (선택)' : ''}
      </Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing[2] },
  label: { marginBottom: 2 },
});
