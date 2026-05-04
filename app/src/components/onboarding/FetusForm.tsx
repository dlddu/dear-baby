// FetusForm — 태아 정보 입력 (A2 / B5 reusable form section).
//
// Fields (per docs/wireframes/onboarding.md):
//   - 태명          : 선택, TextInput
//   - 성별          : 필수, GenderPicker (미정 포함)
//   - 임신 주차      : 필수, TextInput numeric (1–45)
//   - 예정일        : 필수, DateTimePicker
//
// The component is fully controlled — the parent owns the values and
// onChange. This keeps the funnel screen in charge of when to persist
// the draft (typically: on every field change, debounced).

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
import { formatKoreanDate, toIsoDate } from '../../utils/date';

import { GenderPicker } from './GenderPicker';
import type { Gender } from '../../api/onboarding';

export type FetusFormValues = {
  display_name: string;
  gender: Gender | null;
  pregnancy_weeks: string; // raw text — cast to number on submit
  due_date: string | null; // YYYY-MM-DD
};

export type FetusFormProps = {
  values: FetusFormValues;
  onChange: (next: FetusFormValues) => void;
  testIDPrefix?: string;
};

const today = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};
const oneYearFromToday = () => {
  const d = today();
  d.setDate(d.getDate() + 7 * 45);
  return d;
};

export function FetusForm({ values, onChange, testIDPrefix = 'fetus' }: FetusFormProps) {
  const [pickerOpen, setPickerOpen] = useState(false);

  const update = (patch: Partial<FetusFormValues>) =>
    onChange({ ...values, ...patch });

  const handlePickerChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === 'android') {
      setPickerOpen(false);
      if (event.type === 'set' && selected) {
        update({ due_date: toIsoDate(selected) });
      }
      return;
    }
    if (selected) update({ due_date: toIsoDate(selected) });
  };

  const dueDate = values.due_date ? new Date(values.due_date) : today();

  return (
    <View style={styles.wrap}>
      <Field label="태명 (선택)">
        <TextInput
          value={values.display_name}
          onChangeText={(t) => update({ display_name: t })}
          placeholder="아기에게 부르는 이름이 있다면"
          placeholderTextColor={colors.text.muted}
          style={styles.input}
          testID={`${testIDPrefix}-display-name`}
        />
      </Field>

      <Field label="성별">
        <GenderPicker
          value={values.gender}
          onChange={(g) => update({ gender: g })}
          testID={`${testIDPrefix}-gender`}
        />
      </Field>

      <Field label="임신 주차">
        <TextInput
          value={values.pregnancy_weeks}
          onChangeText={(t) => update({ pregnancy_weeks: t.replace(/[^\d]/g, '') })}
          placeholder="예: 17"
          placeholderTextColor={colors.text.muted}
          keyboardType="number-pad"
          maxLength={2}
          style={styles.input}
          testID={`${testIDPrefix}-weeks`}
        />
      </Field>

      <Field label="아기를 만날 예정일">
        <Pressable
          onPress={() => setPickerOpen(true)}
          accessibilityRole="button"
          testID={`${testIDPrefix}-due-date-field`}
          style={({ pressed }) => [styles.input, pressed && styles.inputPressed]}
        >
          <Text variant="body" color={values.due_date ? 'primary' : 'muted'}>
            {values.due_date ? formatKoreanDate(new Date(values.due_date)) : '날짜 선택하기'}
          </Text>
        </Pressable>
        {pickerOpen && (
          <DateTimePicker
            value={dueDate}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            minimumDate={today()}
            maximumDate={oneYearFromToday()}
            onChange={handlePickerChange}
            testID={`${testIDPrefix}-due-date-picker`}
          />
        )}
        {Platform.OS === 'ios' && pickerOpen && (
          <Pressable
            onPress={() => setPickerOpen(false)}
            accessibilityRole="button"
            testID={`${testIDPrefix}-due-date-done`}
            style={styles.pickerDone}
          >
            <Text variant="h3" color="coral">
              완료
            </Text>
          </Pressable>
        )}
      </Field>
    </View>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text variant="caption" color="secondary" style={styles.fieldLabel}>
        {label}
      </Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing[5] },
  field: { gap: spacing[2] },
  fieldLabel: { fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderColor: colors.bg.beige,
    backgroundColor: colors.bg.cream,
    borderRadius: radius.sm,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    fontSize: 16,
    color: colors.text.primary,
  },
  inputPressed: { opacity: 0.85 },
  pickerDone: { alignSelf: 'center', paddingVertical: spacing[2] },
});
