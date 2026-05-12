// Onboarding M-14 — C1 양육 아이 수
// docs/mockups/source/src/screens/Onboarding.tsx:591-610
//
// PRD-006 AC-006-04 의 첫 번째 입력. 1/2/3+ 중 하나를 선택해
// `OnboardingContext.childCount` 에 저장하고 C2 로 push 한다.

import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../../src/components/Button';
import { NumberPicker } from '../../src/components/NumberPicker';
import { ProgressDots } from '../../src/components/ProgressDots';
import { QuestionHeader } from '../../src/components/QuestionHeader';
import { Text } from '../../src/components/Text';
import { useOnboarding } from '../../src/onboarding/OnboardingContext';
import type { ChildCount } from '../../src/onboarding/types';
import { colors } from '../../src/theme/colors';
import { radius } from '../../src/theme/radius';
import { spacing } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';

export default function OnboardingC1() {
  const router = useRouter();
  const { childCount, setChildCount } = useOnboarding();

  const onSelect = (value: ChildCount) => {
    setChildCount(value);
  };

  const onNext = () => {
    if (!childCount) return;
    router.push('/(onboarding)/c2');
  };

  return (
    <SafeAreaView
      style={styles.safe}
      edges={['top', 'bottom']}
      testID="onboarding-c1"
    >
      <ProgressDots total={4} current={1} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <QuestionHeader
          title={'지금 키우고 계신\n아이는 몇 명인가요?'}
          helper="아이별로 따로 기록을 정리해드려요"
        />
        <View style={styles.body}>
          <NumberPicker
            value={childCount}
            onChange={onSelect}
            labels={['1명', '2명', '3명+']}
            testID="onboarding-c1-count"
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
          disabled={!childCount}
          onPress={onNext}
          testID="onboarding-c1-next"
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
