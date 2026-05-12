// Onboarding M-16 — C3 양육 아이 기록 목적
// docs/mockups/source/src/screens/Onboarding.tsx:631-661 (M16_C3_Purpose)
//
// PRD-006 AC-006-04 의 마지막 입력. 양육 아이마다 칩 8개에서 다중 선택한
// 한국어 라벨을 `OnboardingContext.children[childIndex].purposes` 에 저장한다.
// c2 와 1:1 짝을 이뤄 정보 → 목적 → 정보 → 목적 … 흐름을 만든다 (Case B 의
// b2 ↔ b2-purpose 패턴과 동일).
//
// 각 인스턴스는 라우트 매개변수 `index` 로 자기 양육 아이 인덱스를 받아
// stack 의 다른 인스턴스와 독립적으로 데이터를 그린다. context 의
// currentChildIndex 는 영속화·복원 용도로만 갱신된다 (drafts cache).
//
// CTA 라벨은 마지막 아이가 아니면 "다음 아이", 마지막이면 "시작하기 ✨" —
// 마지막 아이의 [시작하기] 에서 모든 양육 아이 행을 한 번에 영속화한다
// (`completeAsC()`).

import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackLink } from '../../src/components/BackLink';
import { Badge } from '../../src/components/Badge';
import { Button } from '../../src/components/Button';
import { ProgressDots } from '../../src/components/ProgressDots';
import { QuestionHeader } from '../../src/components/QuestionHeader';
import { Text } from '../../src/components/Text';
import {
  defaultChildPurposes,
  useOnboarding,
} from '../../src/onboarding/OnboardingContext';
import { Pill } from '../../src/components/Pill';
import { CASE_C_PURPOSES } from '../../src/onboarding/types';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';

function purposeTestID(label: string): string {
  const idx = CASE_C_PURPOSES.findIndex((p) => p.label === label);
  return `onboarding-c3-purpose-${idx}`;
}

export default function OnboardingC3() {
  const router = useRouter();
  const params = useLocalSearchParams<{ index?: string }>();
  // 라우트 매개변수가 없거나 파싱이 실패하면 0 으로 fallback (c2 → c3 첫 진입).
  const parsed = Number.parseInt(params.index ?? '0', 10);
  const childIndex = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;

  const {
    childCount,
    children,
    setCurrentChildIndex,
    togglePurposeForChild,
    completeAsC,
  } = useOnboarding();

  const total = childCount ?? Math.max(children.length, 1);
  const child = children[childIndex] ?? {};
  // 빈 슬롯에서는 양육 톤의 기본 칩을 보여 준다 — togglePurposeForChild 가
  // 첫 토글 시 default 셋을 슬롯에 한 번 채운 뒤 토글 결과를 반영한다.
  const selected = child.purposes ?? defaultChildPurposes();

  const headerLabel = (() => {
    const name = (child.name ?? '').trim();
    return name.length > 0 ? `${name}` : `${childIndex + 1}째 아이`;
  })();

  const isLast = childIndex >= total - 1;

  const [submitting, setSubmitting] = useState(false);
  const [hasError, setHasError] = useState(false);

  const onNext = async () => {
    if (submitting) return;
    if (!isLast) {
      const nextIndex = childIndex + 1;
      setCurrentChildIndex(nextIndex);
      router.push({
        pathname: '/(onboarding)/c2',
        params: { index: String(nextIndex) },
      });
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

  const ctaTitle = isLast
    ? submitting
      ? '저장 중…'
      : '시작하기 ✨'
    : '다음 아이';

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
            label={`${childIndex + 1}/${total}`}
            variant="category"
            testID={`onboarding-c3-child-index-${childIndex}`}
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
          title={`${headerLabel} 의\n어떤 이야기를 남길까요?`}
          helper="이 주제에 맞춘 질문을 매일 보내드려요"
        />
        <View style={styles.body}>
          <View style={styles.pillGrid}>
            {CASE_C_PURPOSES.map((p) => (
              <Pill
                key={p.label}
                label={p.label}
                selected={selected.includes(p.label)}
                onPress={() => togglePurposeForChild(childIndex, p.label)}
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
        <BackLink onPress={() => router.back()} testID="onboarding-c3-back" />
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
  error: { textAlign: 'center' },
});
