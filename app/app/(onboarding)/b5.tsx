// Onboarding M-12 — B5 태아 정보 (Case B)
// docs/mockups/source/src/screens/Onboarding.tsx:527-539 (M12_B5_FetusInfo)
//
// PRD-006 AC-006-03 ② 의 두 번째 입력. 4개 필드(예정일·태명·성별·임신 주차)를
// `OnboardingContext.fetuses[currentFetusIndex]` 에 저장한다. a2 와 동일한
// 화면 구조 — 다태인 경우 [다음] 으로 인덱스를 증가시켜 같은 화면을 반복
// 렌더하고, 마지막 태아의 [다음] 에서 b6 (기록 목적 일괄)로 진입한다.

import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Badge } from '../../src/components/Badge';
import { Button } from '../../src/components/Button';
import { Pill } from '../../src/components/Pill';
import { ProgressDots } from '../../src/components/ProgressDots';
import { QuestionHeader } from '../../src/components/QuestionHeader';
import { Text } from '../../src/components/Text';
import { useOnboarding } from '../../src/onboarding/OnboardingContext';
import type { Gender } from '../../src/onboarding/types';
import { colors } from '../../src/theme/colors';
import { radius } from '../../src/theme/radius';
import { spacing } from '../../src/theme/spacing';
import {
  defaultDueDate,
  formatKoreanDate,
  toIsoDate,
} from '../../src/utils/date';

const MIN_DATE = new Date();
const MAX_DATE = (() => {
  const d = new Date();
  d.setDate(d.getDate() + 7 * 45);
  return d;
})();

function parseDueDate(iso?: string): Date | null {
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map((s) => Number.parseInt(s, 10));
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

const GENDERS: { value: Gender; label: string; suffix: string }[] = [
  { value: 'female', label: '여자아이', suffix: 'female' },
  { value: 'male', label: '남자아이', suffix: 'male' },
  { value: 'unknown', label: '아직 몰라요', suffix: 'unknown' },
];

export default function OnboardingB5() {
  const router = useRouter();
  const {
    fetusCount,
    fetuses,
    currentFetusIndex,
    updateFetus,
    setCurrentFetusIndex,
  } = useOnboarding();

  const total = fetusCount ?? 1;
  const fetus = fetuses[currentFetusIndex] ?? {};
  const dueDate = parseDueDate(fetus.dueDate);

  const [pickerOpen, setPickerOpen] = useState(false);

  const handlePickerChange = (
    event: DateTimePickerEvent,
    selected?: Date,
  ) => {
    if (Platform.OS === 'android') {
      setPickerOpen(false);
      if (event.type === 'set' && selected) {
        updateFetus(currentFetusIndex, { dueDate: toIsoDate(selected) });
      }
      return;
    }
    if (selected) {
      updateFetus(currentFetusIndex, { dueDate: toIsoDate(selected) });
    }
  };

  const onSkipDate = () => {
    updateFetus(currentFetusIndex, { dueDate: undefined });
  };

  const onChangeNickname = (value: string) => {
    updateFetus(currentFetusIndex, { nickname: value });
  };

  const onSelectGender = (value: Gender) => {
    updateFetus(currentFetusIndex, { gender: value });
  };

  const onChangeWeek = (raw: string) => {
    const cleaned = raw.replace(/[^0-9]/g, '');
    if (cleaned === '') {
      updateFetus(currentFetusIndex, { pregnancyWeek: undefined });
      return;
    }
    const n = Number.parseInt(cleaned, 10);
    if (Number.isFinite(n) && n >= 0 && n <= 45) {
      updateFetus(currentFetusIndex, { pregnancyWeek: n });
    }
  };

  const onNext = () => {
    if (currentFetusIndex < total - 1) {
      setCurrentFetusIndex(currentFetusIndex + 1);
      return;
    }
    router.push('/(onboarding)/b6');
  };

  const onBack = () => {
    if (currentFetusIndex > 0) {
      setCurrentFetusIndex(currentFetusIndex - 1);
      return;
    }
    router.back();
  };

  return (
    <SafeAreaView
      style={styles.safe}
      edges={['top', 'bottom']}
      testID="onboarding-b5"
    >
      <View style={styles.topRow}>
        <ProgressDots total={8} current={7} style={styles.progress} />
        {total > 1 && (
          <Badge
            label={`${currentFetusIndex + 1}/${total}`}
            variant="category"
            testID={`onboarding-b5-fetus-index-${currentFetusIndex}`}
            style={styles.indexBadge}
          />
        )}
      </View>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <QuestionHeader
          title={'곧 만날 아이의\n정보예요'}
          helper="이전 아이들과 따로 기록해드려요"
        />
        <View style={styles.body}>
          {/* 예정일 */}
          <View style={styles.field}>
            <Text variant="caption" color="primary" style={styles.fieldLabel}>
              예정일
            </Text>
            <Pressable
              onPress={() => setPickerOpen(true)}
              accessibilityRole="button"
              testID={`onboarding-b5-due-date-field-${currentFetusIndex}`}
              style={({ pressed }) => [
                styles.dateField,
                pressed && styles.pressed,
              ]}
            >
              <Text
                variant="body"
                color={dueDate ? 'primary' : 'muted'}
                style={styles.dateText}
              >
                {dueDate ? formatKoreanDate(dueDate) : '날짜 선택하기'}
              </Text>
            </Pressable>
            <Pressable
              onPress={onSkipDate}
              accessibilityRole="button"
              testID={`onboarding-b5-due-date-skip-${currentFetusIndex}`}
              style={({ pressed }) => [
                styles.skip,
                pressed && styles.pressed,
              ]}
            >
              <Text variant="caption" color="secondary" style={styles.skipText}>
                아직 정해지지 않았어요
              </Text>
            </Pressable>
          </View>

          {/* 태명 */}
          <View style={styles.field}>
            <Text variant="caption" color="primary" style={styles.fieldLabel}>
              태명{'  '}
              <Text variant="caption" color="muted">
                (선택)
              </Text>
            </Text>
            <TextInput
              value={fetus.nickname ?? ''}
              onChangeText={onChangeNickname}
              placeholder="콩이"
              placeholderTextColor={colors.text.muted}
              style={styles.input}
              testID={`onboarding-b5-nickname-${currentFetusIndex}`}
              maxLength={20}
            />
          </View>

          {/* 성별 */}
          <View style={styles.field}>
            <Text variant="caption" color="primary" style={styles.fieldLabel}>
              성별{'  '}
              <Text variant="caption" color="muted">
                (선택)
              </Text>
            </Text>
            <View style={styles.pillRow}>
              {GENDERS.map((g) => (
                <Pill
                  key={g.value}
                  label={g.label}
                  selected={fetus.gender === g.value}
                  onPress={() => onSelectGender(g.value)}
                  testID={`onboarding-b5-gender-${g.suffix}`}
                  style={styles.pillItem}
                />
              ))}
            </View>
          </View>

          {/* 임신 주차 */}
          <View style={styles.field}>
            <Text variant="caption" color="primary" style={styles.fieldLabel}>
              임신 주차
            </Text>
            <View style={styles.weekFieldWrap}>
              <TextInput
                value={
                  fetus.pregnancyWeek === undefined
                    ? ''
                    : String(fetus.pregnancyWeek)
                }
                onChangeText={onChangeWeek}
                placeholder="17"
                placeholderTextColor={colors.text.muted}
                keyboardType="number-pad"
                style={[styles.input, styles.weekInput]}
                testID={`onboarding-b5-week-${currentFetusIndex}`}
                maxLength={2}
              />
              <Text variant="caption" color="secondary" style={styles.weekSuffix}>
                주
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      <View style={styles.actions}>
        {currentFetusIndex > 0 && (
          <Pressable
            onPress={onBack}
            accessibilityRole="button"
            testID="onboarding-b5-back"
            style={({ pressed }) => [
              styles.backLink,
              pressed && styles.pressed,
            ]}
          >
            <Text variant="caption" color="secondary" style={styles.backText}>
              ← 이전 아이로
            </Text>
          </Pressable>
        )}
        <Button
          title="다음"
          variant="primary"
          fullWidth
          onPress={onNext}
          testID="onboarding-b5-next"
        />
      </View>

      {pickerOpen && (
        <DateTimePicker
          value={dueDate ?? defaultDueDate()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          minimumDate={MIN_DATE}
          maximumDate={MAX_DATE}
          onChange={handlePickerChange}
          testID="onboarding-b5-date-picker"
        />
      )}
      {Platform.OS === 'ios' && pickerOpen && (
        <Pressable
          onPress={() => setPickerOpen(false)}
          style={styles.pickerDone}
          accessibilityRole="button"
          testID="onboarding-b5-date-picker-done"
        >
          <Text variant="h3" color="coral">
            완료
          </Text>
        </Pressable>
      )}
      <StatusBar style="dark" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.cream },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progress: { flex: 1 },
  indexBadge: {
    marginRight: spacing[6],
    marginTop: spacing[3],
  },
  scroll: { flex: 1 },
  content: { paddingBottom: spacing[8] },
  body: {
    paddingHorizontal: spacing[6],
    paddingTop: spacing[2],
    gap: spacing[5],
  },
  field: { gap: spacing[2] },
  fieldLabel: {
    fontWeight: '600',
    paddingLeft: spacing[1],
  },
  dateField: {
    borderRadius: radius.sm,
    backgroundColor: colors.surface.ivory,
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[4],
  },
  dateText: { textAlign: 'left', fontWeight: '600' },
  skip: {
    alignSelf: 'flex-start',
    paddingVertical: spacing[1],
    paddingHorizontal: spacing[1],
  },
  skipText: { textDecorationLine: 'underline' },
  input: {
    backgroundColor: colors.bg.beige,
    borderRadius: radius.sm,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    fontSize: 15,
    color: colors.text.primary,
  },
  pillRow: {
    flexDirection: 'row',
    gap: spacing[2],
    flexWrap: 'wrap',
  },
  pillItem: { flex: 1 },
  weekFieldWrap: {
    position: 'relative',
    justifyContent: 'center',
  },
  weekInput: { paddingRight: spacing[8] },
  weekSuffix: {
    position: 'absolute',
    right: spacing[4],
    fontWeight: '500',
  },
  actions: {
    paddingHorizontal: spacing[6],
    paddingTop: spacing[3],
    paddingBottom: spacing[3],
    gap: spacing[2],
  },
  backLink: {
    alignSelf: 'flex-start',
    paddingVertical: spacing[2],
  },
  backText: { textDecorationLine: 'underline' },
  pressed: { opacity: 0.85 },
  pickerDone: {
    alignSelf: 'center',
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[6],
  },
});
