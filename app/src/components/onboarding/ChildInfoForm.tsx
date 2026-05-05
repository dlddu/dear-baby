// ChildInfoForm bundles the inputs for an already-born child:
// 사진(선택)·이름·성별·생년월일·한줄 소개. Used by B2 and C2.
//
// 와이어프레임: docs/wireframes/onboarding/case-{b,c}.svg.

import { StyleSheet, TextInput, View } from 'react-native';

import type { Gender } from '../../api/onboarding';
import { colors } from '../../theme/colors';
import { radius } from '../../theme/radius';
import { spacing } from '../../theme/spacing';
import { Text } from '../Text';

import { DateField } from './DateField';
import { GenderToggle } from './GenderToggle';
import { PhotoPicker } from './PhotoPicker';

export type ChildInfoValue = {
  display_name?: string;
  gender?: Gender;
  birth_date?: string;
  introduction?: string;
  photo_local_uri?: string;
  photo_tmp_key?: string;
};

export type ChildInfoFormProps = {
  value: ChildInfoValue;
  onChange: (patch: Partial<ChildInfoValue>) => void;
  testIDPrefix?: string;
};

export function ChildInfoForm({
  value,
  onChange,
  testIDPrefix = 'child-info',
}: ChildInfoFormProps) {
  return (
    <View style={styles.wrapper}>
      <PhotoPicker
        photoLocalUri={value.photo_local_uri}
        photoTmpKey={value.photo_tmp_key}
        onPickedLocal={(uri) => onChange({ photo_local_uri: uri })}
        onUploaded={(key, uri) =>
          onChange({ photo_tmp_key: key, photo_local_uri: uri })
        }
      />

      <View style={styles.field}>
        <Text variant="caption" color="muted">이름</Text>
        <TextInput
          value={value.display_name ?? ''}
          onChangeText={(v) => onChange({ display_name: v })}
          placeholder="이름을 알려주세요"
          placeholderTextColor={colors.text.muted}
          style={styles.input}
          testID={`${testIDPrefix}-name`}
        />
      </View>

      <View style={styles.field}>
        <Text variant="caption" color="muted">성별</Text>
        <GenderToggle value={value.gender} onChange={(g) => onChange({ gender: g })} />
      </View>

      <DateField
        label="생년월일"
        value={value.birth_date}
        onChange={(iso) => onChange({ birth_date: iso })}
        pastOnly
        testID={`${testIDPrefix}-birth-date`}
      />

      <View style={styles.field}>
        <Text variant="caption" color="muted">한줄 소개 (선택)</Text>
        <TextInput
          value={value.introduction ?? ''}
          onChangeText={(v) => onChange({ introduction: v })}
          placeholder="아이를 한 줄로 소개해 주세요"
          placeholderTextColor={colors.text.muted}
          style={[styles.input, styles.multiline]}
          multiline
          numberOfLines={2}
          testID={`${testIDPrefix}-introduction`}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing[5] },
  field: { gap: spacing[2] },
  input: {
    borderWidth: 1,
    borderColor: colors.bg.beige,
    backgroundColor: colors.surface.ivory,
    borderRadius: radius.sm,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[3],
    color: colors.text.primary,
    fontSize: 15,
  },
  multiline: { minHeight: 56, textAlignVertical: 'top' },
});
