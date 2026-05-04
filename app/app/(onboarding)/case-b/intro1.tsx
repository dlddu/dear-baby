// B0 — 양육 단계 안내 (PRD-006 AC-006-03 ①)

import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../../../src/components/Button';
import { Text } from '../../../src/components/Text';
import {
  CaseAccentTheme,
  IntroIllustration,
  OnboardingProgressBar,
  StepIndicator,
} from '../../../src/components/onboarding';
import { colors } from '../../../src/theme/colors';
import { spacing } from '../../../src/theme/spacing';

export default function CaseBIntro1() {
  const router = useRouter();
  return (
    <CaseAccentTheme case="B">
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']} testID="onboarding-case-b-intro1">
        <OnboardingProgressBar n={1} of={7} label="Case B · 1단계" />
        <View style={styles.body}>
          <View style={styles.hero}>
            <StepIndicator active="one" testID="case-b-intro1-step" />
            <Text variant="h2" color="primary" style={styles.heading}>
              양육 중인 아이를 먼저 알려주세요
            </Text>
            <Text variant="emotion" color="secondary" style={styles.helper}>
              곧 임신 중인 아이도 함께 이어서 입력해요.
            </Text>
            <IntroIllustration variant="caregiver" />
          </View>
          <Button
            title="시작하기"
            variant="primary"
            fullWidth
            onPress={() => router.push('/(onboarding)/case-b/count1')}
            testID="case-b-intro1-next"
          />
        </View>
        <StatusBar style="dark" />
      </SafeAreaView>
    </CaseAccentTheme>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.cream },
  body: {
    flex: 1,
    paddingHorizontal: spacing[6],
    paddingTop: spacing[8],
    paddingBottom: spacing[6],
    justifyContent: 'space-between',
  },
  hero: { gap: spacing[5], alignItems: 'center' },
  heading: { textAlign: 'center' },
  helper: { textAlign: 'center' },
});
