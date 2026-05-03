// Fetus information form — used by Case A's A2 step and Case B's B5
// step. The shape is the union of every field on AC-006-02 / AC-006-03
// fetus inputs: 태명(선택), 성별(미정 포함), 임신 주차, 예정일, 예정일
// 미정 체크박스. Parent owns state.

import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '../Text';
import { colors } from '../../theme/colors';
import { radius } from '../../theme/radius';
import { spacing } from '../../theme/spacing';

import { DateField } from './DateField';
import { Field } from './Field';
import { GenderPicker, type Gender } from './GenderPicker';

export type FetusValue = {
  name: string;
  gender: Gender;
  pregnancyWeek: string;
  dueDate: string | null;
  isDueDateUndecided: boolean;
};

export type FetusFormProps = {
  value: FetusValue;
  onChange: (next: FetusValue) => void;
  testIDPrefix?: string;
};

export function FetusForm({ value, onChange, testIDPrefix = 'fetus' }: FetusFormProps) {
  const set = <K extends keyof FetusValue>(key: K, v: FetusValue[K]) =>
    onChange({ ...value, [key]: v });

  return (
    <View style={styles.stack}>
      <Field
        label="태명 (선택)"
        placeholder="예: 콩이"
        value={value.name}
        onChangeText={(t) => set('name', t)}
        testID={`${testIDPrefix}-name`}
      />
      <View style={styles.gap}>
        <Text variant="body" color="secondary">
          성별
        </Text>
        <GenderPicker
          value={value.gender}
          onChange={(g) => set('gender', g)}
          testIDPrefix={`${testIDPrefix}-gender`}
        />
      </View>
      <Field
        label="임신 주차"
        placeholder="예: 12"
        keyboardType="number-pad"
        value={value.pregnancyWeek}
        onChangeText={(t) => set('pregnancyWeek', t.replace(/[^0-9]/g, ''))}
        testID={`${testIDPrefix}-week`}
      />
      <DateField
        label="아기를 만날 날"
        value={value.isDueDateUndecided ? null : value.dueDate}
        onChange={(s) => set('dueDate', s)}
        testID={`${testIDPrefix}-due-date`}
      />
      <Pressable
        onPress={() => {
          const next = !value.isDueDateUndecided;
          onChange({
            ...value,
            isDueDateUndecided: next,
            dueDate: next ? null : value.dueDate,
          });
        }}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: value.isDueDateUndecided }}
        accessibilityLabel="아직 정해지지 않았어요"
        testID={`${testIDPrefix}-due-date-undecided`}
        style={({ pressed }) => [styles.checkboxRow, pressed && styles.pressed]}
      >
        <Text variant="body" color={value.isDueDateUndecided ? 'coral' : 'secondary'}>
          {value.isDueDateUndecided ? '☑' : '□'}
        </Text>
        <Text variant="body" color="secondary">
          아직 정해지지 않았어요
        </Text>
      </Pressable>
    </View>
  );
}

export const emptyFetusValue: FetusValue = {
  name: '',
  gender: 'unknown',
  pregnancyWeek: '',
  dueDate: null,
  isDueDateUndecided: false,
};

const styles = StyleSheet.create({
  stack: { gap: spacing[4] },
  gap: { gap: spacing[2] },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingVertical: spacing[2],
    borderRadius: radius.sm,
  },
  pressed: { opacity: 0.7 },
});
