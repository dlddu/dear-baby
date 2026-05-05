// DateField is a tappable label-over-bordered-input that opens the
// platform-native date picker. Used on A2/B5 (예정일) and B2/C2
// (생년월일).
//
// On first tap the field pre-fills with a sensible default (today for
// 생년월일, 40 weeks from today for 예정일) so the form is complete
// even if the user just glances at the picker and dismisses it.
//
// iOS renders the date picker inline (display="inline" — iOS 14+
// calendar grid) directly under the field. We tried Modal and inline
// spinner first; both broke Maestro's accessibility traversal on iOS
// (Modal portal is a separate UIWindow, the spinner pushed the 완료
// sibling off-screen). The inline calendar stays inside the parent
// ScrollView and the page's CTA lives in a footer outside the
// ScrollView, so the picker never blocks "다음".
//
// Android continues to use the system's modal date dialog unchanged.

import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Keyboard, Platform, Pressable, StyleSheet, View } from 'react-native';

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
    // Dismiss any soft keyboard from a previously-focused TextInput
    // before showing the picker. Without this the keyboard remains up
    // and covers the page's footer CTA — Maestro's tap-by-testID lands
    // on the keyboard view instead, mangling the form's weeks input
    // (CI was seeing "17" → "170" → clamped to 45 because the next
    // button was covered by the number-pad).
    Keyboard.dismiss();
    // Pre-fill on first tap so the form is complete even if the user
    // dismisses the picker without scrolling. This keeps the Maestro
    // E2E flow deterministic too — the test just taps the field and
    // moves on without having to drive the iOS calendar.
    if (!date) {
      onChange(toIsoDate(defaultForField()));
    }
    setOpen((prev) => !prev);
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

      {/* iOS: inline calendar (no Modal — Maestro can't traverse RN
          Modal portals on iOS). Stays inside the ScrollView; the
          screen's CTA is in a footer outside the ScrollView so it
          remains tappable regardless of calendar height. */}
      {Platform.OS === 'ios' && open ? (
        <DateTimePicker
          value={date ?? defaultForField()}
          mode="date"
          display="inline"
          minimumDate={min}
          maximumDate={max}
          onChange={handleChange}
          testID={testID ? `${testID}-picker` : undefined}
          style={styles.iosInline}
        />
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
  iosInline: {
    alignSelf: 'stretch',
    height: 360,
  },
});

