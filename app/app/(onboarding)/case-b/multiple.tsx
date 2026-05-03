// PRD-006 Case B · 4/6 — 임신 단태/다태 선택. 양육 슬롯에 임신 슬롯을
// append 하고 첫 fetus 화면으로 이동한다. purposes 도 같이 늘려준다.

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

const emptyPregnancy: ChildDraft = {
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

export default function CaseBMultiple() {
  const router = useRouter();
  const { draft, update, loaded } = useOnboardingDraft();

  const choose = async (multiple: boolean) => {
    const count = multiple ? 2 : 1;
    // Drop any prior pregnancy slots so toggling between 단태/다태 doesn't
    // leave orphans. Keeps purposes aligned by trimming/extending in lock-step.
    const parenting = draft.children.filter((c) => c.status === 'parenting');
    const parentingPurposes = draft.purposes.slice(0, parenting.length);
    const pregnancySlots = Array.from({ length: count }, () => ({ ...emptyPregnancy }));
    const pregnancyPurposes = Array.from({ length: count }, () => [] as string[]);

    await update({
      multiplePregnancy: multiple,
      children: [...parenting, ...pregnancySlots],
      purposes: [...parentingPurposes, ...pregnancyPurposes],
    });
    router.push(`/(onboarding)/case-b/fetus/${parenting.length}`);
  };

  if (!loaded) {
    return <SafeAreaView style={styles.safe} testID="case-b-multiple" />;
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']} testID="case-b-multiple">
      <StepHeader progress="Case B · 4/6" />
      <View style={styles.container}>
        <Text variant="h2" color="primary" style={styles.title}>
          곧 만날 아기는{'\n'}몇 명인가요?
        </Text>
        <View style={styles.actions}>
          <Button title="한 명 (단태)" variant="secondary" fullWidth onPress={() => choose(false)} testID="case-b-single" />
          <Button title="둘 이상 (다태)" variant="secondary" fullWidth onPress={() => choose(true)} testID="case-b-multiple-yes" />
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
