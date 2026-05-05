// DateField is a tappable label-over-bordered-input that opens the
// platform-native date picker. Used on A2/B5 (예정일) and B2/C2
// (생년월일).
//
// On first tap the field pre-fills with a sensible default (today for
// 생년월일, 40 weeks from today for 예정일) so the form is complete
// even if the user just glances at the picker and dismisses it. iOS
// renders the spinner inside a bottom-anchored Modal so the spinner +
// 완료 button sit at predictable coordinates and don't get pushed off
// the visible viewport by the parent ScrollView. Android continues to
// use the system's modal date dialog unchanged.

import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, View } from 'react-native';

import { colors } from '../../theme/colors';
import { radius } from '../../theme/radius';
import { spacing } from '../../theme/spacing';
import { defaultDueDate, formatKoreanDate, toIsoDate } from '../../utils/date';
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

  // Sensible default for the field's first tap. 예정일 (futureOnly) →
  // 40 weeks out (matches average gestation). 생년월일 (pastOnly) →
  // today (most recent valid). Plain field → today.
  const defaultForField = (): Date => {
    if (futureOnly) return defaultDueDate(today);
    return today;
  };

  const onPressField = () => {
    // Pre-fill on first tap so the form is complete even if the user
    // dismisses the picker without scrolling. This keeps the Maestro
    // E2E flow deterministic too — the test just taps the field and
    // moves on without having to drive the iOS spinner.
    if (!date) {
      onChange(toIsoDate(defaultForField()));
    }
    setOpen(true);
  };

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
        onPress={onPressField}
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
          value={date ?? defaultForField()}
          mode="date"
          display="default"
          minimumDate={min}
          maximumDate={max}
          onChange={handleChange}
          testID={testID ? `${testID}-picker` : undefined}
        />
      ) : null}

      {/* iOS: bottom-sheet modal so position is predictable for users
          regardless of the parent ScrollView offset. The default value
          is committed on press, so a simple dismissal leaves a valid
          form state — Maestro doesn't need to drive the spinner. */}
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
              value={date ?? defaultForField()}
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
