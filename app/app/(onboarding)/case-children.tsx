// PRD-006 S2 — AC-006-01 ② 독립 체크. "이미 태어난 아이가 있나요?"
// 답이 정해지면 두 답변의 조합으로 Case A/B/C 를 결정해 분기한다.
//
// Case 매핑 (AC-006-01):
//   임 O · 양 X → Case A
//   임 O · 양 O → Case B (양육 → 임신 순서 강제)
//   임 X · 양 O → Case C
//   임 X · 양 X → 정의되지 않음 — Case A 로 안내 + 카피로 양해 (와이어프레임 S2 메모)

import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../../src/components/Button';
import { StepHeader } from '../../src/components/onboarding/StepHeader';
import { Text } from '../../src/components/Text';
import { useOnboardingDraft } from '../../src/auth/onboardingDraft';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';

type Case = 'A' | 'B' | 'C';

function decideCase(isPregnant: boolean, hasChildren: boolean): Case {
  if (isPregnant && hasChildren) return 'B';
  if (!isPregnant && hasChildren) return 'C';
  return 'A';
}

export default function CaseChildren() {
  const router = useRouter();
  const { draft, update, loaded } = useOnboardingDraft();

  const choose = async (hasChildren: boolean) => {
    const isPregnant = draft.case?.isPregnant ?? false;
    await update({ case: { isPregnant, hasChildren } });
    const next = decideCase(isPregnant, hasChildren);
    if (next === 'A') {
      router.push('/(onboarding)/case-a/multiple');
    } else if (next === 'B') {
      router.push('/(onboarding)/case-b/intro');
    } else {
      router.push('/(onboarding)/case-c/count');
    }
  };

  if (!loaded) {
    return <SafeAreaView style={styles.safe} testID="onboarding-case-children" />;
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']} testID="onboarding-case-children">
      <StepHeader progress="2/2" />
      <View style={styles.container}>
        <View style={styles.hero}>
          <Text variant="h2" color="primary" style={styles.question}>
            이미 태어난{'\n'}아이가 있나요?
          </Text>
        </View>
        <View style={styles.actions}>
          <Button
            title="예"
            variant="primary"
            fullWidth
            onPress={() => choose(true)}
            testID="onboarding-children-yes"
          />
          <Button
            title="아니요"
            variant="secondary"
            fullWidth
            onPress={() => choose(false)}
            testID="onboarding-children-no"
          />
          <Text variant="caption" color="muted" style={styles.note}>
            ※ 임신 중도 아니고 양육 중인 아이도 없으시다면, 임신 흐름으로 안내해
            드릴게요. 가이드 문구가 어울리지 않을 수 있어 미리 양해를 구합니다.
          </Text>
        </View>
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
  question: { textAlign: 'center' },
  actions: { gap: spacing[3] },
  note: { textAlign: 'center', marginTop: spacing[4] },
});
