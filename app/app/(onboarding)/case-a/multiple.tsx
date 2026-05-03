// PRD-006 Case A · 1/3 — 임신 아이 수(단태/다태) 선택. AC-006-02.
// 답에 따라 fetus 폼을 1회 또는 N회 반복한다. 본 화면은 N=1/2 까지만
// 직접 모델링하고 (단태/다태), 다태 N≥3 은 후속 작업으로 미룬다.

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

const emptyPregnancyDraft: ChildDraft = {
  status: 'pregnancy',
  name: null,
  gender: 'unknown',
  birth_date: null,
  due_date: null,
  pregnancy_week: null,
  bio: null,
  photo_s3_key: null,
  is_due_date_undecided: false,
};

export default function CaseAMultiple() {
  const router = useRouter();
  const { update } = useOnboardingDraft();

  const choose = async (multiple: boolean) => {
    const count = multiple ? 2 : 1;
    const slots = Array.from({ length: count }, () => ({ ...emptyPregnancyDraft }));
    const purposes = Array.from({ length: count }, () => [] as string[]);
    await update({
      multiplePregnancy: multiple,
      children: slots,
      purposes,
    });
    router.push('/(onboarding)/case-a/fetus/0');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']} testID="case-a-multiple">
      <StepHeader progress="Case A · 1/3" />
      <View style={styles.container}>
        <Text variant="h2" color="primary" style={styles.title}>
          몇 명의 아기가{'\n'}찾아왔나요?
        </Text>
        <View style={styles.actions}>
          <Button
            title="👶  한 명 (단태)"
            variant="secondary"
            fullWidth
            onPress={() => choose(false)}
            testID="case-a-single"
          />
          <Button
            title="👶👶 둘 이상 (다태)"
            variant="secondary"
            fullWidth
            onPress={() => choose(true)}
            testID="case-a-multiple-yes"
          />
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
