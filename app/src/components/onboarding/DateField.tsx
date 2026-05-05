// DateField is a tappable label-over-bordered-input that opens the
// platform-native date picker. Used on A2/B5 (예정일) and B2/C2
// (생년월일).
//
// On iOS the spinner picker is rendered inside a bottom-anchored Modal
// rather than inline. The inline pattern collapses inside ScrollView
// layouts (the spinner pushes its 완료 sibling off-screen, which made
// Maestro's `visible:` checks miss the testID and skipped the swipe
// step in CI). The Modal gives the picker + 완료 a stable fixed
// position so the swipe + dismiss can be driven deterministically.

import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, View } from 'react-native';

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

      {/* Android: lightweight modal dialog. Mounting the component is
          enough — it opens itself; we tear it down on close. */}
      {Platform.OS === 'android' && open ? (
        <DateTimePicker
          value={date ?? today}
          mode="date"
          display="default"
          minimumDate={min}
          maximumDate={max}
          onChange={handleChange}
          testID={testID ? `${testID}-picker` : undefined}
        />
      ) : null}

      {/* iOS: bottom-sheet modal so position is predictable for both
          users and Maestro. Spinner + 완료 always render at the same
          coordinates regardless of the parent ScrollView's offset. */}
      {Platform.OS === 'ios' ? (
        <Modal
          visible={open}
          animationType="slide"
          transparent
          onRequestClose={() => setOpen(false)}
        >
          <Pressable
            style={styles.backdrop}
            onPress={() => setOpen(false)}
            accessibilityRole="button"
            testID={testID ? `${testID}-backdrop` : undefined}
          />
          <View style={styles.sheet}>
            <Pressable
              onPress={() => setOpen(false)}
              accessibilityRole="button"
              testID={testID ? `${testID}-done` : undefined}
              style={({ pressed }) => [styles.doneRow, pressed && styles.pressed]}
            >
              <Text variant="h3" color="coral">
                완료
              </Text>
            </Pressable>
            <DateTimePicker
              value={date ?? today}
              mode="date"
              display="spinner"
              minimumDate={min}
              maximumDate={max}
              onChange={handleChange}
              testID={testID ? `${testID}-picker` : undefined}
              style={styles.picker}
            />
          </View>
        </Modal>
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
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(61,46,30,0.25)',
  },
  sheet: {
    backgroundColor: colors.surface.ivory,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingBottom: spacing[6],
  },
  doneRow: {
    alignItems: 'flex-end',
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[3],
  },
  picker: { alignSelf: 'stretch' },
});
