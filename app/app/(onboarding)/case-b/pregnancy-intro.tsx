// PRD-006 Case B · Intro ② — 양육 입력 마치고 임신 입력으로 진입.
// 양육 → 임신 순서를 시각적으로 굳히는 안내 화면.

import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../../../src/components/Button';
import { StepHeader } from '../../../src/components/onboarding/StepHeader';
import { Text } from '../../../src/components/Text';
import { colors } from '../../../src/theme/colors';
import { spacing } from '../../../src/theme/spacing';

export default function CaseBPregnancyIntro() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']} testID="case-b-pregnancy-intro">
      <StepHeader />
      <View style={styles.container}>
        <View style={styles.hero}>
          <Text variant="caption" color="secondary">
            ② / ②
          </Text>
          <Text variant="h2" color="primary" style={styles.title}>
            잘 알려주셨어요 💛
          </Text>
          <Text variant="body" color="secondary" style={styles.note}>
            이제 곧 만날 아기에 대해 여쭤볼게요
          </Text>
        </View>
        <Button
          title="계속하기"
          variant="primary"
          fullWidth
          onPress={() => router.push('/(onboarding)/case-b/multiple')}
          testID="case-b-pregnancy-intro-next"
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
  hero: { gap: spacing[4], alignItems: 'center', marginTop: spacing[8] },
  title: { textAlign: 'center' },
  note: { textAlign: 'center' },
});
