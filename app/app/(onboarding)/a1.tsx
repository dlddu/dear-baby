// Onboarding M-04 — A1 임신 아이 수
// docs/mockups/source/src/screens/Onboarding.tsx:192-217
//
// PRD-006 AC-006-02 의 첫 번째 입력. 단태/쌍둥이/세쌍둥이+ 중 하나를 선택해
// `OnboardingContext.fetusCount` 에 저장하고 A2 로 push 한다.

import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../../src/components/Button';
import { NumberPicker } from '../../src/components/NumberPicker';
import { OnboardingTopRow } from '../../src/components/OnboardingTopRow';
import { QuestionHeader } from '../../src/components/QuestionHeader';
import { Text } from '../../src/components/Text';
import { useOnboarding } from '../../src/onboarding/OnboardingContext';
import type { FetusCount } from '../../src/onboarding/types';
import { colors } from '../../src/theme/colors';
import { radius } from '../../src/theme/radius';
import { spacing } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';

export default function OnboardingA1() {
  const router = useRouter();
  const { fetusCount, setFetusCount } = useOnboarding();

  const onSelect = (value: FetusCount) => {
    setFetusCount(value);
  };

  const onNext = () => {
    if (!fetusCount) return;
    router.push('/(onboarding)/a2');
  };

  return (
    <SafeAreaView
      style={styles.safe}
      edges={['top', 'bottom']}
      testID="onboarding-a1"
    >
      <OnboardingTopRow total={5} current={2} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <QuestionHeader
          title="몇 명을 품고 계신가요?"
          helper="아이 수에 맞춰 기록을 따로 정리해드려요"
        />
        <View style={styles.body}>
          <NumberPicker
            value={fetusCount}
            onChange={onSelect}
            testID="onboarding-a1-count"
          />
          <View style={styles.helperCard}>
            <Text variant="emoji">💡</Text>
            <Text variant="caption" color="secondary" style={styles.helperText}>
              나중에 설정에서 변경하실 수 있어요
            </Text>
          </View>
        </View>
      </ScrollView>
      <View style={styles.actions}>
        <Button
          title="다음"
          variant="primary"
          fullWidth
          disabled={!fetusCount}
          onPress={onNext}
          testID="onboarding-a1-next"
        />
      </View>
      <StatusBar style="dark" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.cream },
  scroll: { flex: 1 },
  content: { paddingBottom: spacing[8] },
  body: {
    paddingHorizontal: spacing[6],
    paddingTop: spacing[2],
    gap: spacing[5],
  },
  helperCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderRadius: radius.sm,
    backgroundColor: colors.bg.beige,
  },
  helperText: { flex: 1, lineHeight: typography.emoji.lineHeight },
  actions: {
    paddingHorizontal: spacing[6],
    paddingTop: spacing[3],
    paddingBottom: spacing[3],
  },
});
