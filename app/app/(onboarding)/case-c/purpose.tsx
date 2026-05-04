// C3 — 기록 목적 (PRD-006 AC-006-04 §3). 모든 아이에게 같은 목적 셋을 복제 저장.

import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../../../src/components/Button';
import { Text } from '../../../src/components/Text';
import {
  CaseAccentTheme,
  OnboardingProgressBar,
  PurposePicker,
} from '../../../src/components/onboarding';
import { useAuth } from '../../../src/auth/AuthContext';
import {
  clearDraft,
  loadDraft,
  type ChildDraft,
} from '../../../src/onboarding/draft';
import type {
  CaseSubmissionPayload,
  ChildSubmission,
  RecordPurpose,
} from '../../../src/api/onboarding';
import { colors } from '../../../src/theme/colors';
import { spacing } from '../../../src/theme/spacing';

function buildPayload(
  children: ChildDraft[],
  purposes: RecordPurpose[],
): CaseSubmissionPayload {
  const out: ChildSubmission[] = children
    .filter((c) => c.kind === 'child')
    .map((c) => ({
      kind: 'child',
      display_name: c.display_name,
      gender: c.gender ?? 'undecided',
      introduction: c.introduction,
      photo_tmp_key: c.photo_tmp_key,
      birth_date: c.birth_date,
      purposes,
    }));
  return { case: 'C', children: out };
}

export default function CaseCPurpose() {
  const { submitCaseOnboarding } = useAuth();
  const [purposes, setPurposes] = useState<RecordPurpose[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onStart = async () => {
    if (purposes.length === 0 || submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const draft = await loadDraft();
      await submitCaseOnboarding(buildPayload(draft.children, purposes));
      await clearDraft();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setSubmitting(false);
    }
  };

  return (
    <CaseAccentTheme case="C">
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']} testID="onboarding-case-c-purpose">
        <OnboardingProgressBar n={3} of={3} label="Case C · 3/3" />
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.hero}>
            <Text variant="h2" color="primary" style={styles.heading}>
              어떤 마음으로 기록을 남기고 싶나요?
            </Text>
            <Text variant="emotion" color="secondary" style={styles.helper}>
              여러 개를 골라도 괜찮아요.
            </Text>
          </View>
          <PurposePicker value={purposes} onChange={setPurposes} testID="case-c-purpose" />
        </ScrollView>
        <View style={styles.footer}>
          {error ? (
            <Text variant="caption" color="coral" style={styles.error} testID="case-c-purpose-error">
              지금은 저장이 잘 안 되네요. 잠시 후 다시 시도해 주세요.
            </Text>
          ) : null}
          <Button
            title={submitting ? '저장 중…' : '홈으로 시작하기'}
            variant="primary"
            fullWidth
            disabled={purposes.length === 0 || submitting}
            onPress={onStart}
            testID="case-c-purpose-submit"
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
  hero: { gap: spacing[2] },
  heading: { textAlign: 'left' },
  helper: { textAlign: 'left' },
  footer: { paddingHorizontal: spacing[6], paddingBottom: spacing[4], gap: spacing[3] },
  error: { textAlign: 'center' },
});
