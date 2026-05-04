// ChildForm — 양육 아이 정보 입력 (B2 / C2 reusable form section).
//
// Fields (per docs/wireframes/onboarding.md):
//   - 사진          : 선택, PhotoPicker
//   - 이름          : 필수, TextInput
//   - 성별          : 필수, GenderPicker
//   - 생년월일      : 필수, DateTimePicker
//   - 한줄 소개     : 선택, TextInput

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
import { PhotoPicker } from './PhotoPicker';
import type { Gender } from '../../api/onboarding';

export type ChildFormValues = {
  display_name: string;
  gender: Gender | null;
  birth_date: string | null; // YYYY-MM-DD
  introduction: string;
  photo_tmp_key?: string;
  photo_local_uri?: string;
};

export type ChildFormProps = {
  values: ChildFormValues;
  onChange: (next: ChildFormValues) => void;
  testIDPrefix?: string;
};

const today = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};
const twentyYearsAgo = () => {
  const d = today();
  d.setFullYear(d.getFullYear() - 20);
  return d;
};

export function ChildForm({ values, onChange, testIDPrefix = 'child' }: ChildFormProps) {
  const [pickerOpen, setPickerOpen] = useState(false);

  const update = (patch: Partial<ChildFormValues>) =>
    onChange({ ...values, ...patch });

  const handlePickerChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === 'android') {
      setPickerOpen(false);
      if (event.type === 'set' && selected) {
        update({ birth_date: toIsoDate(selected) });
      }
      return;
    }
    if (selected) update({ birth_date: toIsoDate(selected) });
  };

  const birth = values.birth_date ? new Date(values.birth_date) : today();

  return (
    <View style={styles.wrap}>
      <View style={styles.photoWrap}>
        <PhotoPicker
          localUri={values.photo_local_uri}
          photoTmpKey={values.photo_tmp_key}
          onUploaded={({ photo_tmp_key, local_uri }) =>
            update({ photo_tmp_key, photo_local_uri: local_uri })
          }
          onClear={() => update({ photo_tmp_key: undefined, photo_local_uri: undefined })}
          testID={`${testIDPrefix}-photo`}
        />
      </View>

      <Field label="이름">
        <TextInput
          value={values.display_name}
          onChangeText={(t) => update({ display_name: t })}
          placeholder="아이 이름"
          placeholderTextColor={colors.text.muted}
          returnKeyType="done"
          style={styles.input}
          testID={`${testIDPrefix}-name`}
        />
      </Field>

      <Field label="성별">
        <GenderPicker
          value={values.gender}
          onChange={(g) => update({ gender: g })}
          testID={`${testIDPrefix}-gender`}
        />
      </Field>

      <Field label="생년월일">
        <Pressable
          onPress={() => setPickerOpen(true)}
          accessibilityRole="button"
          testID={`${testIDPrefix}-birth-date-field`}
          style={({ pressed }) => [styles.input, pressed && styles.inputPressed]}
        >
          <Text variant="body" color={values.birth_date ? 'primary' : 'muted'}>
            {values.birth_date ? formatKoreanDate(new Date(values.birth_date)) : '날짜 선택하기'}
          </Text>
        </Pressable>
        {pickerOpen && (
          <DateTimePicker
            value={birth}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            minimumDate={twentyYearsAgo()}
            maximumDate={today()}
            onChange={handlePickerChange}
            testID={`${testIDPrefix}-birth-date-picker`}
          />
        )}
        {Platform.OS === 'ios' && pickerOpen && (
          <Pressable
            onPress={() => {
              // See FetusForm for the rationale — commit the spinner's
              // displayed value when the user taps 완료 without
              // spinning the wheel.
              if (!values.birth_date) {
                update({ birth_date: toIsoDate(birth) });
              }
              setPickerOpen(false);
            }}
            accessibilityRole="button"
            testID={`${testIDPrefix}-birth-date-done`}
            style={styles.pickerDone}
          >
            <Text variant="h3" color="coral">
              완료
            </Text>
          </Pressable>
        )}
      </Field>

      <Field label="한줄 소개 (선택)">
        <TextInput
          value={values.introduction}
          onChangeText={(t) => update({ introduction: t })}
          placeholder="우리 아이를 한 줄로 소개해 주세요"
          placeholderTextColor={colors.text.muted}
          returnKeyType="done"
          style={styles.input}
          maxLength={120}
          testID={`${testIDPrefix}-intro`}
        />
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
  photoWrap: { alignItems: 'center' },
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
