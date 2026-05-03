// PRD-006 Case B · 1/6 — 양육 중 아이 수. 양육 N 만 시드하고 임신 N 은
// pregnancy-intro 이후 multiple 화면에서 추가 시드한다. 양육 → 임신
// 순서를 보장하기 위해 임신 슬롯을 이 단계에서는 만들지 않는다.

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

const emptyParenting: ChildDraft = {
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

export default function CaseBCount() {
  const router = useRouter();
  const { update } = useOnboardingDraft();

  const choose = async (count: number) => {
    const slots = Array.from({ length: count }, () => ({ ...emptyParenting }));
    const purposes = Array.from({ length: count }, () => [] as string[]);
    await update({ children: slots, purposes });
    router.push('/(onboarding)/case-b/child/0');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']} testID="case-b-count">
      <StepHeader progress="Case B · 1/6" />
      <View style={styles.container}>
        <Text variant="h2" color="primary" style={styles.title}>
          양육 중인 아이가{'\n'}몇 명인가요?
        </Text>
        <View style={styles.actions}>
          <Button title="1 명" variant="secondary" fullWidth onPress={() => choose(1)} testID="case-b-count-1" />
          <Button title="2 명" variant="secondary" fullWidth onPress={() => choose(2)} testID="case-b-count-2" />
          <Button title="3 명 이상" variant="secondary" fullWidth onPress={() => choose(3)} testID="case-b-count-3" />
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
