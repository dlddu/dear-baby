// Onboarding — B2-Purpose 양육 아이 기록 목적 (Case B, mockup 외 신설)
//
// PRD-006 AC-006-03 ③ — "아이별로 다른 목적을 선택할 수 있다" 의 양육 아이
// 절반. mockup M-13 (B6) 가 양육·임신 두 카드를 한 화면에 보여주지만,
// AC-006-03 ① 의 "양육 아이 먼저" 입력 순서와 1:1 매칭을 위해 양육 아이는
// 정보 입력 직후(b2 직후) 1:1 화면으로 분리한다. 시각 명세는 b2/b6 의 카드
// 패턴을 그대로 모방 — 추가 mockup 화면이 필요 없다는 결정.
//
// 흐름:
//   currentChildIndex < childCount - 1 → 다음 아이의 b2 로 push (인덱스 ++)
//   마지막 아이                          → b3 (인트로 ②) 로 push

import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackLink } from '../../src/components/BackLink';
import { Badge } from '../../src/components/Badge';
import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { Pill } from '../../src/components/Pill';
import { ProgressDots } from '../../src/components/ProgressDots';
import { QuestionHeader } from '../../src/components/QuestionHeader';
import { Text } from '../../src/components/Text';
import {
  defaultChildPurposes,
  useOnboarding,
} from '../../src/onboarding/OnboardingContext';
import { CASE_C_PURPOSES } from '../../src/onboarding/types';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';

function purposeTestID(label: string): string {
  const idx = CASE_C_PURPOSES.findIndex((p) => p.label === label);
  return `onboarding-b2-purpose-chip-${idx}`;
}

export default function OnboardingB2Purpose() {
  const router = useRouter();
  const {
    childCount,
    children,
    currentChildIndex,
    setCurrentChildIndex,
    togglePurposeForChild,
  } = useOnboarding();

  const total = childCount ?? Math.max(children.length, 1);
  const child = children[currentChildIndex] ?? {};
  // 빈 슬롯에서는 양육 톤의 기본 칩을 보여 준다 — togglePurposeForChild 가
  // 첫 토글 시 default 셋을 슬롯에 한 번 채운 뒤 토글 결과를 반영한다.
  const selected = child.purposes ?? defaultChildPurposes();

  const headerLabel = (() => {
    const name = (child.name ?? '').trim();
    return name.length > 0 ? `${name}` : `${currentChildIndex + 1}째 아이`;
  })();

  const onNext = () => {
    if (currentChildIndex < total - 1) {
      setCurrentChildIndex(currentChildIndex + 1);
      router.push('/(onboarding)/b2');
      return;
    }
    router.push('/(onboarding)/b3');
  };

  return (
    <SafeAreaView
      style={styles.safe}
      edges={['top', 'bottom']}
      testID="onboarding-b2-purpose"
    >
      <View style={styles.topRow}>
        <ProgressDots total={8} current={4} style={styles.progress} />
        {total > 1 && (
          <Badge
            label={`${currentChildIndex + 1}/${total}`}
            variant="category"
            testID={`onboarding-b2-purpose-child-index-${currentChildIndex}`}
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
          <Card padding="md" surface="cream" style={styles.chipCard}>
            <View style={styles.pillGrid}>
              {CASE_C_PURPOSES.map((p) => (
                <Pill
                  key={p.label}
                  label={p.label}
                  selected={selected.includes(p.label)}
                  onPress={() => togglePurposeForChild(currentChildIndex, p.label)}
                  testID={purposeTestID(p.label)}
                />
              ))}
            </View>
          </Card>
          <Text variant="caption" color="muted" style={styles.helper}>
            중복 선택 가능 · 기본값 추천됨
          </Text>
        </View>
      </ScrollView>

      <View style={styles.actions}>
        <BackLink
          onPress={() => router.back()}
          testID="onboarding-b2-purpose-back"
        />
        <Button
          title="다음"
          variant="primary"
          fullWidth
          onPress={onNext}
          testID="onboarding-b2-purpose-next"
        />
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
  chipCard: {
    backgroundColor: colors.bg.beige,
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
});
