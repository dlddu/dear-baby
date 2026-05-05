// B0 — Case B 1단계 안내 ("양육 중인 아이를 먼저 알려주세요").
// 단계 인디케이터 ① 활성. 와이어프레임: docs/wireframes/onboarding/case-b.svg, B0.

import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../../../src/components/Button';
import { Text } from '../../../src/components/Text';
import {
  CaseAccentTheme,
  CaseHeader,
  StepIndicator,
} from '../../../src/components/onboarding';
import { saveDraft } from '../../../src/onboarding/draft';
import { colors } from '../../../src/theme/colors';
import { spacing } from '../../../src/theme/spacing';

export default function CaseBIntro1() {
  const router = useRouter();
  const onStart = async () => {
    await saveDraft({ last_step: '/case-b/intro1' });
    router.push('/(onboarding)/case-b/count1');
  };

  return (
    <CaseAccentTheme case="B">
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']} testID="case-b-intro1">
        <View style={styles.container}>
          <CaseHeader step={1} totalSteps={7} label="Case B · 1단계" />
          <View style={styles.indicatorRow}>
            <StepIndicator active={1} />
          </View>
          <Text variant="h2" color="primary" style={styles.heading}>
            양육 중인 아이를{'\n'}먼저 알려주세요
          </Text>
          <Text variant="body" color="secondary" style={styles.subhead}>
            이미 함께 자란 아이부터{'\n'}차근차근 입력해요
          </Text>
        </View>
        <View style={styles.footer}>
          <Button
            title="시작하기"
            variant="primary"
            fullWidth
            onPress={onStart}
            testID="case-b-intro1-start"
          />
        </View>
        <StatusBar style="dark" />
      </SafeAreaView>
    </CaseAccentTheme>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.cream },
  container: {
    flex: 1,
    paddingHorizontal: spacing[6],
    paddingTop: spacing[6],
  },
  indicatorRow: { alignItems: 'flex-start', marginBottom: spacing[8] },
  heading: { textAlign: 'center', marginBottom: spacing[4] },
  subhead: { textAlign: 'center' },
  footer: {
    paddingHorizontal: spacing[6],
    paddingBottom: spacing[6],
    paddingTop: spacing[3],
  },
});
