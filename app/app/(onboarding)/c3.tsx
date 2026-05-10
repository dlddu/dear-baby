// Onboarding M-16 — C3 기록 목적
// docs/mockups/source/src/screens/Onboarding.tsx:631-661 (M16_C3_Purpose)
//
// PRD-006 AC-006-04 의 마지막 입력. 사용자가 칩 8개에서 다중 선택한
// 한국어 라벨을 `OnboardingContext.purposes` 에 저장하고, [시작하기 ✨] 시
// 모든 양육 아이 행에 동일 purposes 를 복제해 백엔드에 영속화한다.
// 다자녀에서도 1회만 노출 — 마지막 아이의 [다음] 에서 c2 → c3 로 진입한다.

import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../../src/components/Button';
import { Pill } from '../../src/components/Pill';
import { ProgressDots } from '../../src/components/ProgressDots';
import { QuestionHeader } from '../../src/components/QuestionHeader';
import { Text } from '../../src/components/Text';
import { useOnboarding } from '../../src/onboarding/OnboardingContext';
import { CASE_C_PURPOSES } from '../../src/onboarding/types';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';

function purposeTestID(label: string): string {
  const idx = CASE_C_PURPOSES.findIndex((p) => p.label === label);
  return `onboarding-c3-purpose-${idx}`;
}

export default function OnboardingC3() {
  const router = useRouter();
  const { purposes, togglePurpose, completeAsC } = useOnboarding();

  const [submitting, setSubmitting] = useState(false);
  const [hasError, setHasError] = useState(false);

  const onStart = async () => {
    if (submitting) return;
    setHasError(false);
    setSubmitting(true);
    try {
      await completeAsC();
      // AuthGate reroutes to /(tabs) automatically once status flips.
    } catch (e) {
      console.warn('[onboarding] completeAsC failed', e);
      setHasError(true);
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView
      style={styles.safe}
      edges={['top', 'bottom']}
      testID="onboarding-c3"
    >
      <ProgressDots total={4} current={3} style={styles.progress} />
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
            {CASE_C_PURPOSES.map((p) => (
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
            중복 선택 가능
          </Text>
        </View>
      </ScrollView>

      <View style={styles.actions}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          testID="onboarding-c3-back"
          style={({ pressed }) => [styles.backLink, pressed && styles.pressed]}
        >
          <Text variant="caption" color="secondary" style={styles.backText}>
            ← 이전으로
          </Text>
        </Pressable>
        <Button
          title={submitting ? '저장 중…' : '시작하기 ✨'}
          variant="primary"
          fullWidth
          disabled={submitting}
          onPress={onStart}
          testID="onboarding-c3-cta"
        />
        {hasError && (
          <Text
            variant="caption"
            color="coral"
            style={styles.error}
            testID="onboarding-c3-error"
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
  progress: { flex: 0 },
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
  backLink: {
    alignSelf: 'flex-start',
    paddingVertical: spacing[2],
  },
  backText: { textDecorationLine: 'underline' },
  pressed: { opacity: 0.85 },
  error: { textAlign: 'center' },
});
