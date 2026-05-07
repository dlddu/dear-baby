// Onboarding M-02 — Q1 임신 중인가요?
// docs/mockups/source/src/screens/Onboarding.tsx:104-129
//
// PRD-006 AC-006-01 의 두 독립 체크 중 첫 번째. 답변을 OnboardingContext 의
// 인메모리 상태에만 저장하고 Q2 로 push 한다.

import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProgressDots } from '../../src/components/ProgressDots';
import { QuestionHeader } from '../../src/components/QuestionHeader';
import { Text } from '../../src/components/Text';
import { useOnboarding } from '../../src/onboarding/OnboardingContext';
import { colors } from '../../src/theme/colors';
import { radius } from '../../src/theme/radius';
import { spacing } from '../../src/theme/spacing';

export default function OnboardingQ1() {
  const router = useRouter();
  const { setQ1 } = useOnboarding();

  const onSelect = (value: boolean) => {
    setQ1(value);
    router.push('/(onboarding)/q2');
  };

  return (
    <SafeAreaView
      style={styles.safe}
      edges={['top', 'bottom']}
      testID="onboarding-q1"
    >
      <ProgressDots total={5} current={0} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <QuestionHeader
          eyebrow="QUESTION 1"
          title="지금 임신 중이신가요?"
          helper="기록을 어떻게 시작할지 정해드릴게요"
        />
        <View style={styles.options}>
          <Pressable
            accessibilityRole="button"
            testID="onboarding-q1-yes"
            onPress={() => onSelect(true)}
            style={({ pressed }) => [
              styles.option,
              pressed && styles.optionPressed,
            ]}
          >
            <Text variant="h3" color="primary" style={styles.optionTitle}>
              네, 임신 중이에요 🤰
            </Text>
            <Text variant="caption" color="secondary">
              태아의 기록을 시작합니다
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            testID="onboarding-q1-no"
            onPress={() => onSelect(false)}
            style={({ pressed }) => [
              styles.option,
              pressed && styles.optionPressed,
            ]}
          >
            <Text variant="h3" color="primary" style={styles.optionTitle}>
              아니요, 임신 중은 아니에요
            </Text>
            <Text variant="caption" color="secondary">
              양육 기록만 시작합니다
            </Text>
          </Pressable>
        </View>
      </ScrollView>
      <StatusBar style="dark" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.cream },
  scroll: { flex: 1 },
  content: { paddingBottom: spacing[8] },
  options: {
    paddingHorizontal: spacing[6],
    paddingTop: spacing[2],
    gap: spacing[3],
  },
  option: {
    padding: spacing[5],
    borderRadius: radius.md,
    backgroundColor: colors.surface.ivory,
    borderWidth: 2,
    borderColor: 'transparent',
    gap: 2,
  },
  optionPressed: {
    backgroundColor: colors.primary.coralTint,
    borderColor: colors.primary.coral,
  },
  optionTitle: { fontWeight: '600' },
});
