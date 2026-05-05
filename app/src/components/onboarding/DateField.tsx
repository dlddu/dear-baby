// DateField is a tappable label-over-bordered-input that opens the
// platform-native date picker. Used on A2/B5 (예정일) and B2/C2
// (생년월일).

import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { colors } from '../../theme/colors';
import { radius } from '../../theme/radius';
import { spacing } from '../../theme/spacing';
import { formatKoreanDate, toIsoDate } from '../../utils/date';
import { Text } from '../Text';

export type DateFieldProps = {
  label: string;
  /** ISO date YYYY-MM-DD. */
  value?: string;
  onChange: (iso: string) => void;
  /** When true the picker can't go past today (생년월일). */
  pastOnly?: boolean;
  /** When true the picker can't go before today (예정일). */
  futureOnly?: boolean;
  testID?: string;
};

function parseIso(s?: string): Date | null {
  if (!s) return null;
  const parts = s.split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null;
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

export function DateField({
  label,
  value,
  onChange,
  pastOnly,
  futureOnly,
  testID,
}: DateFieldProps) {
  const [open, setOpen] = useState(false);
  const date = parseIso(value);
  const today = new Date();
  const min = futureOnly ? today : undefined;
  const max = pastOnly ? today : undefined;

  const handleChange = (event: DateTimePickerEvent, selected?: Date) => {
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
    <View style={styles.wrapper}>
      <Text variant="caption" color="muted" style={styles.label}>
        {label}
      </Text>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        testID={testID}
        style={({ pressed }) => [styles.field, pressed && styles.pressed]}
      >
        <Text variant="body" color={date ? 'primary' : 'muted'}>
          {date ? formatKoreanDate(date) : '날짜 선택하기'}
        </Text>
      </Pressable>
      {open ? (
        <DateTimePicker
          value={date ?? today}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          minimumDate={min}
          maximumDate={max}
          onChange={handleChange}
          testID={testID ? `${testID}-picker` : undefined}
        />
      ) : null}
      {Platform.OS === 'ios' && open ? (
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
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing[2] },
  label: {},
  field: {
    borderWidth: 1,
    borderColor: colors.bg.beige,
    backgroundColor: colors.surface.ivory,
    borderRadius: radius.sm,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[3],
  },
  pressed: { opacity: 0.85 },
  done: { alignSelf: 'center', paddingVertical: spacing[3] },
});
