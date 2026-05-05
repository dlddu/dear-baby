// FetusForm — A2 / B5 reusable input block for one fetus row.
//
// Fields:
//   - 태명 (선택, max 20)
//   - 성별 (남아 / 여아 / 미정) — chip row
//   - 임신 주차 (1~45)
//   - 예정일 (YYYY-MM-DD via DateTimePicker)
//
// The component is controlled — parent passes a ChildDraft slice and
// receives back patches. Validation lives at the screen level.

import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { Text } from '../Text';
import { colors } from '../../theme/colors';
import { radius } from '../../theme/radius';
import { spacing } from '../../theme/spacing';
import {
  defaultDueDate,
  formatKoreanDate,
  toIsoDate,
} from '../../utils/date';

import { ChipRow } from './ChipRow';

import type { ChildGender } from '../../api/types';

export type FetusFormValue = {
  display_name?: string;
  gender?: ChildGender;
  pregnancy_weeks?: number;
  due_date?: string; // YYYY-MM-DD
};

export type FetusFormProps = {
  value: FetusFormValue;
  onChange: (patch: Partial<FetusFormValue>) => void;
  testID?: string;
};

const GENDER_OPTIONS: { label: string; value: ChildGender }[] = [
  { label: '남아', value: 'male' },
  { label: '여아', value: 'female' },
  { label: '미정', value: 'undecided' },
];

export function FetusForm({ value, onChange, testID }: FetusFormProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const dueDate = value.due_date ? new Date(value.due_date) : null;

  const onDateChange = (event: DateTimePickerEvent, picked?: Date) => {
    if (Platform.OS === 'android') {
      setPickerOpen(false);
      if (event.type === 'set' && picked) {
        onChange({ due_date: toIsoDate(picked) });
      }
      return;
    }
    if (picked) onChange({ due_date: toIsoDate(picked) });
  };

  return (
    <View style={styles.form} testID={testID}>
      <View style={styles.field}>
        <Text variant="caption" color="secondary">
          태명 (선택)
        </Text>
        <TextInput
          value={value.display_name ?? ''}
          onChangeText={(t) => onChange({ display_name: t.slice(0, 20) })}
          placeholder="예: 튼튼이"
          placeholderTextColor={colors.text.muted}
          style={styles.input}
          testID={testID ? `${testID}-name` : undefined}
        />
      </View>
      <View style={styles.field}>
        <Text variant="caption" color="secondary">
          성별
        </Text>
        <ChipRow
          options={GENDER_OPTIONS}
          value={value.gender}
          onChange={(g) => onChange({ gender: g })}
          testID={testID ? `${testID}-gender` : undefined}
        />
      </View>
      <View style={styles.field}>
        <Text variant="caption" color="secondary">
          임신 주차
        </Text>
        <View style={styles.weekRow}>
          <TextInput
            value={value.pregnancy_weeks != null ? String(value.pregnancy_weeks) : ''}
            onChangeText={(t) => {
              const num = parseInt(t.replace(/[^0-9]/g, ''), 10);
              onChange({ pregnancy_weeks: Number.isFinite(num) ? Math.min(45, num) : undefined });
            }}
            keyboardType="number-pad"
            placeholder="0"
            placeholderTextColor={colors.text.muted}
            style={[styles.input, styles.weekInput]}
            testID={testID ? `${testID}-weeks` : undefined}
          />
          <Text variant="body" color="secondary">
            주
          </Text>
        </View>
      </View>
      <View style={styles.field}>
        <Text variant="caption" color="secondary">
          예정일
        </Text>
        <Pressable
          onPress={() => setPickerOpen(true)}
          style={[styles.input, styles.dateField]}
          accessibilityRole="button"
          testID={testID ? `${testID}-due` : undefined}
        >
          <Text variant="body" color={dueDate ? 'primary' : 'muted'}>
            {dueDate ? formatKoreanDate(dueDate) : '날짜 선택하기'}
          </Text>
        </Pressable>
      </View>
      {pickerOpen && (
        <DateTimePicker
          value={dueDate ?? defaultDueDate()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={onDateChange}
        />
      )}
      {Platform.OS === 'ios' && pickerOpen && (
        <Pressable
          onPress={() => setPickerOpen(false)}
          style={styles.pickerDone}
          accessibilityRole="button"
        >
          <Text variant="h3" color="coral">
            완료
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing[4] },
  field: { gap: spacing[2] },
  input: {
    borderWidth: 1,
    borderColor: colors.bg.beige,
    backgroundColor: colors.surface.ivory,
    borderRadius: radius.sm,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    color: colors.text.primary,
    fontSize: 15,
  },
  weekRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  weekInput: { flex: 1 },
  dateField: { justifyContent: 'center' },
  pickerDone: { alignSelf: 'center', paddingVertical: spacing[3] },
});
