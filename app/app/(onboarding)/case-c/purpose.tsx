// C3 — 기록 목적 (Case C)
//
// Multi-select, applied to every child. On submit we POST
// /onboarding/case which stamps onboarded_at and the AuthGate hands
// the user to the home tab.

import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '../../../src/components/Button';
import { Text } from '../../../src/components/Text';
import {
  DEFAULT_PURPOSE_OPTIONS,
  PurposeList,
  ScreenScaffold,
} from '../../../src/components/onboarding';
import { useAuth } from '../../../src/auth/AuthContext';
import { spacing } from '../../../src/theme/spacing';
import {
  applyPurposesToAll,
  clearDraft,
  loadDraft,
  saveDraft,
  type OnboardingDraft,
} from '../../../src/onboarding/draft';
import type { RecordPurpose } from '../../../src/api/types';

export default function CaseCPurpose() {
  const router = useRouter();
  const { submitCaseOnboarding } = useAuth();
  const [draft, setDraft] = useState<OnboardingDraft | null>(null);
  const [purposes, setPurposes] = useState<RecordPurpose[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    void (async () => {
      const d = await loadDraft();
      if (d.case !== 'C' || d.children.length === 0) {
        router.replace('/(onboarding)/q1');
        return;
      }
      setDraft(d);
      const existing = d.children[0]?.purposes ?? [];
      setPurposes(existing);
    })();
  }, [router]);

  const onSubmit = async () => {
    if (!draft || submitting || purposes.length === 0) return;
    setHasError(false);
    setSubmitting(true);
    try {
      const next = await saveDraft((d) => applyPurposesToAll(d, purposes));
      await submitCaseOnboarding({
        case: 'C',
        children: next.children.map((c) => ({
          kind: c.kind,
          gender: c.gender ?? 'undecided',
          display_name: c.display_name,
          introduction: c.introduction,
          birth_date: c.birth_date,
          photo_tmp_key: c.photo_tmp_key,
          purposes: c.purposes ?? [],
        })),
      });
      await clearDraft();
      router.replace('/(tabs)');
    } catch (err) {
      console.warn('[onboarding] submitCase failed', err);
      setHasError(true);
      setSubmitting(false);
    }
  };

  if (!draft) return null;

  return (
    <ScreenScaffold
      case="C"
      current={3}
      total={3}
      testID="onboarding-c3"
      actions={
        <View style={styles.actionsCol}>
          <Button
            title={submitting ? '저장 중…' : '홈으로 시작하기'}
            variant="primary"
            fullWidth
            disabled={purposes.length === 0 || submitting}
            onPress={onSubmit}
            testID="onboarding-c3-submit"
          />
          {hasError ? (
            <Text variant="caption" color="coral" style={styles.error}>
              지금은 저장이 잘 안 되네요. 잠시 후 다시 시도해 주세요.
            </Text>
          ) : null}
        </View>
      }
    >
      <View style={styles.headerBlock}>
        <Text variant="h2" color="primary">
          어떤 마음으로{'\n'}기록을 남기고 싶나요?
        </Text>
        <Text variant="caption" color="muted">
          복수 선택할 수 있어요
        </Text>
      </View>
      <PurposeList
        options={DEFAULT_PURPOSE_OPTIONS}
        values={purposes}
        onChange={setPurposes}
        testID="onboarding-c3-purposes"
      />
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  headerBlock: { gap: spacing[2] },
  actionsCol: { gap: spacing[2] },
  error: { textAlign: 'center' },
});
