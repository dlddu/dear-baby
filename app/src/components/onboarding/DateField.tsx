// Date picker tile shared by fetus due-date and child birth-date
// inputs. Wraps the platform date picker the same way welcome.tsx
// used to (Android modal vs. iOS inline spinner).

import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { Text } from '../Text';
import { formatKoreanDate, toIsoDate } from '../../utils/date';
import { colors } from '../../theme/colors';
import { radius } from '../../theme/radius';
import { spacing } from '../../theme/spacing';

export type DateFieldProps = {
  value: string | null; // YYYY-MM-DD
  onChange: (next: string | null) => void;
  /** Optional bounds; e.g. fetus due date should be in the future. */
  minDate?: Date;
  maxDate?: Date;
  /** Default date shown when the picker opens with no value. */
  defaultDate?: Date;
  placeholder?: string;
  testID?: string;
};

function parseISO(s: string | null): Date | null {
  if (!s) return null;
  const [y, m, d] = s.split('-').map((x) => Number(x));
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

export function DateField({
  value,
  onChange,
  minDate,
  maxDate,
  defaultDate,
  placeholder = '날짜 선택하기',
  testID,
}: DateFieldProps) {
  const [open, setOpen] = useState(false);
  const dateObj = parseISO(value);

  const handlePickerChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === 'android') {
      setOpen(false);
      if (event.type === 'set' && selected) {
        onChange(toIsoDate(selected));
      }
      return;
    }
    if (selected) onChange(toIsoDate(selected));
  };

  return (
    <View>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        testID={testID}
        style={({ pressed }) => [
          styles.field,
          pressed && styles.fieldPressed,
        ]}
      >
        <Text variant="body" color={dateObj ? 'primary' : 'muted'}>
          {dateObj ? formatKoreanDate(dateObj) : placeholder}
        </Text>
      </Pressable>
      {open && (
        <DateTimePicker
          value={dateObj ?? defaultDate ?? new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          minimumDate={minDate}
          maximumDate={maxDate}
          onChange={handlePickerChange}
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
  field: {
    borderWidth: 1,
    borderColor: colors.bg.beige,
    backgroundColor: colors.surface.ivory,
    borderRadius: radius.sm,
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[4],
  },
  fieldPressed: { opacity: 0.85 },
  done: {
    alignSelf: 'center',
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[6],
  },
});
