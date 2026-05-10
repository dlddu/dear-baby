// Onboarding M-13 — B6 태아 기록 목적 (Case B 일괄)
// docs/mockups/source/src/screens/Onboarding.tsx:544-588 (M13_B6_Purpose)
//
// PRD-006 AC-006-03 ③ 의 임신 절반. mockup 은 양육 + 임신 두 카드를 한 화면에
// 보여주지만, 양육 아이의 기록 목적은 b2-purpose 에서 1:1 로 받았으므로 본
// 화면에는 태아 카드만 fetuses.length 만큼 노출한다. 카드별로 임신 톤의
// CASE_A_PURPOSES 8개 칩을 토글한다 — `togglePurposeForFetus(idx, label)`.
// [시작하기 ✨] 가 `completeAsB()` 를 호출해 백엔드에 양육+임신 양쪽 행을
// 한 트랜잭션에 영속화하고 홈으로 진입한다.

import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { Pill } from '../../src/components/Pill';
import { ProgressDots } from '../../src/components/ProgressDots';
import { QuestionHeader } from '../../src/components/QuestionHeader';
import { Text } from '../../src/components/Text';
import {
  defaultFetusPurposes,
  useOnboarding,
} from '../../src/onboarding/OnboardingContext';
import { CASE_A_PURPOSES } from '../../src/onboarding/types';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';

function purposeTestID(fetusIndex: number, label: string): string {
  const idx = CASE_A_PURPOSES.findIndex((p) => p.label === label);
  return `onboarding-b6-fetus-${fetusIndex}-chip-${idx}`;
}

function fetusHeader(nickname?: string, week?: number, index = 0): string {
  const name = (nickname ?? '').trim();
  const head = name.length > 0 ? name : `${index + 1}째 아이`;
  if (typeof week === 'number') {
    return `${head} (임신 ${week}주)`;
  }
  return head;
}

export default function OnboardingB6() {
  const router = useRouter();
  const {
    fetusCount,
    fetuses,
    togglePurposeForFetus,
    completeAsB,
  } = useOnboarding();

  const [submitting, setSubmitting] = useState(false);
  const [hasError, setHasError] = useState(false);

  const total = fetusCount ?? Math.max(fetuses.length, 1);
  // 카드 렌더링용으로 부족한 슬롯을 빈 객체로 채워준다 (저장은 toggle 시 발생).
  const slots = Array.from({ length: total }, (_, i) => fetuses[i] ?? {});

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
      <ProgressDots total={8} current={7} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <QuestionHeader
          title={'어떤 이야기를\n남기고 싶으세요?'}
          helper="아이마다 다른 톤의 가이드를 보내드려요"
        />
        <View style={styles.body}>
          {slots.map((f, i) => {
            const selected = f.purposes ?? defaultFetusPurposes();
            return (
              <Card
                key={i}
                padding="md"
                surface="cream"
                style={styles.fetusCard}
                testID={`onboarding-b6-fetus-card-${i}`}
              >
                <Text variant="caption" color="primary" style={styles.fetusHeader}>
                  🌱 {fetusHeader(f.nickname, f.pregnancyWeek, i)}
                </Text>
                <View style={styles.pillGrid}>
                  {CASE_A_PURPOSES.map((p) => (
                    <Pill
                      key={p.label}
                      label={p.label}
                      selected={selected.includes(p.label)}
                      onPress={() => togglePurposeForFetus(i, p.label)}
                      testID={purposeTestID(i, p.label)}
                    />
                  ))}
                </View>
              </Card>
            );
          })}
          <Text variant="caption" color="muted" style={styles.helper}>
            중복 선택 가능 · 기본값 추천됨
          </Text>
        </View>
      </ScrollView>

      <View style={styles.actions}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          testID="onboarding-b6-back"
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
  fetusCard: {
    backgroundColor: colors.bg.beige,
    gap: spacing[3],
  },
  fetusHeader: {
    fontWeight: '700',
    fontSize: 14,
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
