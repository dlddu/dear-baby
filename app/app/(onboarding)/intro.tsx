// PRD-006 S0 — 감성 웰컴. The user lands here right after sign-in and
// taps `시작하기` to begin the case-branching funnel. No data is captured
// on this screen; it exists to set the tone before the two-question
// independent-check sequence (S1 / S2).

import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../../src/components/Button';
import { Text } from '../../src/components/Text';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';

export default function OnboardingIntro() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']} testID="onboarding-intro">
      <View style={styles.container}>
        <View style={styles.hero}>
          <Text variant="display" color="primary" style={styles.logo}>
            DearBaby
          </Text>
          <Text variant="emotion" color="secondary" style={styles.tagline}>
            당신의 이야기를{'\n'}책 한 권으로,{'\n'}아이에게 선물하세요.
          </Text>
        </View>
        <Button
          title="시작하기"
          variant="primary"
          fullWidth
          onPress={() => router.push('/(onboarding)/case-pregnancy')}
          testID="onboarding-intro-start"
        />
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
  hero: { alignItems: 'center', gap: spacing[4], marginTop: spacing[8] },
  logo: { textAlign: 'center' },
  tagline: { textAlign: 'center' },
});
