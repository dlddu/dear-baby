// PRD-006 Case B · Intro ① — 양육 중인 아이부터 입력. AC-006-03 의
// "양육 → 임신 순서 강제" 를 화면 흐름으로 명시한다. 이 안내 화면은
// 정보 수집이 없으므로 draft 변경 없이 단순 next.

import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../../../src/components/Button';
import { StepHeader } from '../../../src/components/onboarding/StepHeader';
import { Text } from '../../../src/components/Text';
import { colors } from '../../../src/theme/colors';
import { spacing } from '../../../src/theme/spacing';

export default function CaseBIntro() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']} testID="case-b-intro">
      <StepHeader />
      <View style={styles.container}>
        <View style={styles.hero}>
          <Text variant="caption" color="secondary">
            ① / ②
          </Text>
          <Text variant="h2" color="primary" style={styles.title}>
            먼저, 지금 함께 살고{'\n'}있는 아이부터 알려{'\n'}주세요 🌱
          </Text>
          <Text variant="body" color="secondary" style={styles.note}>
            다음 단계에서 임신 중인 아기에 대해 여쭤볼게요
          </Text>
        </View>
        <Button
          title="시작하기"
          variant="primary"
          fullWidth
          onPress={() => router.push('/(onboarding)/case-b/count')}
          testID="case-b-intro-next"
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
