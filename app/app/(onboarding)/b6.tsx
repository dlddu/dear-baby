// Onboarding M-13 — B6 태아 기록 목적 (Case B 단일 입력)
// docs/mockups/source/src/screens/Onboarding.tsx:544-588 (M13_B6_Purpose)
//
// PRD-006 AC-006-03 ③ 의 임신 절반. 태아는 다태인 경우에도 1회만 묻고
// 모든 태아 행에 동일한 purposes 를 적용한다 (Case A · A3 와 같은 모델).
// 양육 아이의 기록 목적은 b2-purpose 에서 1:1 로 받았으므로 본 화면은
// 임신 톤(`CASE_A_PURPOSES`) 8 칩 단일 그리드 + [시작하기 ✨] 만 노출.
//
// [시작하기 ✨] 가 `completeAsB()` 를 호출 → 단일 purposes 를 모든 fetus
// 행에 복제하여 백엔드에 영속화하고 홈으로 진입한다.

import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackLink } from '../../src/components/BackLink';
import { Button } from '../../src/components/Button';
import { Pill } from '../../src/components/Pill';
import { OnboardingTopRow } from '../../src/components/OnboardingTopRow';
import { QuestionHeader } from '../../src/components/QuestionHeader';
import { Text } from '../../src/components/Text';
import { useOnboarding } from '../../src/onboarding/OnboardingContext';
import { CASE_A_PURPOSES } from '../../src/onboarding/types';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';

function purposeTestID(label: string): string {
  const idx = CASE_A_PURPOSES.findIndex((p) => p.label === label);
  return `onboarding-b6-purpose-${idx}`;
}

export default function OnboardingB6() {
  const router = useRouter();
  const { fetusCount, purposes, togglePurpose, completeAsB } = useOnboarding();

  const [submitting, setSubmitting] = useState(false);
  const [hasError, setHasError] = useState(false);

  const total = fetusCount ?? 1;

  const onStart = async () => {
    if (submitting) return;
    setHasError(false);
    setSubmitting(true);
    try {
      await completeAsB();
      // AuthGate reroutes to /(tabs) automatically once status flips.
    } catch (e) {
      console.warn('[onboarding] completeAsB failed', e);
      setHasError(true);
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView
      style={styles.safe}
      edges={['top', 'bottom']}
      testID="onboarding-b6"
    >
      <OnboardingTopRow total={8} current={7} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <QuestionHeader
          title={'어떤 이야기를\n남기고 싶으세요?'}
          helper="이 주제에 맞춘 질문을 매일 보내드려요"
        />
        <View style={styles.body}>
          <View style={styles.pillGrid}>
            {CASE_A_PURPOSES.map((p) => (
              <Pill
                key={p.label}
                label={p.label}
                selected={purposes.includes(p.label)}
                onPress={() => togglePurpose(p.label)}
                testID={purposeTestID(p.label)}
              />
            ))}
          </View>
          <Text variant="caption" color="muted" style={styles.helper}>
            {total > 1
              ? '중복 선택 가능 · 모든 태아에게 동일하게 적용돼요'
              : '중복 선택 가능 · 기본값 추천됨'}
          </Text>
        </View>
      </ScrollView>

      <View style={styles.actions}>
        <BackLink onPress={() => router.back()} testID="onboarding-b6-back" />
        <Button
          title={submitting ? '저장 중…' : '시작하기 ✨'}
          variant="primary"
          fullWidth
          disabled={submitting}
          onPress={onStart}
          testID="onboarding-b6-cta"
        />
        {hasError && (
          <Text
            variant="caption"
            color="coral"
            style={styles.error}
            testID="onboarding-b6-error"
          >
            지금은 저장이 잘 안 되네요. 잠시 후 다시 시도해 주세요.
          </Text>
        )}
      </View>

      <StatusBar style="dark" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.cream },
  scroll: { flex: 1 },
  content: { paddingBottom: spacing[8] },
  body: {
    paddingHorizontal: spacing[6],
    paddingTop: spacing[3],
    gap: spacing[3],
  },
  pillGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  helper: { paddingLeft: spacing[1] },
  actions: {
    paddingHorizontal: spacing[6],
    paddingTop: spacing[3],
    paddingBottom: spacing[3],
    gap: spacing[2],
  },
  error: { textAlign: 'center' },
});
