// Onboarding M-16 — C3 기록 목적 (자녀별)
// docs/mockups/source/src/screens/Onboarding.tsx:631-661 (M16_C3_Purpose)
//
// PRD-006 AC-006-04 의 마지막 입력. 사용자가 칩 8개에서 다중 선택한
// 한국어 라벨을 자녀별 `children[currentChildIndex].purposes` 에 저장한다.
// 다자녀인 경우 [다음] 으로 인덱스를 증가시켜 같은 화면을 반복 렌더하고,
// 마지막 아이의 [시작하기 ✨] 에서 `completeAsC()` 한 번에 백엔드에
// 영속화한다. c2 의 인덱스 뱃지 패턴과 동일하다.

import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Badge } from '../../src/components/Badge';
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
  const {
    childCount,
    children,
    currentChildIndex,
    setCurrentChildIndex,
    togglePurposeForChild,
    ensureChildPurposesDefault,
    completeAsC,
  } = useOnboarding();

  const total = childCount ?? 1;
  const child = children[currentChildIndex] ?? {};
  const childPurposes = child.purposes ?? [];
  const isLastChild = currentChildIndex >= total - 1;

  // 첫 진입 시 자녀별 purposes 가 아직 비어있다면(=undefined) 기본 칩 두 개를
  // 미리 채운다. 사용자가 명시적으로 모두 해제한 빈 배열은 그대로 보존된다.
  useEffect(() => {
    ensureChildPurposesDefault(currentChildIndex);
  }, [ensureChildPurposesDefault, currentChildIndex]);

  const [submitting, setSubmitting] = useState(false);
  const [hasError, setHasError] = useState(false);

  const onNext = async () => {
    if (submitting) return;
    if (!isLastChild) {
      setCurrentChildIndex(currentChildIndex + 1);
      return;
    }
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

  const onBack = () => {
    if (currentChildIndex > 0) {
      setCurrentChildIndex(currentChildIndex - 1);
      return;
    }
    router.back();
  };

  const ctaTitle = submitting
    ? '저장 중…'
    : isLastChild
      ? '시작하기 ✨'
      : '다음';

  return (
    <SafeAreaView
      style={styles.safe}
      edges={['top', 'bottom']}
      testID="onboarding-c3"
    >
      <View style={styles.topRow}>
        <ProgressDots total={4} current={3} style={styles.progress} />
        {total > 1 && (
          <Badge
            label={`${currentChildIndex + 1}/${total}`}
            variant="category"
            testID={`onboarding-c3-child-index-${currentChildIndex}`}
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
          title={'어떤 이야기를\n남기고 싶으세요?'}
          helper="이 주제에 맞춘 질문을 매일 보내드려요"
        />
        <View style={styles.body}>
          <View style={styles.pillGrid}>
            {CASE_C_PURPOSES.map((p) => (
              <Pill
                key={p.label}
                label={p.label}
                selected={childPurposes.includes(p.label)}
                onPress={() => togglePurposeForChild(currentChildIndex, p.label)}
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
          onPress={onBack}
          accessibilityRole="button"
          testID="onboarding-c3-back"
          style={({ pressed }) => [styles.backLink, pressed && styles.pressed]}
        >
          <Text variant="caption" color="secondary" style={styles.backText}>
            {currentChildIndex > 0 ? '← 이전 아이로' : '← 이전으로'}
          </Text>
        </Pressable>
        <Button
          title={ctaTitle}
          variant="primary"
          fullWidth
          disabled={submitting}
          onPress={onNext}
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
