// DateField — 와이어프레임의 예정일·생년월일 입력 필드. iOS 는 spinner,
// Android 는 modal 데이트픽커를 띄운다. 별도 텍스트 입력 없이 탭으로만
// 연다 (오타 방지 + 직관성).

import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { Text } from '../Text';
import { colors } from '../../theme/colors';
import { radius } from '../../theme/radius';
import { spacing } from '../../theme/spacing';
import { formatKoreanDate } from '../../utils/date';

export type DateFieldProps = {
  label: string;
  caption?: string;
  /** YYYY-MM-DD or null. */
  value: string | null;
  onChange: (iso: string) => void;
  /** 기본 픽커 시작일. value 가 null 일 때 사용. */
  fallback?: Date;
  minimumDate?: Date;
  maximumDate?: Date;
  placeholder?: string;
  testID?: string;
};

function parseISO(s: string): Date | null {
  if (!s) return null;
  const d = new Date(s + 'T00:00:00');
  return isNaN(d.getTime()) ? null : d;
}

function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function DateField({
  label,
  caption,
  value,
  onChange,
  fallback,
  minimumDate,
  maximumDate,
  placeholder = '날짜 선택하기',
  testID,
}: DateFieldProps) {
  const [open, setOpen] = useState(false);
  const current = parseISO(value ?? '');

  const handle = (event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === 'android') {
      setOpen(false);
      if (event.type === 'set' && selected) {
        onChange(toISO(selected));
      }
      return;
    }
    if (selected) onChange(toISO(selected));
  };

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
      <Pressable
        accessibilityRole="button"
        onPress={() => setOpen(true)}
        testID={testID}
        style={({ pressed }) => [styles.field, pressed && { opacity: 0.85 }]}
      >
        <Text
          variant="body"
          color={current ? 'primary' : 'muted'}
          style={styles.text}
        >
          {current ? formatKoreanDate(current) : placeholder}
        </Text>
      </Pressable>
      {open ? (
        <DateTimePicker
          value={current ?? fallback ?? new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          onChange={handle}
        />
      ) : null}
      {Platform.OS === 'ios' && open ? (
        <Pressable
          onPress={() => setOpen(false)}
          accessibilityRole="button"
          style={styles.done}
          testID="onboarding-date-picker-done"
        >
          <Text variant="h3" color="coral">
            완료
          </Text>
        </Pressable>
      ) : null}
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
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[3],
  },
  text: {},
  done: {
    alignSelf: 'center',
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[6],
  },
});
