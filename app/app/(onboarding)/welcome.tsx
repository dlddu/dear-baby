// Onboarding Stage 1 — 감성 웰컴 + 예정일 입력
// docs/wireframes/onboarding.md:17-59
//
// 단일 목적: 예정일 하나만 받고(혹은 "아직 정해지지 않았어요"로 스킵) 즉시
// 홈으로 보낸다. 프로필/닉네임/알림 등 다른 입력은 이 단계에서 묻지 않는다.

import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { Text } from '../../src/components/Text';
import { useAuth } from '../../src/auth/AuthContext';
import { colors } from '../../src/theme/colors';
import { radius } from '../../src/theme/radius';
import { spacing } from '../../src/theme/spacing';
import {
  defaultDueDate,
  formatKoreanDate,
  toIsoDate,
} from '../../src/utils/date';

// 오늘부터 최대 45주 뒤까지만 허용. 과거 날짜나 1년 넘게 먼 미래는 사용자의
// 오탈자일 확률이 높다.
const MIN_DATE = new Date();
const MAX_DATE = (() => {
  const d = new Date();
  d.setDate(d.getDate() + 7 * 45);
  return d;
})();

export default function OnboardingWelcome() {
  const { completeOnboarding } = useAuth();

  const [date, setDate] = useState<Date | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [hasError, setHasError] = useState(false);

  const handlePickerChange = (
    event: DateTimePickerEvent,
    selected?: Date,
  ) => {
    // Android fires 'dismissed' on cancel; iOS leaves the inline picker open
    // and emits 'set' on each spin. We close the Android modal immediately
    // either way, and commit the value on iOS continuously.
    if (Platform.OS === 'android') {
      setPickerOpen(false);
      if (event.type === 'set' && selected) {
        setDate(selected);
      }
      return;
    }
    if (selected) setDate(selected);
  };

  const submit = async (dueDate: string | null) => {
    if (submitting) return;
    setHasError(false);
    setSubmitting(true);
    try {
      await completeOnboarding(dueDate);
      // AuthGate reroutes to /(tabs) automatically once status flips.
    } catch (e) {
      console.warn('[onboarding] completeOnboarding failed', e);
      setHasError(true);
      setSubmitting(false);
    }
  };

  const onStart = () => {
    if (!date) return;
    submit(toIsoDate(date));
  };

  const onSkip = () => {
    submit(null);
  };

  return (
    <SafeAreaView
      style={styles.safe}
      edges={['top', 'bottom']}
      testID="onboarding-welcome"
    >
      <View style={styles.container}>
        <View style={styles.hero}>
          <Text variant="display" color="primary" style={styles.logo}>
            DearBaby
          </Text>
          <Text variant="emotion" color="primary" style={styles.greeting}>
            반가워요, 엄마 🌷
          </Text>
          <Text variant="emotion" color="secondary" style={styles.tagline}>
            아기를 기다리는 소중한 시간,{'\n'}함께 기록해볼까요?
          </Text>
        </View>

        <Card padding="lg" style={styles.card}>
          <Text variant="h3" color="primary" style={styles.cardLabel}>
            아기를 만날 예정일을 알려주세요
          </Text>
          <Pressable
            onPress={() => setPickerOpen(true)}
            accessibilityRole="button"
            testID="onboarding-due-date-field"
            style={({ pressed }) => [
              styles.dateField,
              pressed && styles.dateFieldPressed,
            ]}
          >
            <Text
              variant="body"
              color={date ? 'primary' : 'muted'}
              style={styles.dateText}
            >
              {date ? formatKoreanDate(date) : '날짜 선택하기'}
            </Text>
          </Pressable>
        </Card>

        <View style={styles.actions}>
          <Button
            title={submitting ? '저장 중…' : '시작하기'}
            variant="primary"
            fullWidth
            disabled={!date || submitting}
            onPress={onStart}
            testID="onboarding-start-button"
          />
          <Pressable
            onPress={onSkip}
            disabled={submitting}
            accessibilityRole="button"
            testID="onboarding-skip-button"
            style={({ pressed }) => [
              styles.skip,
              pressed && styles.skipPressed,
            ]}
          >
            <Text variant="body" color="secondary" style={styles.skipText}>
              아직 정해지지 않았어요
            </Text>
          </Pressable>
          {hasError && (
            <Text
              variant="caption"
              color="coral"
              style={styles.error}
              testID="onboarding-error"
            >
              지금은 저장이 잘 안 되네요. 잠시 후 다시 시도해 주세요.
            </Text>
          )}
        </View>

        {/* iOS: inline spinner stays mounted while open. Android: modal. */}
        {pickerOpen && (
          <DateTimePicker
            value={date ?? defaultDueDate()}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            minimumDate={MIN_DATE}
            maximumDate={MAX_DATE}
            onChange={handlePickerChange}
            testID="onboarding-date-picker"
          />
        )}
        {Platform.OS === 'ios' && pickerOpen && (
          <Pressable
            onPress={() => setPickerOpen(false)}
            style={styles.pickerDone}
            accessibilityRole="button"
            testID="onboarding-date-picker-done"
          >
            <Text variant="h3" color="coral">
              완료
            </Text>
          </Pressable>
        )}
      </View>
      <StatusBar style="dark" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.cream },
  container: {
    flex: 1,
    paddingHorizontal: spacing[6],
    paddingTop: spacing[8],
    paddingBottom: spacing[6],
    justifyContent: 'space-between',
  },
  hero: {
    alignItems: 'center',
    gap: spacing[3],
  },
  logo: { textAlign: 'center', marginBottom: spacing[3] },
  greeting: { textAlign: 'center' },
  tagline: { textAlign: 'center' },
  card: { gap: spacing[4] },
  cardLabel: { textAlign: 'left' },
  dateField: {
    borderWidth: 1,
    borderColor: colors.bg.beige,
    backgroundColor: colors.bg.cream,
    borderRadius: radius.sm,
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[4],
  },
  dateFieldPressed: { opacity: 0.85 },
  dateText: { textAlign: 'center' },
  actions: { gap: spacing[3] },
  skip: { alignItems: 'center', paddingVertical: spacing[3] },
  skipPressed: { opacity: 0.6 },
  skipText: { textAlign: 'center', textDecorationLine: 'underline' },
  error: { textAlign: 'center' },
  pickerDone: {
    alignSelf: 'center',
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[6],
  },
});
