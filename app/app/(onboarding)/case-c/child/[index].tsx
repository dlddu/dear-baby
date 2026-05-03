// PRD-006 Case C · 2/3 — 아이 정보 입력. AC-006-04.
// 1..N 까지 같은 폼을 반복하고 마지막에서 purpose 화면으로 이동한다.

import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../../../../src/components/Button';
import {
  ChildForm,
  type ChildValue,
  emptyChildValue,
} from '../../../../src/components/onboarding/ChildForm';
import { StepHeader } from '../../../../src/components/onboarding/StepHeader';
import { Text } from '../../../../src/components/Text';
import {
  type ChildDraft,
  useOnboardingDraft,
} from '../../../../src/auth/onboardingDraft';
import { colors } from '../../../../src/theme/colors';
import { spacing } from '../../../../src/theme/spacing';

function fromDraft(draft: ChildDraft | undefined): ChildValue {
  if (!draft) return emptyChildValue;
  return {
    name: draft.name ?? '',
    gender: draft.gender,
    birthDate: draft.birth_date,
    bio: draft.bio ?? '',
  };
}

function toDraft(value: ChildValue): ChildDraft {
  return {
    status: 'parenting',
    name: value.name.trim() === '' ? null : value.name.trim(),
    gender: value.gender,
    birth_date: value.birthDate,
    due_date: null,
    pregnancy_week: null,
    bio: value.bio.trim() === '' ? null : value.bio.trim(),
    photo_s3_key: null,
    is_due_date_undecided: false,
  };
}

function isValid(value: ChildValue): boolean {
  return value.name.trim() !== '' && value.birthDate != null;
}

export default function CaseCChild() {
  const params = useLocalSearchParams<{ index: string }>();
  const router = useRouter();
  const { draft, update, loaded } = useOnboardingDraft();

  const index = Number(params.index ?? '0');
  const total = Math.max(draft.children.length, 1);
  const isLast = index >= total - 1;

  const initial = useMemo(() => fromDraft(draft.children[index]), [draft, index]);
  const [value, setValue] = useState<ChildValue>(initial);

  const onNext = async () => {
    const next = [...draft.children];
    next[index] = toDraft(value);
    await update({ children: next });
    if (isLast) {
      router.push('/(onboarding)/case-c/purpose');
    } else {
      router.push(`/(onboarding)/case-c/child/${index + 1}`);
    }
  };

  if (!loaded) {
    return <SafeAreaView style={styles.safe} testID="case-c-child" />;
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']} testID="case-c-child">
      <StepHeader
        progress="Case C · 2/3"
        counter={total > 1 ? `아이 ${index + 1}/${total}` : undefined}
      />
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text variant="h2" color="primary" style={styles.title}>
          {index === 0 ? '첫째' : index === 1 ? '둘째' : `${index + 1}번째`} 아이에 대해{'\n'}
          알려주세요
        </Text>
        <ChildForm value={value} onChange={setValue} testIDPrefix={`child-${index}`} />
        <Button
          title={isLast ? '다음 단계로' : '다음 아이로'}
          variant="primary"
          fullWidth
          disabled={!isValid(value)}
          onPress={onNext}
          testID="case-c-child-next"
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
