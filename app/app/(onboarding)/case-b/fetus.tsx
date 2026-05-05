// B5 — 태아 정보 입력 (반복 M회)
//
// Wireframe: docs/wireframes/onboarding/case-b.svg (B5 panel).

import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '../../../src/components/Button';
import { Text } from '../../../src/components/Text';
import {
  FetusForm,
  RepeatBadge,
  ScreenScaffold,
} from '../../../src/components/onboarding';
import { spacing } from '../../../src/theme/spacing';
import {
  loadDraft,
  saveDraft,
  updateChild,
  type ChildDraft,
  type OnboardingDraft,
} from '../../../src/onboarding/draft';

export default function CaseBFetus() {
  const router = useRouter();
  const params = useLocalSearchParams<{ index?: string }>();
  const index = useMemo(() => Math.max(0, Number(params.index ?? '0')), [params.index]);

  const [draft, setDraft] = useState<OnboardingDraft | null>(null);
  const fetuses = useMemo(
    () => draft?.children.filter((c) => c.kind === 'fetus') ?? [],
    [draft],
  );
  const total = fetuses.length;
  const current: ChildDraft | undefined = fetuses[index];

  useEffect(() => {
    void (async () => {
      const d = await loadDraft();
      if (d.case !== 'B') {
        router.replace('/(onboarding)/q1');
        return;
      }
      setDraft(d);
    })();
  }, [router]);

  const onChange = useCallback(
    (patch: Partial<ChildDraft>) => {
      if (!current) return;
      setDraft((prev) => (prev ? updateChild(prev, current.draft_id, patch) : prev));
    },
    [current],
  );

  const onNext = async () => {
    if (!draft || !current) return;
    if (!current.gender || !current.pregnancy_weeks || !current.due_date) return;
    await saveDraft(() => ({ ...draft, last_step: 'case-b/fetus' }));
    if (index + 1 < total) {
      router.push(`/(onboarding)/case-b/fetus?index=${index + 1}`);
    } else {
      router.push('/(onboarding)/case-b/purpose');
    }
  };

  if (!draft || !current) return null;

  return (
    <ScreenScaffold
      case="B"
      current={6}
      total={7}
      stepLabel="Case B · 2단계 ②"
      testID="onboarding-b5"
      topRight={total > 1 ? <RepeatBadge case="B" current={index + 1} total={total} /> : undefined}
      actions={
        <Button
          title={total > 1 && index + 1 < total ? `다음 (${index + 2}/${total})` : '다음'}
          variant="primary"
          fullWidth
          disabled={!current.gender || !current.pregnancy_weeks || !current.due_date}
          onPress={onNext}
          testID="onboarding-b5-next"
        />
      }
    >
      <View style={styles.headerBlock}>
        <Text variant="h2" color="primary">
          {total > 1 ? `${index + 1}번째 태아 정보` : '태아 정보'}
        </Text>
      </View>
      <FetusForm
        value={{
          display_name: current.display_name,
          gender: current.gender,
          pregnancy_weeks: current.pregnancy_weeks,
          due_date: current.due_date,
        }}
        onChange={onChange}
        testID="onboarding-b5-form"
      />
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  headerBlock: { gap: spacing[2] },
});
