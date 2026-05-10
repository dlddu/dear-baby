// Onboarding M-09 — B2 양육 아이 정보 (Case B)
// docs/mockups/source/src/screens/Onboarding.tsx:445-460 (M09_B2_ChildrenInfo)
//
// PRD-006 AC-006-03 ① 의 두 번째 입력. 4개 필드(이름·생년월일·성별·한줄소개)를
// `OnboardingContext.children[currentChildIndex]` 에 저장한다. c2 와 동일한
// 화면 구조지만, 다자녀에서도 [다음] 으로 곧장 다음 아이로 넘어가지 않고
// b2-purpose 로 push 해 양육 아이의 기록 목적을 1:1 로 받는다 (AC-006-03 ③).
// b2-purpose 의 [다음] 에서 currentChildIndex 가 증가하며 b2 로 다시 push
// 된다.

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
  const d = new Date();
  d.setFullYear(d.getFullYear() - 1);
  return d;
}

const GENDERS: { value: Gender; label: string; suffix: string }[] = [
  { value: 'female', label: '여자아이', suffix: 'female' },
  { value: 'male', label: '남자아이', suffix: 'male' },
  { value: 'unknown', label: '아직 몰라요', suffix: 'unknown' },
];

export default function OnboardingB2() {
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
    // b2 의 [다음] 은 항상 b2-purpose 로 push — 기록 목적 입력 후 다음 아이로
    // 넘어갈지 b3 로 갈지 b2-purpose 가 결정한다 (양육은 1:1 흐름이므로).
    router.push('/(onboarding)/b2-purpose');
  };

  const onBack = () => {
    if (currentChildIndex > 0) {
      setCurrentChildIndex(currentChildIndex - 1);
      return;
    }
    router.back();
  };

  return (
    <SafeAreaView
      style={styles.safe}
      edges={['top', 'bottom']}
      testID="onboarding-b2"
    >
      <View style={styles.topRow}>
        <ProgressDots total={8} current={4} style={styles.progress} />
        {total > 1 && (
          <Badge
            label={`${currentChildIndex + 1}/${total}`}
            variant="category"
            testID={`onboarding-b2-child-index-${currentChildIndex}`}
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
              testID={`onboarding-b2-name-${currentChildIndex}`}
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
              testID={`onboarding-b2-birth-date-field-${currentChildIndex}`}
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
                  testID={`onboarding-b2-gender-${g.suffix}`}
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
              testID={`onboarding-b2-bio-${currentChildIndex}`}
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
            testID="onboarding-b2-back"
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
          disabled={!canProceed}
          onPress={onNext}
          testID="onboarding-b2-next"
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
          testID="onboarding-b2-date-picker"
        />
      )}
      {Platform.OS === 'ios' && pickerOpen && (
        <Pressable
          onPress={() => setPickerOpen(false)}
          style={styles.pickerDone}
          accessibilityRole="button"
          testID="onboarding-b2-date-picker-done"
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
