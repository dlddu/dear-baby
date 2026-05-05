// Date picker tile shared by fetus due-date and child birth-date
// inputs.
//
// Behavior on each platform:
//   - Android: tap the field → system date dialog opens → user picks
//     and confirms in-system → onChange fires.
//   - iOS: tap the field → inline wheel spinner renders below the
//     field, with a value seeded on open so the form CTA enables
//     immediately. Tap the field again (toggle) to close. Tapping a
//     wheel column scrolls and commits onChange continuously.
//
// History note: an earlier iteration hosted the iOS spinner inside a
// `<Modal>` to avoid form-layout disruption, but Maestro on iOS cannot
// query testIDs or text inside RN's Modal (separate UIViewController).
// A second iteration used a "완료" Pressable below the inline spinner,
// but its on-screen position collided with the footer CTA, producing
// flake. The toggle-on-tap pattern keeps everything queryable in a
// single view hierarchy with no overlay.

import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

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

  const handleFieldPress = () => {
    if (open) {
      setOpen(false);
      return;
    }
    // iOS spinner only fires onChange when the user actually scrolls
    // a wheel. Without that the value would stay null and the form
    // CTA would stay disabled. Commit the seed value on open so a
    // plain "tap once to open, tap again to close" gesture is enough
    // for both real users and Maestro.
    if (Platform.OS === 'ios' && !value) {
      onChange(toIsoDate(defaultDate ?? new Date()));
    }
    setOpen(true);
  };

  const handleAndroidChange = (
    event: DateTimePickerEvent,
    selected?: Date,
  ) => {
    setOpen(false);
    if (event.type === 'set' && selected) {
      onChange(toIsoDate(selected));
    }
  };

  const handleIosChange = (_event: DateTimePickerEvent, selected?: Date) => {
    if (selected) onChange(toIsoDate(selected));
  };

  return (
    <View>
      <Pressable
        onPress={handleFieldPress}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
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
      {Platform.OS === 'android' && open && (
        <DateTimePicker
          value={dateObj ?? defaultDate ?? new Date()}
          mode="date"
          display="default"
          minimumDate={minDate}
          maximumDate={maxDate}
          onChange={handleAndroidChange}
          testID={testID ? `${testID}-picker` : undefined}
        />
      )}
      {Platform.OS === 'ios' && open && (
        <DateTimePicker
          value={dateObj ?? defaultDate ?? new Date()}
          mode="date"
          display="spinner"
          minimumDate={minDate}
          maximumDate={maxDate}
          onChange={handleIosChange}
          testID={testID ? `${testID}-picker` : undefined}
        />
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
});
