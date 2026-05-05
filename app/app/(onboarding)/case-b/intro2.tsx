// B3 — Case B 2단계 안내 ("이제 임신 중인 아이를 알려주세요"). 단계
// 인디케이터 ① 완료 + ② 활성. 와이어프레임: case-b.svg, B3.

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

export default function CaseBIntro2() {
  const router = useRouter();
  const onNext = async () => {
    await saveDraft({ last_step: '/case-b/intro2' });
    router.push('/(onboarding)/case-b/count2');
  };

  return (
    <CaseAccentTheme case="B">
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']} testID="case-b-intro2">
        <View style={styles.container}>
          <CaseHeader step={4} totalSteps={7} label="Case B · 2단계" />
          <View style={styles.indicatorRow}>
            <StepIndicator active={2} />
          </View>
          <Text variant="h2" color="primary" style={styles.heading}>
            이제 임신 중인{'\n'}아이를 알려주세요
          </Text>
          <Text variant="body" color="secondary" style={styles.subhead}>
            새로 만날 아이를 위한{'\n'}기록 공간을 만들어요
          </Text>
        </View>
        <View style={styles.footer}>
          <Button
            title="계속하기"
            variant="primary"
            fullWidth
            onPress={onNext}
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
