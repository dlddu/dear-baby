// Calendar-picker bound to a "YYYY-MM-DD" string. Wraps the same
// @react-native-community/datetimepicker the legacy welcome.tsx used so
// behavior on iOS spinner / Android modal is identical. Parent owns
// the value and the open/close state.

import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { Text } from '../Text';
import { colors } from '../../theme/colors';
import { radius } from '../../theme/radius';
import { spacing } from '../../theme/spacing';
import { formatKoreanDate, toIsoDate } from '../../utils/date';

export type DateFieldProps = {
  label: string;
  value: string | null;
  onChange: (next: string) => void;
  minimumDate?: Date;
  maximumDate?: Date;
  testID?: string;
};

function parseValue(value: string | null): Date | null {
  if (!value) return null;
  const [y, m, d] = value.split('-').map((s) => Number(s));
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

export function DateField({
  label,
  value,
  onChange,
  minimumDate,
  maximumDate,
  testID,
}: DateFieldProps) {
  const parsed = parseValue(value);
  const [open, setOpen] = useState(false);

  const handleChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === 'android') {
      setOpen(false);
      if (event.type === 'set' && selected) {
        onChange(toIsoDate(selected));
      }
      return;
    }
    if (selected) {
      onChange(toIsoDate(selected));
    }
  };

  return (
    <View style={styles.wrap}>
      <Text variant="body" color="secondary">
        {label}
      </Text>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        testID={testID}
        style={({ pressed }) => [styles.field, pressed && styles.pressed]}
      >
        <Text variant="body" color={parsed ? 'primary' : 'muted'}>
          {parsed ? formatKoreanDate(parsed) : '날짜 선택하기'}
        </Text>
      </Pressable>
      {open && (
        <DateTimePicker
          value={parsed ?? new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          onChange={handleChange}
          testID={testID ? `${testID}-picker` : undefined}
        />
      )}
      {Platform.OS === 'ios' && open && (
        <Pressable
          onPress={() => setOpen(false)}
          style={styles.done}
          accessibilityRole="button"
          testID={testID ? `${testID}-done` : undefined}
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
  wrap: { gap: spacing[2] },
  field: {
    borderWidth: 1,
    borderColor: colors.bg.beige,
    backgroundColor: colors.surface.ivory,
    borderRadius: radius.sm,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
  },
  pressed: { opacity: 0.85 },
  done: { alignSelf: 'center', paddingVertical: spacing[3], paddingHorizontal: spacing[6] },
});
