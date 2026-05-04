// B5 — 태아 정보 입력 (반복) (PRD-006 AC-006-03 ②)

import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../../../src/components/Button';
import { Text } from '../../../src/components/Text';
import {
  CaseAccentTheme,
  FetusForm,
  type FetusFormValues,
  OnboardingProgressBar,
  RepeatBadge,
} from '../../../src/components/onboarding';
import {
  loadDraft,
  updateChild,
  type ChildDraft,
} from '../../../src/onboarding/draft';
import { colors } from '../../../src/theme/colors';
import { spacing } from '../../../src/theme/spacing';

const EMPTY: FetusFormValues = {
  display_name: '',
  gender: null,
  pregnancy_weeks: '',
  due_date: null,
};

function fromDraft(c: ChildDraft | undefined): FetusFormValues {
  if (!c) return EMPTY;
  return {
    display_name: c.display_name ?? '',
    gender: c.gender ?? null,
    pregnancy_weeks:
      typeof c.pregnancy_weeks === 'number' ? String(c.pregnancy_weeks) : '',
    due_date: c.due_date ?? null,
  };
}

export default function CaseBFetus() {
  const router = useRouter();
  const params = useLocalSearchParams<{ index?: string }>();
  const index = Math.max(0, parseInt(params.index ?? '0', 10) || 0);
  const [values, setValues] = useState<FetusFormValues>(EMPTY);
  const [localID, setLocalID] = useState<string | null>(null);
  const [total, setTotal] = useState(1);

  useEffect(() => {
    void (async () => {
      const draft = await loadDraft();
      const fetuses = draft.children.filter((c) => c.kind === 'fetus');
      const child = fetuses[index];
      if (child) {
        setLocalID(child.local_id);
        setValues(fromDraft(child));
      }
      setTotal(Math.max(1, fetuses.length));
    })();
  }, [index]);

  const valid = useMemo(() => {
    const weeks = parseInt(values.pregnancy_weeks, 10);
    return (
      values.gender !== null &&
      Number.isFinite(weeks) &&
      weeks >= 1 &&
      weeks <= 45 &&
      values.due_date != null
    );
  }, [values]);

  const onContinue = async () => {
    if (!valid || !localID) return;
    const weeks = parseInt(values.pregnancy_weeks, 10);
    await updateChild(localID, {
      kind: 'fetus',
      display_name: values.display_name.trim() || undefined,
      gender: values.gender ?? undefined,
      pregnancy_weeks: weeks,
      due_date: values.due_date ?? undefined,
    });
    if (index + 1 < total) {
      router.push(`/(onboarding)/case-b/fetus?index=${index + 1}`);
    } else {
      router.push('/(onboarding)/case-b/purpose');
    }
  };

  return (
    <CaseAccentTheme case="B">
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']} testID="onboarding-case-b-fetus">
        <OnboardingProgressBar n={6} of={7} />
        <ScrollView style={styles.scroll} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <View style={styles.heroRow}>
            <View style={styles.hero}>
              <Text variant="h2" color="primary" style={styles.heading}>
                임신 중인 아이에 대해 알려주세요
              </Text>
            </View>
            {total > 1 ? <RepeatBadge n={index + 1} of={total} testID="case-b-fetus-badge" /> : null}
          </View>
          <FetusForm values={values} onChange={setValues} testIDPrefix="case-b-fetus" />
        </ScrollView>
        <View style={styles.footer}>
          <Button
            title={index + 1 < total ? '다음 아이 입력' : '다음으로'}
            variant="primary"
            fullWidth
            disabled={!valid}
            onPress={onContinue}
            testID="case-b-fetus-next"
          />
        </View>
        <StatusBar style="dark" />
      </SafeAreaView>
    </CaseAccentTheme>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.cream },
  scroll: { flex: 1 },
  body: {
    paddingHorizontal: spacing[6],
    paddingTop: spacing[6],
    paddingBottom: spacing[6],
    gap: spacing[6],
  },
  heroRow: { gap: spacing[3] },
  hero: { gap: spacing[2] },
  heading: { textAlign: 'left' },
  footer: { paddingHorizontal: spacing[6], paddingBottom: spacing[4] },
});
