// B3 — 임신 단계 안내 (PRD-006 AC-006-03 ②)

import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../../../src/components/Button';
import { Text } from '../../../src/components/Text';
import {
  CaseAccentTheme,
  OnboardingProgressBar,
  StepIndicator,
} from '../../../src/components/onboarding';
import { colors } from '../../../src/theme/colors';
import { spacing } from '../../../src/theme/spacing';

export default function CaseBIntro2() {
  const router = useRouter();
  return (
    <CaseAccentTheme case="B">
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']} testID="onboarding-case-b-intro2">
        <OnboardingProgressBar n={4} of={7} />
        <View style={styles.body}>
          <View style={styles.hero}>
            <StepIndicator active="two" testID="case-b-intro2-step" />
            <Text variant="h2" color="primary" style={styles.heading}>
              이제 임신 중인 아이를 알려주세요
            </Text>
            <Text variant="emotion" color="secondary" style={styles.helper}>
              짧게 만나기 전 정보만 받을게요.
            </Text>
          </View>
          <Button
            title="계속하기"
            variant="primary"
            fullWidth
            onPress={() => router.push('/(onboarding)/case-b/count2')}
            testID="case-b-intro2-next"
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
