// PRD-006 Case B · 5/6 — 태아 정보 입력. index 는 draft.children 전체
// 인덱스를 사용하므로 양육 슬롯 뒤에서 시작한다. 마지막 임신 슬롯에서
// purposes 화면으로 진입.

import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
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

export default function CaseBFetus() {
  const params = useLocalSearchParams<{ index: string }>();
  const router = useRouter();
  const { draft, update, loaded } = useOnboardingDraft();

  const index = Number(params.index ?? '0');
  const total = draft.children.length;
  const isLast = index >= total - 1;
  const pregnancySlots = draft.children.filter((c) => c.status === 'pregnancy');
  const pregnancyIndexInGroup =
    index - draft.children.findIndex((c) => c.status === 'pregnancy');

  const initial = useMemo(() => fetusFromDraft(draft.children[index]), [draft, index]);
  const [value, setValue] = useState<FetusValue>(initial);

  const onNext = async () => {
    const next = [...draft.children];
    next[index] = fetusToDraft(value);
    await update({ children: next });
    if (isLast) {
      router.push('/(onboarding)/case-b/purposes');
    } else {
      router.push(`/(onboarding)/case-b/fetus/${index + 1}`);
    }
  };

  if (!loaded) {
    return <SafeAreaView style={styles.safe} testID="case-b-fetus" />;
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']} testID="case-b-fetus">
      <StepHeader
        progress="Case B · 5/6"
        counter={
          pregnancySlots.length > 1
            ? `태아 ${pregnancyIndexInGroup + 1}/${pregnancySlots.length}`
            : undefined
        }
      />
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text variant="h2" color="primary" style={styles.title}>
          아기에 대해 조금만{'\n'}알려주세요
        </Text>
        <FetusForm value={value} onChange={setValue} testIDPrefix={`b-fetus-${index}`} />
        <Button
          title={isLast ? '다음' : '다음 아기로'}
          variant="primary"
          fullWidth
          disabled={!isValid(value)}
          onPress={onNext}
          testID="case-b-fetus-next"
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
  title: {},
});
