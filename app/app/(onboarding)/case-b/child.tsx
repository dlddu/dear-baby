// B2 — 양육 아이 정보 입력 (반복 N회)
//
// Wireframe: docs/wireframes/onboarding/case-b.svg (B2 panel).

import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '../../../src/components/Button';
import { Text } from '../../../src/components/Text';
import {
  ChildForm,
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

export default function CaseBChild() {
  const router = useRouter();
  const params = useLocalSearchParams<{ index?: string }>();
  const index = useMemo(() => Math.max(0, Number(params.index ?? '0')), [params.index]);

  const [draft, setDraft] = useState<OnboardingDraft | null>(null);
  const kids = useMemo(
    () => draft?.children.filter((c) => c.kind === 'child') ?? [],
    [draft],
  );
  const total = kids.length;
  const current: ChildDraft | undefined = kids[index];

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
    if (!current.display_name || !current.gender || !current.birth_date) return;
    await saveDraft(() => ({ ...draft, last_step: 'case-b/child' }));
    if (index + 1 < total) {
      router.push(`/(onboarding)/case-b/child?index=${index + 1}`);
    } else {
      router.push('/(onboarding)/case-b/intro2');
    }
  };

  if (!draft || !current) return null;

  return (
    <ScreenScaffold
      case="B"
      current={3}
      total={7}
      stepLabel="Case B · 1단계 ②"
      testID="onboarding-b2"
      topRight={total > 1 ? <RepeatBadge case="B" current={index + 1} total={total} /> : undefined}
      actions={
        <Button
          title={total > 1 && index + 1 < total ? `다음 (${index + 2}/${total})` : '다음'}
          variant="primary"
          fullWidth
          disabled={!current.display_name || !current.gender || !current.birth_date}
          onPress={onNext}
          testID="onboarding-b2-next"
        />
      }
    >
      <View style={styles.headerBlock}>
        <Text variant="h2" color="primary">
          {total > 1 ? `${index + 1}번째 아이 정보` : '아이 정보를 알려주세요'}
        </Text>
      </View>
      <ChildForm
        value={{
          display_name: current.display_name,
          gender: current.gender,
          birth_date: current.birth_date,
          introduction: current.introduction,
          photo_tmp_key: current.photo_tmp_key,
          photo_local_uri: current.photo_local_uri,
        }}
        onChange={onChange}
        testID="onboarding-b2-form"
      />
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  headerBlock: { gap: spacing[2] },
});
