// Parenting-child form — used by Case B's B2 step and Case C's C2 step.
// AC-006-03 / AC-006-04 inputs: 이름, 성별, 생년월일, 한줄 소개(선택),
// 사진(선택). 사진 업로드 흐름은 후속 작업이라 photo_s3_key 는 자리만
// 잡아두고 UI 는 placeholder 다.

import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '../Text';
import { colors } from '../../theme/colors';
import { radius } from '../../theme/radius';
import { spacing } from '../../theme/spacing';

import { DateField } from './DateField';
import { Field } from './Field';
import { GenderPicker, type Gender } from './GenderPicker';

export type ChildValue = {
  name: string;
  gender: Gender;
  birthDate: string | null;
  bio: string;
};

export type ChildFormProps = {
  value: ChildValue;
  onChange: (next: ChildValue) => void;
  testIDPrefix?: string;
};

export function ChildForm({ value, onChange, testIDPrefix = 'child' }: ChildFormProps) {
  const set = <K extends keyof ChildValue>(key: K, v: ChildValue[K]) =>
    onChange({ ...value, [key]: v });
  const today = new Date();

  return (
    <View style={styles.stack}>
      <View style={styles.photoRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="사진 추가 (선택)"
          testID={`${testIDPrefix}-photo`}
          style={({ pressed }) => [styles.photo, pressed && styles.pressed]}
        >
          <Text variant="h2" color="muted">
            📷
          </Text>
        </Pressable>
        <Text variant="caption" color="muted">
          사진 (선택)
        </Text>
      </View>
      <Field
        label="이름"
        placeholder="예: 서윤"
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
      <DateField
        label="생년월일"
        value={value.birthDate}
        onChange={(s) => set('birthDate', s)}
        maximumDate={today}
        testID={`${testIDPrefix}-birth-date`}
      />
      <Field
        label="한줄 소개 (선택)"
        placeholder="예: 잘 웃는 우리 아이"
        value={value.bio}
        onChangeText={(t) => set('bio', t)}
        testID={`${testIDPrefix}-bio`}
      />
    </View>
  );
}

export const emptyChildValue: ChildValue = {
  name: '',
  gender: 'unknown',
  birthDate: null,
  bio: '',
};

const styles = StyleSheet.create({
  stack: { gap: spacing[4] },
  gap: { gap: spacing[2] },
  photoRow: { alignItems: 'center', gap: spacing[2] },
  photo: {
    width: 80,
    height: 80,
    borderRadius: radius.md,
    backgroundColor: colors.bg.beige,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.85 },
});
