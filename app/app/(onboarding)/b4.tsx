// Onboarding M-11 — B4 임신 아이 수 (Case B 임신 단계 시작)
// docs/mockups/source/src/screens/Onboarding.tsx:505-522 (M11_B4_PregnancyCount)
//
// PRD-006 AC-006-03 ② 의 첫 입력. 단태/다태 중 하나를 선택해
// `OnboardingContext.fetusCount` 에 저장하고 b5 (태아 정보)로 push 한다.
// a1 과 동일한 패턴 — ProgressDots 만 Case B 의 8 단계에 맞춰 갱신.

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
import type { FetusCount } from '../../src/onboarding/types';
import { colors } from '../../src/theme/colors';
import { radius } from '../../src/theme/radius';
import { spacing } from '../../src/theme/spacing';

export default function OnboardingB4() {
  const router = useRouter();
  const { fetusCount, setFetusCount, setCurrentFetusIndex } = useOnboarding();

  const onSelect = (value: FetusCount) => {
    setFetusCount(value);
  };

  const onNext = () => {
    if (!fetusCount) return;
    // b5 진입 시 인덱스를 0 으로 정규화 — 다태에서 b5 는 매 [다음] 마다
    // index 매개변수를 증가시키며 새 인스턴스를 stack 에 push 한다.
    setCurrentFetusIndex(0);
    router.push({
      pathname: '/(onboarding)/b5',
      params: { index: '0' },
    });
  };

  return (
    <SafeAreaView
      style={styles.safe}
      edges={['top', 'bottom']}
      testID="onboarding-b4"
    >
      <ProgressDots total={8} current={6} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <QuestionHeader
          title={'이번에는 몇 명을\n품고 계신가요?'}
          helper="단태아라면 1을 골라주세요"
        />
        <View style={styles.body}>
          <NumberPicker
            value={fetusCount}
            onChange={onSelect}
            testID="onboarding-b4-count"
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
          disabled={!fetusCount}
          onPress={onNext}
          testID="onboarding-b4-next"
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
