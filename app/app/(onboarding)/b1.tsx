// Onboarding M-08 — B1 양육 아이 수 (Case B 양육 단계 시작)
// docs/mockups/source/src/screens/Onboarding.tsx:388-405 (M08_B1_Count)
//
// PRD-006 AC-006-03 ① 의 첫 입력. 1/2/3+ 중 하나를 선택해
// `OnboardingContext.childCount` 에 저장하고 b2 (양육 아이 정보)로 push 한다.
// c1 과 동일한 컴포넌트 패턴 — 다만 ProgressDots 의 total/current 가 다르다
// (Case B 는 8단계).

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

export default function OnboardingB1() {
  const router = useRouter();
  const { childCount, setChildCount, setCurrentChildIndex } = useOnboarding();

  const onSelect = (value: ChildCount) => {
    setChildCount(value);
  };

  const onNext = () => {
    if (!childCount) return;
    // b2 ↔ b2-purpose 반복 진입의 시작점이므로 인덱스를 0 으로 정규화한다.
    setCurrentChildIndex(0);
    router.push('/(onboarding)/b2');
  };

  return (
    <SafeAreaView
      style={styles.safe}
      edges={['top', 'bottom']}
      testID="onboarding-b1"
    >
      <ProgressDots total={8} current={3} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <QuestionHeader
          title={'지금 키우고 계신\n아이는 몇 명인가요?'}
          helper="아이별로 기록을 따로 정리해드려요"
        />
        <View style={styles.body}>
          <NumberPicker
            value={childCount}
            onChange={onSelect}
            labels={['1명', '2명', '3명+']}
            testID="onboarding-b1-count"
          />
          <View style={styles.helperCard}>
            <Text variant="body" style={styles.helperEmoji}>
              💡
            </Text>
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
          testID="onboarding-b1-next"
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
  helperEmoji: { fontSize: 16 },
  helperText: { flex: 1, lineHeight: 20 },
  actions: {
    paddingHorizontal: spacing[6],
    paddingTop: spacing[3],
    paddingBottom: spacing[3],
  },
});
