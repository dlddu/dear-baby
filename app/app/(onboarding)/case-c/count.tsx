// PRD-006 Case C · 1/3 — 양육 중 아이 수 (1/2/3+) 선택. AC-006-04.
// 3+ 는 동적 추가가 필요하지만 본 화면은 3 슬롯 까지만 시드하고
// 자세한 입력은 child/[index] 단계에서 (총 3개) 끝낸다.

import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../../../src/components/Button';
import { StepHeader } from '../../../src/components/onboarding/StepHeader';
import { Text } from '../../../src/components/Text';
import {
  type ChildDraft,
  useOnboardingDraft,
} from '../../../src/auth/onboardingDraft';
import { colors } from '../../../src/theme/colors';
import { spacing } from '../../../src/theme/spacing';

const emptyParentingDraft: ChildDraft = {
  status: 'parenting',
  name: null,
  gender: 'unknown',
  birth_date: null,
  due_date: null,
  pregnancy_week: null,
  bio: null,
  photo_s3_key: null,
  is_due_date_undecided: false,
};

export default function CaseCCount() {
  const router = useRouter();
  const { update } = useOnboardingDraft();

  const choose = async (count: number) => {
    const slots = Array.from({ length: count }, () => ({ ...emptyParentingDraft }));
    const purposes = Array.from({ length: count }, () => [] as string[]);
    await update({ children: slots, purposes });
    router.push('/(onboarding)/case-c/child/0');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']} testID="case-c-count">
      <StepHeader progress="Case C · 1/3" />
      <View style={styles.container}>
        <Text variant="h2" color="primary" style={styles.title}>
          양육 중인 아이가{'\n'}몇 명인가요?
        </Text>
        <View style={styles.actions}>
          <Button title="1 명" variant="secondary" fullWidth onPress={() => choose(1)} testID="case-c-count-1" />
          <Button title="2 명" variant="secondary" fullWidth onPress={() => choose(2)} testID="case-c-count-2" />
          <Button title="3 명 이상" variant="secondary" fullWidth onPress={() => choose(3)} testID="case-c-count-3" />
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
    gap: spacing[8],
  },
  title: { textAlign: 'center', marginTop: spacing[8] },
  actions: { gap: spacing[3] },
});
