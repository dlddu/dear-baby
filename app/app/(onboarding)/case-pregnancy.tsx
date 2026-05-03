// PRD-006 S1 — AC-006-01 ① 독립 체크. "현재 임신 중이신가요?"
// 답을 draft 에 저장하고 S2 (case-children) 로 진행한다.

import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../../src/components/Button';
import { StepHeader } from '../../src/components/onboarding/StepHeader';
import { Text } from '../../src/components/Text';
import { useOnboardingDraft } from '../../src/auth/onboardingDraft';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';

export default function CasePregnancy() {
  const router = useRouter();
  const { draft, update } = useOnboardingDraft();

  const choose = async (isPregnant: boolean) => {
    const prior = draft.case;
    await update({
      case: {
        isPregnant,
        hasChildren: prior?.hasChildren ?? false,
      },
    });
    router.push('/(onboarding)/case-children');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']} testID="onboarding-case-pregnancy">
      <StepHeader progress="1/2" />
      <View style={styles.container}>
        <View style={styles.hero}>
          <Text variant="emotion" color="primary" style={styles.intro}>
            먼저 두 가지만{'\n'}여쭤볼게요
          </Text>
          <Text variant="h2" color="primary" style={styles.question}>
            현재 임신 중이신가요?
          </Text>
        </View>
        <View style={styles.actions}>
          <Button
            title="예"
            variant="primary"
            fullWidth
            onPress={() => choose(true)}
            testID="onboarding-pregnant-yes"
          />
          <Button
            title="아니요"
            variant="secondary"
            fullWidth
            onPress={() => choose(false)}
            testID="onboarding-pregnant-no"
          />
        </View>
      </View>
      <StatusBar style="dark" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.cream },
  container: {
    flex: 1,
    paddingHorizontal: spacing[6],
    paddingTop: spacing[8],
    paddingBottom: spacing[6],
    justifyContent: 'space-between',
  },
  hero: { gap: spacing[4], alignItems: 'center', marginTop: spacing[8] },
  intro: { textAlign: 'center' },
  question: { textAlign: 'center' },
  actions: { gap: spacing[3] },
});
