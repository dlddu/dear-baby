// Onboarding M-10 — B3 안내 ② (Case B 임신 단계 진입)
// docs/mockups/source/src/screens/Onboarding.tsx:465-499 (M10_B3_Intro2)
//
// PRD-006 AC-006-03 의 "양육 → 임신" 사이의 정서적 끊김 화면. 양육 입력이
// 끝났음을 단계 카드(✓·1·2)로 보여주고 [네, 입력할게요] 로 b4 (임신 아이
// 수)로 push 한다. mockup 의 "이미 입력된 아이" 미리보기는 본 코드에서는
// childCount 가 1 일 때 단순화하고, 다자녀일 때만 카운트만 노출한다.

import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { ProgressDots } from '../../src/components/ProgressDots';
import { StepCard } from '../../src/components/StepCard';
import { Text } from '../../src/components/Text';
import { useOnboarding } from '../../src/onboarding/OnboardingContext';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';

const STEPS = [
  { glyph: '✓', label: '기존 아이 정보', tone: 'sage' as const },
  { glyph: '1', label: '임신 중인 아이 정보', tone: 'peach' as const },
  { glyph: '2', label: '기록 시작', tone: 'coralTint' as const },
];

export default function OnboardingB3() {
  const router = useRouter();
  const { childCount, children } = useOnboarding();

  const totalChildren = childCount ?? Math.max(children.length, 1);
  const summary = (() => {
    if (totalChildren === 1) {
      const name = (children[0]?.name ?? '').trim();
      return name.length > 0 ? `${name} 입력 완료` : '아이 1명 입력 완료';
    }
    return `아이 ${totalChildren}명 입력 완료`;
  })();

  const onNext = () => {
    router.push('/(onboarding)/b4');
  };

  return (
    <SafeAreaView
      style={styles.safe}
      edges={['top', 'bottom']}
      testID="onboarding-b3"
    >
      <ProgressDots total={8} current={5} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.hero}>
          <Text variant="iconHero" color="coral">
            🌱
          </Text>
          <Text variant="h2Serif" color="primary" style={styles.title}>
            이제 곧 만날{'\n'}아이 차례예요
          </Text>
          <Text variant="tagline" color="secondary" style={styles.taglineAlign}>
            임신 중인 아이의 정보를 입력하면{'\n'}홈에서 아이별로 자유롭게{'\n'}전환할
            수 있어요
          </Text>
        </View>
        <View style={styles.cardWrap}>
          <StepCard items={STEPS} testID="onboarding-b3-steps" />
          <Card padding="md" surface="cream" style={styles.summaryCard}>
            <Text variant="caption" color="secondary">
              이미 입력된 아이
            </Text>
            <Text
              variant="body"
              color="primary"
              style={styles.summaryText}
              testID="onboarding-b3-summary"
            >
              {summary}
            </Text>
          </Card>
        </View>
      </ScrollView>
      <View style={styles.actions}>
        <Button
          title="네, 입력할게요"
          variant="primary"
          fullWidth
          onPress={onNext}
          testID="onboarding-b3-next"
        />
      </View>
      <StatusBar style="dark" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.cream },
  scroll: { flex: 1 },
  content: { paddingBottom: spacing[8] },
  hero: {
    alignItems: 'center',
    paddingHorizontal: spacing[6],
    paddingTop: spacing[6],
    gap: spacing[3],
  },
  title: { textAlign: 'center' },
  taglineAlign: { textAlign: 'center' },
  cardWrap: {
    paddingHorizontal: spacing[6],
    paddingTop: spacing[6],
    gap: spacing[3],
  },
  summaryCard: { gap: spacing[1] },
  summaryText: { fontWeight: '600' },
  actions: {
    paddingHorizontal: spacing[6],
    paddingTop: spacing[3],
    paddingBottom: spacing[3],
  },
});
