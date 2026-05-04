// CountPicker — used on A1 / B1 / B4 / C1 to pick "how many children".
//
// Layout follows docs/wireframes/onboarding/*.svg:
//   pregnancy mode (A1, B4) — two square cards side by side. Each card
//   stacks an icon (1 circle for 단태, 2 circles for 다태), the headline
//   label (단태 / 다태), and a sub label (1명 / 2명 이상).
//
//   caregiver mode (B1, C1) — three full-width rows stacked vertically.
//   Each row shows N circle icons on the left followed by the count
//   label (1명 / 2명 / 3명 이상). The 3+ option commits a value of 3 to
//   the draft (the funnel's repeat loop treats it literally; users with
//   4+ children fill in the rest via AC-006-10).

import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '../Text';
import { colors } from '../../theme/colors';
import { radius } from '../../theme/radius';
import { spacing } from '../../theme/spacing';

import { useCaseAccent } from './CaseAccentTheme';

export type CountPickerProps = {
  value: number | null;
  onChange: (n: number) => void;
  // mode='caregiver' renders 1/2/3+ for caregiver counts (Case B/C).
  // mode='pregnancy' renders 단태/다태 for pregnancy counts (Case A/B).
  // 다태 commits 2.
  mode: 'caregiver' | 'pregnancy';
  testID?: string;
};

const caregiverOptions = [
  { label: '1명', value: 1 },
  { label: '2명', value: 2 },
  { label: '3명 이상', value: 3 },
];

const pregnancyOptions = [
  { label: '단태', sub: '1명', value: 1 },
  { label: '다태', sub: '2명 이상', value: 2 },
];

export function CountPicker({ value, onChange, mode, testID }: CountPickerProps) {
  const { color, tintColor } = useCaseAccent();

  if (mode === 'pregnancy') {
    return (
      <View style={styles.pregRow} testID={testID}>
        {pregnancyOptions.map((opt) => {
          const selected = value === opt.value;
          return (
            <Pressable
              key={opt.value}
              onPress={() => onChange(opt.value)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              testID={`${testID}-${opt.value}`}
              style={({ pressed }) => [
                styles.pregTile,
                selected && { borderColor: color, backgroundColor: tintColor },
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.pregIconWrap}>
                <FetusIcons count={opt.value} accent={color} selected={selected} />
              </View>
              <Text
                variant="body"
                color={selected ? 'primary' : 'primary'}
                style={[styles.pregLabel, selected && { color }]}
              >
                {opt.label}
              </Text>
              <Text variant="caption" color="muted" style={styles.pregSub}>
                {opt.sub}
              </Text>
            </Pressable>
          );
        })}
      </View>
    );
  }

  return (
    <View style={styles.cgCol} testID={testID}>
      {caregiverOptions.map((opt) => {
        const selected = value === opt.value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            testID={`${testID}-${opt.value}`}
            style={({ pressed }) => [
              styles.cgRow,
              selected && { borderColor: color, backgroundColor: tintColor },
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.cgIconWrap}>
              <KidIcons count={opt.value} accent={color} selected={selected} />
            </View>
            <Text
              variant="body"
              color="primary"
              style={[styles.cgLabel, selected && { color }]}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function FetusIcons({
  count,
  accent,
  selected,
}: {
  count: 1 | 2 | number;
  accent: string;
  selected: boolean;
}) {
  const fill = selected ? accent : colors.bg.beige;
  if (count === 1) {
    return <View style={[styles.fetusDot, { backgroundColor: fill }]} />;
  }
  return (
    <View style={styles.fetusPair}>
      <View style={[styles.fetusDotSm, { backgroundColor: fill }]} />
      <View
        style={[
          styles.fetusDotSm,
          styles.fetusDotOverlap,
          { backgroundColor: fill },
        ]}
      />
    </View>
  );
}

function KidIcons({
  count,
  accent,
  selected,
}: {
  count: number;
  accent: string;
  selected: boolean;
}) {
  const fill = selected ? accent : colors.bg.beige;
  return (
    <View style={styles.kidRow}>
      {Array.from({ length: Math.min(count, 3) }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.kidDot,
            i > 0 && styles.kidDotOverlap,
            { backgroundColor: fill },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  // Pregnancy mode — 2-up cards
  pregRow: { flexDirection: 'row', gap: spacing[3] },
  pregTile: {
    flex: 1,
    minHeight: 132,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: colors.bg.beige,
    backgroundColor: colors.surface.ivory,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[4],
    gap: spacing[2],
  },
  pregIconWrap: {
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pregLabel: { fontWeight: '700' },
  pregSub: { textAlign: 'center' },
  fetusDot: { width: 28, height: 28, borderRadius: 14 },
  fetusPair: { flexDirection: 'row' },
  fetusDotSm: { width: 22, height: 22, borderRadius: 11 },
  fetusDotOverlap: { marginLeft: -8 },

  // Caregiver mode — vertical full-width list
  cgCol: { gap: spacing[3] },
  cgRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
    minHeight: 64,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: colors.bg.beige,
    backgroundColor: colors.surface.ivory,
    paddingHorizontal: spacing[5],
  },
  cgIconWrap: { width: 64, alignItems: 'flex-start' },
  cgLabel: { fontWeight: '700' },
  kidRow: { flexDirection: 'row' },
  kidDot: { width: 18, height: 18, borderRadius: 9 },
  kidDotOverlap: { marginLeft: -6 },

  pressed: { opacity: 0.85 },
});
