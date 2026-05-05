// Stack of radio-style choice tiles used by Q1/Q2/A1/B1/B4/C1. The
// selected tile gets a darker border and the case-accent label color
// (matches the wireframes' selected-state outline).

import { Pressable, StyleSheet, View } from 'react-native';

import { caseAccent } from './caseTheme';
import type { CaseKind } from '../../api/onboarding';
import { Text } from '../Text';
import { colors } from '../../theme/colors';
import { radius } from '../../theme/radius';
import { spacing } from '../../theme/spacing';

export type ChoiceListOption<V extends string | number> = {
  value: V;
  label: string;
  hint?: string;
  testID?: string;
};

export type ChoiceListProps<V extends string | number> = {
  value: V | null;
  options: ChoiceListOption<V>[];
  onChange: (next: V) => void;
  caseKind?: CaseKind | null;
};

export function ChoiceList<V extends string | number>({
  value,
  options,
  onChange,
  caseKind,
}: ChoiceListProps<V>) {
  const accent = caseAccent(caseKind);
  return (
    <View style={styles.list}>
      {options.map((opt) => {
        const selected = value === opt.value;
        return (
          <Pressable
            key={String(opt.value)}
            onPress={() => onChange(opt.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            testID={opt.testID}
            style={({ pressed }) => [
              styles.tile,
              selected && {
                backgroundColor: accent.tint,
                borderColor: colors.text.primary,
                borderWidth: 1.5,
              },
              pressed && styles.pressed,
            ]}
          >
            <Text
              variant="body"
              color={selected ? 'primary' : 'primary'}
              style={selected ? styles.labelSelected : undefined}
            >
              {opt.label}
            </Text>
            {opt.hint ? (
              <Text variant="caption" color="muted">
                {opt.hint}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing[3] },
  tile: {
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.bg.beige,
    backgroundColor: colors.surface.ivory,
    paddingVertical: spacing[5],
    paddingHorizontal: spacing[4],
    alignItems: 'center',
    gap: 4,
  },
  pressed: { opacity: 0.85 },
  labelSelected: { fontWeight: '700' },
});
