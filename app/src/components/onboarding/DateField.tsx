// Date picker tile shared by fetus due-date and child birth-date
// inputs.
//
// On Android we lean on the platform's native date dialog (calendar)
// which renders as a system modal — no layout disruption.
//
// On iOS the wheel spinner has to live somewhere; rendering it inline
// inside the form's ScrollView puts the "완료" tap target near the
// fixed footer CTA, and the two interactive elements end up close
// enough on-screen that taps land on the wrong one (recurring E2E
// flake). To eliminate that whole class of layout collisions we host
// the spinner inside a bottom-sheet `<Modal>` that's outside the form
// hierarchy. The form layout never moves while the picker is open.

import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useState } from 'react';
import {
  Modal,
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

  const handleOpen = () => {
    // iOS spinner fires onChange only after the user scrolls a wheel.
    // Without a scroll the value stays null and the form CTA stays
    // disabled — both a real UX papercut and a perpetual source of
    // E2E flake. Commit the seed value (current, defaultDate, today)
    // on open so a plain "완료" tap progresses.
    if (Platform.OS === 'ios' && !value) {
      const seed = defaultDate ?? new Date();
      onChange(toIsoDate(seed));
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
        onPress={handleOpen}
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
      {Platform.OS === 'ios' && (
        <Modal
          transparent
          visible={open}
          animationType="fade"
          onRequestClose={() => setOpen(false)}
        >
          <Pressable
            style={styles.backdrop}
            onPress={() => setOpen(false)}
            accessibilityLabel="닫기"
          >
            {/* Stop propagation so taps inside the sheet don't dismiss it. */}
            <Pressable style={styles.sheet} onPress={() => undefined}>
              <DateTimePicker
                value={dateObj ?? defaultDate ?? new Date()}
                mode="date"
                display="spinner"
                minimumDate={minDate}
                maximumDate={maxDate}
                onChange={handleIosChange}
                testID={testID ? `${testID}-picker` : undefined}
              />
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
            </Pressable>
          </Pressable>
        </Modal>
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
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface.ivory,
    paddingTop: spacing[4],
    paddingBottom: spacing[6],
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    alignItems: 'stretch',
  },
  done: {
    alignSelf: 'center',
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[6],
  },
});
