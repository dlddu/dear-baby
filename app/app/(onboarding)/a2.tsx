// Onboarding M-05 — A2 태아 정보
// docs/mockups/source/src/screens/Onboarding.tsx:263-278 (헤더 + FetusInfoForm)
//
// PRD-006 AC-006-02 의 두 번째 입력. 4개 필드(예정일·태명·성별·임신 주차)를
// `OnboardingContext.fetuses[fetusIndex]` 에 저장한다. 다태인 경우 [다음] 으로
// 인덱스를 증가시켜 **같은 경로를 새로 push** 한다 — 화면 인스턴스가 stack 에
// 쌓이므로 push 애니메이션이 재생되고, b5 의 다태 흐름과 시각적으로 일관된다.
// 마지막 태아의 [다음] 에서 a3 (기록 목적) 화면으로 진입한다.
//
// 각 인스턴스는 라우트 매개변수 `index` 로 자기 태아 인덱스를 받아 stack 의
// 다른 인스턴스와 독립적으로 데이터를 그린다. context 의 currentFetusIndex
// 는 영속화·복원 용도로만 갱신된다 (drafts cache).

import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useLocalSearchParams, useRouter } from 'expo-router';
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

import { BackLink } from '../../src/components/BackLink';
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
import { typography } from '../../src/theme/typography';
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

export default function OnboardingA2() {
  const router = useRouter();
  const params = useLocalSearchParams<{ index?: string }>();
  // 라우트 매개변수가 없거나 파싱이 실패하면 0 으로 fallback (a1 → a2 첫 진입).
  const parsed = Number.parseInt(params.index ?? '0', 10);
  const fetusIndex = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;

  const {
    fetusCount,
    fetuses,
    updateFetus,
    setCurrentFetusIndex,
  } = useOnboarding();

  const total = fetusCount ?? 1;
  const fetus = fetuses[fetusIndex] ?? {};
  const dueDate = parseDueDate(fetus.dueDate);

  const [pickerOpen, setPickerOpen] = useState(false);

  const handlePickerChange = (
    event: DateTimePickerEvent,
    selected?: Date,
  ) => {
    // Android 는 'dismissed' 이벤트로 취소가 들어온다. iOS 는 inline spinner
    // 에서 매 회전마다 'set' 이 발생하므로 그 때마다 값을 커밋한다.
    if (Platform.OS === 'android') {
      setPickerOpen(false);
      if (event.type === 'set' && selected) {
        updateFetus(fetusIndex, { dueDate: toIsoDate(selected) });
      }
      return;
    }
    if (selected) {
      updateFetus(fetusIndex, { dueDate: toIsoDate(selected) });
    }
  };

  const onSkipDate = () => {
    updateFetus(fetusIndex, { dueDate: undefined });
  };

  const onChangeNickname = (value: string) => {
    updateFetus(fetusIndex, { nickname: value });
  };

  const onSelectGender = (value: Gender) => {
    updateFetus(fetusIndex, { gender: value });
  };

  const onChangeWeek = (raw: string) => {
    const cleaned = raw.replace(/[^0-9]/g, '');
    if (cleaned === '') {
      updateFetus(fetusIndex, { pregnancyWeek: undefined });
      return;
    }
    const n = Number.parseInt(cleaned, 10);
    if (Number.isFinite(n) && n >= 0 && n <= 45) {
      updateFetus(fetusIndex, { pregnancyWeek: n });
    }
  };

  const onNext = () => {
    if (fetusIndex < total - 1) {
      const nextIndex = fetusIndex + 1;
      // 영속화·복원용 인덱스만 갱신하고, push 로 새 인스턴스를 stack 에 올린다.
      // 새 인스턴스는 라우트 매개변수의 index 를 보고 동작하므로 stack 의
      // 이전 인스턴스 데이터에 영향을 주지 않는다.
      setCurrentFetusIndex(nextIndex);
      router.push({
        pathname: '/(onboarding)/a2',
        params: { index: String(nextIndex) },
      });
      return;
    }
    router.push('/(onboarding)/a3');
  };

  const onBack = () => {
    // 이전 인스턴스가 마운트돼 있으므로 router.back() 으로 자연스럽게 복귀.
    if (fetusIndex > 0) {
      setCurrentFetusIndex(fetusIndex - 1);
    }
    router.back();
  };

  const ctaTitle = '다음';

  return (
    <SafeAreaView
      style={styles.safe}
      edges={['top', 'bottom']}
      testID="onboarding-a2"
    >
      <View style={styles.topRow}>
        <ProgressDots total={5} current={3} style={styles.progress} />
        {total > 1 && (
          <Badge
            label={`${fetusIndex + 1}/${total}`}
            variant="category"
            testID={`onboarding-a2-fetus-index-${fetusIndex}`}
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
          helper="기록 가이드를 맞춰 보여드릴게요"
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
              testID="onboarding-a2-due-date-field"
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
              testID="onboarding-a2-due-date-skip"
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
              testID="onboarding-a2-nickname"
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
                  testID={`onboarding-a2-gender-${g.suffix}`}
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
                testID="onboarding-a2-week"
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
        {fetusIndex > 0 && (
          <BackLink
            onPress={onBack}
            label="← 이전 아이로"
            testID="onboarding-a2-back"
          />
        )}
        <Button
          title={ctaTitle}
          variant="primary"
          fullWidth
          onPress={onNext}
          testID="onboarding-a2-next"
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
          testID="onboarding-a2-date-picker"
        />
      )}
      {Platform.OS === 'ios' && pickerOpen && (
        <Pressable
          onPress={() => setPickerOpen(false)}
          style={styles.pickerDone}
          accessibilityRole="button"
          testID="onboarding-a2-date-picker-done"
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
    fontSize: typography.body.fontSize,
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
  pressed: { opacity: 0.85 },
  pickerDone: {
    alignSelf: 'center',
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[6],
  },
});
