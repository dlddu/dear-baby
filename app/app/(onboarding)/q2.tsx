// Onboarding M-03 — Q2 양육 중인 아이가 있나요?
// docs/mockups/source/src/screens/Onboarding.tsx:134-159
//
// PRD-006 AC-006-01 의 두 독립 체크 중 두 번째. Q1 답변과 조합해 Case A/B/C
// (또는 fallback-A) 로 분기한다. 분기 결과가 'A' 혹은 'fallback-A' 이면
// 기존 welcome 화면(예정일 입력)으로 push, 'B'/'C' 면 not-ready placeholder
// 로 push.

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

export default function OnboardingQ2() {
  const router = useRouter();
  const { q1Pregnant, setQ2 } = useOnboarding();

  const onSelect = (value: boolean) => {
    setQ2(value);
    // q1Pregnant 가 null 인 경우는 사용자가 Q2 로 직접 진입한 비정상 흐름.
    // 이 때는 안전 기본값으로 임신 미상태(fallback-A) 로 처리해 welcome 으로 보낸다.
    const q1 = q1Pregnant ?? false;
    const goesToWelcome = q1 ? !value : true; // A 또는 fallback-A
    if (goesToWelcome) {
      router.push('/(onboarding)/welcome');
    } else {
      router.push('/(onboarding)/not-ready');
    }
  };

  return (
    <SafeAreaView
      style={styles.safe}
      edges={['top', 'bottom']}
      testID="onboarding-q2"
    >
      <ProgressDots total={5} current={1} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <QuestionHeader
          eyebrow="QUESTION 2"
          title={'이미 키우고 계신\n아이가 있나요?'}
          helper="아이별로 따로 기록을 정리해드릴게요"
        />
        <View style={styles.options}>
          <Pressable
            accessibilityRole="button"
            testID="onboarding-q2-yes"
            onPress={() => onSelect(true)}
            style={({ pressed }) => [
              styles.option,
              pressed && styles.optionPressed,
            ]}
          >
            <Text variant="h3" color="primary" style={styles.optionTitle}>
              네, 있어요 👶
            </Text>
            <Text variant="caption" color="secondary">
              기존 아이 정보부터 입력합니다
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            testID="onboarding-q2-no"
            onPress={() => onSelect(false)}
            style={({ pressed }) => [
              styles.option,
              pressed && styles.optionPressed,
            ]}
          >
            <Text variant="h3" color="primary" style={styles.optionTitle}>
              아니요, 첫 아이예요 ✨
            </Text>
            <Text variant="caption" color="secondary">
              곧 만날 아이의 기록을 시작합니다
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
