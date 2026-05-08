// NumberPicker — 1·2·3+ 정사각형 카운트 선택기.
// docs/mockups/source/src/screens/Onboarding.tsx 의 `NumberPicker` 와 1:1 매핑.
//
// 온보딩 Case A·B·C 의 "임신 아이 수" / "양육 아이 수" 화면에서 공통으로
// 쓴다. 선택 시 Coral 배경 + 흰 글씨 + elevated 그림자, 비선택 시 Ivory
// 배경 + 진한 글씨 + soft 그림자.

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

export type NumberPickerValue = 1 | 2 | 3;

export type NumberPickerProps = {
  value: NumberPickerValue | null;
  onChange: (value: NumberPickerValue) => void;
  /** 1, 2, 3 옵션의 보조 라벨. 기본값: ["단태아", "쌍둥이", "세쌍둥이+"] */
  labels?: [string, string, string];
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const DEFAULT_LABELS: [string, string, string] = [
  '단태아',
  '쌍둥이',
  '세쌍둥이+',
];

export function NumberPicker({
  value,
  onChange,
  labels = DEFAULT_LABELS,
  style,
  testID,
}: NumberPickerProps) {
  return (
    <View style={[styles.row, style]} testID={testID}>
      {([1, 2, 3] as const).map((n, i) => {
        const selected = value === n;
        return (
          <Pressable
            key={n}
            accessibilityRole="button"
            accessibilityLabel={`${n === 3 ? '3+' : n} ${labels[i]}`}
            accessibilityState={{ selected }}
            onPress={() => onChange(n)}
            testID={testID ? `${testID}-${n}` : undefined}
            style={({ pressed }) => [
              styles.cell,
              selected ? styles.cellSelected : styles.cellIdle,
              pressed && styles.cellPressed,
            ]}
          >
            <Text
              variant="display"
              color={selected ? 'onPrimary' : 'primary'}
              style={styles.number}
            >
              {n === 3 ? '3+' : String(n)}
            </Text>
            <Text
              variant="caption"
              color={selected ? 'onPrimary' : 'secondary'}
              style={styles.label}
            >
              {labels[i]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  cell: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[1],
  },
  cellIdle: {
    backgroundColor: colors.surface.ivory,
    ...shadows.soft,
  },
  cellSelected: {
    backgroundColor: colors.primary.coral,
    ...shadows.card,
  },
  cellPressed: { opacity: 0.9 },
  number: {
    fontWeight: '700',
  },
  label: {
    fontWeight: '500',
  },
});
