// ChildForm — B2 / C2 reusable input block for one parenting child.
//
// Fields:
//   - Photo (optional, via PhotoPicker)
//   - 이름 (required, max 20)
//   - 성별 (남아 / 여아 / 미정)
//   - 생년월일 (YYYY-MM-DD via DateTimePicker)
//   - 한줄 소개 (optional, max 80)

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
  formatKoreanDate,
  toIsoDate,
} from '../../utils/date';

import { ChipRow } from './ChipRow';
import { PhotoPicker } from './PhotoPicker';

import type { ChildGender } from '../../api/types';

export type ChildFormValue = {
  display_name?: string;
  gender?: ChildGender;
  birth_date?: string;
  introduction?: string;
  photo_tmp_key?: string;
  photo_local_uri?: string;
};

export type ChildFormProps = {
  value: ChildFormValue;
  onChange: (patch: Partial<ChildFormValue>) => void;
  onPhotoError?: (msg: string) => void;
  testID?: string;
};

const GENDER_OPTIONS: { label: string; value: ChildGender }[] = [
  { label: '남아', value: 'male' },
  { label: '여아', value: 'female' },
  { label: '미정', value: 'undecided' },
];

export function ChildForm({
  value,
  onChange,
  onPhotoError,
  testID,
}: ChildFormProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const birth = value.birth_date ? new Date(value.birth_date) : null;

  // 픽커 진입 시 기본 생년월일(오늘)을 미리 stamp 한다. iOS spinner mode 가
  // 사용자의 spin 없이는 onChange 를 발화시키지 않아 그대로 닫으면
  // birth_date 가 비어 검증이 실패하는 문제(FetusForm 와 같은 이유) 회피.
  const openPicker = () => {
    if (!value.birth_date) {
      onChange({ birth_date: toIsoDate(new Date()) });
    }
    setPickerOpen(true);
  };

  const onDateChange = (event: DateTimePickerEvent, picked?: Date) => {
    if (Platform.OS === 'android') {
      setPickerOpen(false);
      if (event.type === 'set' && picked) {
        onChange({ birth_date: toIsoDate(picked) });
      }
      return;
    }
    if (picked) onChange({ birth_date: toIsoDate(picked) });
  };

  return (
    <View style={styles.form} testID={testID}>
      <PhotoPicker
        photoTmpKey={value.photo_tmp_key ?? null}
        localUri={value.photo_local_uri ?? null}
        onUploaded={(key, uri) =>
          onChange({ photo_tmp_key: key, photo_local_uri: uri })
        }
        onError={onPhotoError}
        testID={testID ? `${testID}-photo` : undefined}
      />
      <View style={styles.field}>
        <Text variant="caption" color="secondary">
          이름
        </Text>
        <TextInput
          value={value.display_name ?? ''}
          onChangeText={(t) => onChange({ display_name: t.slice(0, 20) })}
          placeholder="예: 지유"
          placeholderTextColor={colors.text.muted}
          style={styles.input}
          testID={testID ? `${testID}-name` : undefined}
        />
      </View>
      <View style={styles.field}>
        <Text variant="caption" color="secondary">
          성별 · 생년월일
        </Text>
        <ChipRow
          options={GENDER_OPTIONS}
          value={value.gender}
          onChange={(g) => onChange({ gender: g })}
          testID={testID ? `${testID}-gender` : undefined}
        />
        <Pressable
          onPress={openPicker}
          style={[styles.input, styles.dateField]}
          accessibilityRole="button"
          testID={testID ? `${testID}-birth` : undefined}
        >
          <Text variant="body" color={birth ? 'primary' : 'muted'}>
            {birth ? formatKoreanDate(birth) : '생년월일 선택하기'}
          </Text>
        </Pressable>
      </View>
      <View style={styles.field}>
        <Text variant="caption" color="secondary">
          한줄 소개 (선택)
        </Text>
        <TextInput
          value={value.introduction ?? ''}
          onChangeText={(t) => onChange({ introduction: t.slice(0, 80) })}
          placeholder="예: 잘 웃는 첫째"
          placeholderTextColor={colors.text.muted}
          multiline
          numberOfLines={2}
          style={[styles.input, styles.intro]}
          testID={testID ? `${testID}-intro` : undefined}
        />
      </View>
      {pickerOpen && (
        <DateTimePicker
          value={birth ?? new Date(2024, 0, 1)}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          maximumDate={new Date()}
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
  intro: { minHeight: 64, textAlignVertical: 'top' },
  dateField: { justifyContent: 'center' },
  pickerDone: { alignSelf: 'center', paddingVertical: spacing[3] },
});
