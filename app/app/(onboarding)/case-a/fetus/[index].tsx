// PRD-006 Case A · 2/3 — 태아 정보 입력. AC-006-02.
// 다태일 경우 1..N 까지 같은 화면을 인덱스만 바꿔 반복한다. 마지막
// 인덱스의 `다음` 은 purpose 화면으로, 그 외 인덱스는 다음 fetus 페이지로.

import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../../../../src/components/Button';
import {
  emptyFetusValue,
  FetusForm,
  type FetusValue,
} from '../../../../src/components/onboarding/FetusForm';
import { StepHeader } from '../../../../src/components/onboarding/StepHeader';
import { Text } from '../../../../src/components/Text';
import {
  type ChildDraft,
  useOnboardingDraft,
} from '../../../../src/auth/onboardingDraft';
import { colors } from '../../../../src/theme/colors';
import { spacing } from '../../../../src/theme/spacing';
import { useMemo, useState } from 'react';

function fetusFromDraft(draft: ChildDraft | undefined): FetusValue {
  if (!draft) return emptyFetusValue;
  return {
    name: draft.name ?? '',
    gender: draft.gender,
    pregnancyWeek: draft.pregnancy_week != null ? String(draft.pregnancy_week) : '',
    dueDate: draft.due_date,
    isDueDateUndecided: draft.is_due_date_undecided,
  };
}

function fetusToDraft(value: FetusValue): ChildDraft {
  const week = value.pregnancyWeek === '' ? null : Number(value.pregnancyWeek);
  return {
    status: 'pregnancy',
    name: value.name.trim() === '' ? null : value.name.trim(),
    gender: value.gender,
    birth_date: null,
    due_date: value.isDueDateUndecided ? null : value.dueDate,
    pregnancy_week: Number.isFinite(week) ? (week as number) : null,
    bio: null,
    photo_s3_key: null,
    is_due_date_undecided: value.isDueDateUndecided,
  };
}

function isValid(value: FetusValue): boolean {
  if (value.isDueDateUndecided) return true;
  return value.dueDate != null;
}

export default function CaseAFetus() {
  const params = useLocalSearchParams<{ index: string }>();
  const router = useRouter();
  const { draft, update, loaded } = useOnboardingDraft();

  const index = Number(params.index ?? '0');
  const total = Math.max(draft.children.length, 1);
  const isLast = index >= total - 1;

  const initial = useMemo(() => fetusFromDraft(draft.children[index]), [draft, index]);
  const [value, setValue] = useState<FetusValue>(initial);

  const onNext = async () => {
    const next = [...draft.children];
    next[index] = fetusToDraft(value);
    await update({ children: next });
    if (isLast) {
      router.push('/(onboarding)/case-a/purpose');
    } else {
      router.push(`/(onboarding)/case-a/fetus/${index + 1}`);
    }
  };

  if (!loaded) {
    return <SafeAreaView style={styles.safe} testID="case-a-fetus" />;
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']} testID="case-a-fetus">
      <StepHeader
        progress="Case A · 2/3"
        counter={total > 1 ? `아이 ${index + 1}/${total}` : undefined}
      />
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text variant="h2" color="primary" style={styles.title}>
          아기에 대해 조금만{'\n'}알려주세요
        </Text>
        <FetusForm
          value={value}
          onChange={setValue}
          testIDPrefix={`fetus-${index}`}
        />
        <Button
          title={isLast ? '다음' : '다음 아기로'}
          variant="primary"
          fullWidth
          disabled={!isValid(value)}
          onPress={onNext}
          testID="case-a-fetus-next"
        />
      </ScrollView>
      <StatusBar style="dark" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.cream },
  container: {
    paddingHorizontal: spacing[6],
    paddingTop: spacing[6],
    paddingBottom: spacing[8],
    gap: spacing[5],
  },
  title: { textAlign: 'left' },
});
