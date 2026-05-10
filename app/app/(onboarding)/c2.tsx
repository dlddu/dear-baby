// Onboarding M-15 — C2 양육 아이 정보
// docs/mockups/source/src/screens/Onboarding.tsx:613-629 (헤더 + ChildInfoForm)
//
// PRD-006 AC-006-04 의 두 번째 입력. 4개 필드(이름·생년월일·성별·한줄소개)를
// `OnboardingContext.children[currentChildIndex]` 에 저장한다. 다자녀인 경우
// [다음] 으로 인덱스를 증가시켜 같은 화면을 반복 렌더하고, 마지막 아이의
// [다음] 에서 c3 (기록 목적) 화면으로 진입한다. 백엔드 영속화는 c3 의
// [시작하기] 에서 `completeAsC()` 한 번에 일어난다.

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
import { formatKoreanDate, toIsoDate } from '../../src/utils/date';

// 양육 아이 생년월일은 과거 날짜만 의미가 있다. 너무 깐깐하면 입력이 막히므로
// 18년 전을 합리적 하한으로 잡는다.
const MAX_DATE = new Date();
const MIN_DATE = (() => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 18);
  return d;
})();

function parseBirthDate(iso?: string): Date | null {
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map((s) => Number.parseInt(s, 10));
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function defaultBirthDate(): Date {
  // 첫 입력 시 picker 가 너무 먼 과거에서 시작하지 않도록 1년 전을 기본값으로.
  const d = new Date();
  d.setFullYear(d.getFullYear() - 1);
  return d;
}

const GENDERS: { value: Gender; label: string; suffix: string }[] = [
  { value: 'female', label: '여자아이', suffix: 'female' },
  { value: 'male', label: '남자아이', suffix: 'male' },
  { value: 'unknown', label: '아직 몰라요', suffix: 'unknown' },
];

export default function OnboardingC2() {
  const router = useRouter();
  const {
    childCount,
    children,
    currentChildIndex,
    updateChild,
    setCurrentChildIndex,
  } = useOnboarding();

  const total = childCount ?? 1;
  const child = children[currentChildIndex] ?? {};
  const birthDate = parseBirthDate(child.birthDate);

  const [pickerOpen, setPickerOpen] = useState(false);

  const handlePickerChange = (
    event: DateTimePickerEvent,
    selected?: Date,
  ) => {
    if (Platform.OS === 'android') {
      setPickerOpen(false);
      if (event.type === 'set' && selected) {
        updateChild(currentChildIndex, { birthDate: toIsoDate(selected) });
      }
      return;
    }
    if (selected) {
      updateChild(currentChildIndex, { birthDate: toIsoDate(selected) });
    }
  };

  const onChangeName = (value: string) => {
    updateChild(currentChildIndex, { name: value });
  };

  const onSelectGender = (value: Gender) => {
    updateChild(currentChildIndex, { gender: value });
  };

  const onChangeBio = (value: string) => {
    updateChild(currentChildIndex, { bio: value });
  };

  const nameTrimmed = (child.name ?? '').trim();
  const canProceed = nameTrimmed.length > 0;

  const onNext = () => {
    if (!canProceed) return;
    if (currentChildIndex < total - 1) {
      setCurrentChildIndex(currentChildIndex + 1);
      return;
    }
    router.push('/(onboarding)/c3');
  };

  const onBack = () => {
    if (currentChildIndex > 0) {
      setCurrentChildIndex(currentChildIndex - 1);
      return;
    }
    router.back();
  };

  const ctaTitle = '다음';

  return (
    <SafeAreaView
      style={styles.safe}
      edges={['top', 'bottom']}
      testID="onboarding-c2"
    >
      <View style={styles.topRow}>
        <ProgressDots total={4} current={2} style={styles.progress} />
        {total > 1 && (
          <Badge
            label={`${currentChildIndex + 1}/${total}`}
            variant="category"
            testID={`onboarding-c2-child-index-${currentChildIndex}`}
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
          title={'아이의 정보를\n알려주세요'}
          helper="기록 가이드를 맞춰드릴게요"
        />
        <View style={styles.body}>
          {/* 이름 */}
          <View style={styles.field}>
            <Text variant="caption" color="primary" style={styles.fieldLabel}>
              이름
            </Text>
            <TextInput
              value={child.name ?? ''}
              onChangeText={onChangeName}
              placeholder="이름 입력"
              placeholderTextColor={colors.text.muted}
              style={styles.input}
              testID="onboarding-c2-name"
              maxLength={20}
            />
          </View>

          {/* 생년월일 */}
          <View style={styles.field}>
            <Text variant="caption" color="primary" style={styles.fieldLabel}>
              생년월일{'  '}
              <Text variant="caption" color="muted">
                (선택)
              </Text>
            </Text>
            <Pressable
              onPress={() => setPickerOpen(true)}
              accessibilityRole="button"
              testID="onboarding-c2-birth-date-field"
              style={({ pressed }) => [
                styles.dateField,
                pressed && styles.pressed,
              ]}
            >
              <Text
                variant="body"
                color={birthDate ? 'primary' : 'muted'}
                style={styles.dateText}
              >
                {birthDate ? formatKoreanDate(birthDate) : '날짜 선택하기'}
              </Text>
            </Pressable>
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
                  selected={child.gender === g.value}
                  onPress={() => onSelectGender(g.value)}
                  testID={`onboarding-c2-gender-${g.suffix}`}
                  style={styles.pillItem}
                />
              ))}
            </View>
          </View>

          {/* 한줄소개 */}
          <View style={styles.field}>
            <Text variant="caption" color="primary" style={styles.fieldLabel}>
              한줄소개{'  '}
              <Text variant="caption" color="muted">
                (선택)
              </Text>
            </Text>
            <TextInput
              value={child.bio ?? ''}
              onChangeText={onChangeBio}
              placeholder="우리 아이를 한 줄로 표현한다면?"
              placeholderTextColor={colors.text.muted}
              style={styles.input}
              testID="onboarding-c2-bio"
              maxLength={40}
            />
          </View>
        </View>
      </ScrollView>

      <View style={styles.actions}>
        {currentChildIndex > 0 && (
          <Pressable
            onPress={onBack}
            accessibilityRole="button"
            testID="onboarding-c2-back"
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
          title={ctaTitle}
          variant="primary"
          fullWidth
          disabled={!canProceed}
          onPress={onNext}
          testID="onboarding-c2-next"
        />
      </View>

      {pickerOpen && (
        <DateTimePicker
          value={birthDate ?? defaultBirthDate()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          minimumDate={MIN_DATE}
          maximumDate={MAX_DATE}
          onChange={handlePickerChange}
          testID="onboarding-c2-date-picker"
        />
      )}
      {Platform.OS === 'ios' && pickerOpen && (
        <Pressable
          onPress={() => setPickerOpen(false)}
          style={styles.pickerDone}
          accessibilityRole="button"
          testID="onboarding-c2-date-picker-done"
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
