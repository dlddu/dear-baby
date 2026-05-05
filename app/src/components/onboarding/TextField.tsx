// TextField — 단순 한 줄 입력 컴포넌트. 와이어프레임의 이름·태명·
// 한줄 소개·임신 주차 입력 등 모든 텍스트 필드를 일관되게 처리한다.

import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { Text } from '../Text';
import { colors } from '../../theme/colors';
import { radius } from '../../theme/radius';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';

export type TextFieldProps = Omit<TextInputProps, 'style'> & {
  label: string;
  /** 라벨 옆 (선택) 표기 등. */
  caption?: string;
  /** 입력 칸 우측 보조 텍스트(예: "주", 캘린더 아이콘). */
  trailing?: string;
  /** Multiline 한줄 소개 등을 위한 옵션. */
  multiline?: boolean;
  testID?: string;
};

export function TextField({
  label,
  caption,
  trailing,
  multiline,
  testID,
  ...rest
}: TextFieldProps) {
  return (
    <View style={styles.wrap}>
      <View style={styles.labelRow}>
        <Text variant="caption" color="secondary" style={styles.label}>
          {label}
        </Text>
        {caption ? (
          <Text variant="caption" color="muted">
            {caption}
          </Text>
        ) : null}
      </View>
      <View style={[styles.field, multiline && styles.fieldMultiline]}>
        <TextInput
          {...rest}
          multiline={multiline}
          style={[styles.input, multiline && styles.inputMultiline]}
          placeholderTextColor={colors.text.muted}
          testID={testID}
        />
        {trailing ? (
          <Text variant="caption" color="muted" style={styles.trailing}>
            {trailing}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing[2] },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between' },
  label: { fontWeight: '600' },
  field: {
    borderWidth: 1,
    borderColor: colors.bg.beige,
    backgroundColor: colors.surface.ivory,
    borderRadius: radius.sm,
    paddingHorizontal: spacing[3],
    flexDirection: 'row',
    alignItems: 'center',
  },
  fieldMultiline: {
    paddingVertical: spacing[2],
    minHeight: 80,
    alignItems: 'flex-start',
  },
  input: {
    ...typography.body,
    color: colors.text.primary,
    flex: 1,
    paddingVertical: spacing[3],
  },
  inputMultiline: {
    paddingVertical: 0,
    height: undefined,
    textAlignVertical: 'top',
  },
  trailing: {
    paddingLeft: spacing[2],
  },
});
