// A3 — 기록 목적 (복수 선택). PRD-006 AC-006-02. Case A는 모든 태아에
// 같은 목적을 복제 저장한다.
// 와이어프레임: docs/wireframes/onboarding/case-a.svg, A3.

import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { RecordPurpose } from '../../../src/api/onboarding';
import { useAuth } from '../../../src/auth/AuthContext';
import { Button } from '../../../src/components/Button';
import { Text } from '../../../src/components/Text';
import {
  CaseAccentTheme,
  CaseHeader,
  OptionCard,
} from '../../../src/components/onboarding';
import { clearDraft, loadDraft, saveDraft } from '../../../src/onboarding/draft';
import { PURPOSE_OPTIONS } from '../../../src/onboarding/purposes';
import { colors } from '../../../src/theme/colors';
import { spacing } from '../../../src/theme/spacing';

export default function CaseAPurpose() {
  const router = useRouter();
  const { submitCaseOnboarding } = useAuth();
  const [selected, setSelected] = useState<Set<RecordPurpose>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadDraft().then((d) => {
      if (cancelled) return;
      const first = d.children[0];
      if (first?.purposes) setSelected(new Set(first.purposes));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const toggle = (value: RecordPurpose) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  };

  const onFinish = async () => {
    if (selected.size === 0 || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const draft = await loadDraft();
      const purposes = Array.from(selected);
      const fetuses = draft.children.filter((c) => c.kind === 'fetus');
      // Apply the same purposes to every fetus, then submit.
      const fullChildren = fetuses.map((c) => ({ ...c, purposes }));
      await saveDraft({ children: fullChildren });
      await submitCaseOnboarding({
        case: 'A',
        children: fullChildren.map((c) => ({
          kind: 'fetus' as const,
          display_name: c.display_name,
          gender: c.gender!,
          pregnancy_weeks: c.pregnancy_weeks,
          due_date: c.due_date,
          purposes: c.purposes ?? [],
        })),
      });
      await clearDraft();
      // AuthGate replaces to /(tabs) once status flips to authenticated.
    } catch {
      setError('지금은 저장이 잘 안 되네요. 잠시 후 다시 시도해 주세요.');
      setSubmitting(false);
    }
  };

  return (
    <CaseAccentTheme case="A">
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']} testID="case-a-purpose">
        <ScrollView contentContainerStyle={styles.container}>
          <CaseHeader step={3} totalSteps={3} label="Case A · 3/3" />
          <Text variant="h2" color="primary" style={styles.heading}>
            어떤 목적으로 기록하시나요?
          </Text>
          <Text variant="caption" color="muted" style={styles.hint}>
            복수 선택 가능
          </Text>
          <View style={styles.options}>
            {PURPOSE_OPTIONS.map((opt) => (
              <OptionCard
                key={opt.value}
                selected={selected.has(opt.value)}
                onPress={() => toggle(opt.value)}
                testID={`case-a-purpose-${opt.value}`}
              >
                <Text variant="body" color="primary" style={styles.optionLabel}>
                  {opt.label}
                </Text>
              </OptionCard>
            ))}
          </View>

          {error ? (
            <Text variant="caption" color="coral" style={styles.error}>
              {error}
            </Text>
          ) : null}
        </ScrollView>

        <View style={styles.footer}>
          <Button
            title={submitting ? '저장 중…' : '홈으로 시작하기'}
            variant="primary"
            fullWidth
            disabled={selected.size === 0 || submitting}
            onPress={onFinish}
            testID="case-a-purpose-finish"
          />
        </View>
        <StatusBar style="dark" />
      </SafeAreaView>
    </CaseAccentTheme>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.cream },
  container: {
    paddingHorizontal: spacing[6],
    paddingTop: spacing[6],
    paddingBottom: spacing[6],
  },
  heading: { marginBottom: spacing[2] },
  hint: { marginBottom: spacing[5] },
  options: { gap: spacing[3] },
  optionLabel: { fontWeight: '500' },
  error: { marginTop: spacing[4], textAlign: 'center' },
  footer: {
    paddingHorizontal: spacing[6],
    paddingBottom: spacing[6],
    paddingTop: spacing[3],
  },
});
