// Onboarding M-07 — B0 안내 ① (Case B 진입)
// docs/mockups/source/src/screens/Onboarding.tsx:340-383 (M07_B0_Intro1)
//
// PRD-006 AC-006-03 의 첫 화면. Case B 사용자에게 ① 양육 → ② 임신 →
// ③ 시작 의 3 단계 흐름을 미리 안내한다. 입력 없이 [네, 시작할게요] 로 b1
// (양육 아이 수)로 push 한다.

import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../../src/components/Button';
import { ProgressDots } from '../../src/components/ProgressDots';
import { StepCard } from '../../src/components/StepCard';
import { Text } from '../../src/components/Text';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';

const STEPS = [
  { glyph: '1', label: '기존 아이 정보', tone: 'sage' as const },
  { glyph: '2', label: '임신 중인 아이 정보', tone: 'peach' as const },
  { glyph: '3', label: '기록 시작', tone: 'coralTint' as const },
];

export default function OnboardingB0() {
  const router = useRouter();

  const onNext = () => {
    router.push('/(onboarding)/b1');
  };

  return (
    <SafeAreaView
      style={styles.safe}
      edges={['top', 'bottom']}
      testID="onboarding-b0"
    >
      <ProgressDots total={8} current={2} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.hero}>
          <Text variant="emotion" color="coral" style={styles.icon}>
            👶✨
          </Text>
          <Text variant="h2Serif" color="primary" style={styles.title}>
            먼저 키우고 계신{'\n'}아이부터 알려주세요
          </Text>
          <Text variant="body" color="secondary" style={styles.tagline}>
            이미 만난 아이의 기록과{'\n'}새로 시작하는 임신 기록을{'\n'}따로따로
            정리해드릴게요
          </Text>
        </View>
        <View style={styles.cardWrap}>
          <StepCard items={STEPS} testID="onboarding-b0-steps" />
        </View>
      </ScrollView>
      <View style={styles.actions}>
        <Button
          title="네, 시작할게요"
          variant="primary"
          fullWidth
          onPress={onNext}
          testID="onboarding-b0-next"
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
  icon: { fontSize: 48, lineHeight: 64 },
  title: { textAlign: 'center' },
  tagline: { textAlign: 'center', lineHeight: 22 },
  cardWrap: {
    paddingHorizontal: spacing[6],
    paddingTop: spacing[6],
  },
  actions: {
    paddingHorizontal: spacing[6],
    paddingTop: spacing[3],
    paddingBottom: spacing[3],
  },
});
