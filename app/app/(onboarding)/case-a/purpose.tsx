// PRD-006 Case A · 3/3 — 기록 목적 (복수 선택). AC-006-02.
// Case A 는 아이별 목적이 분리되지 않으므로 모든 인덱스에 같은 목적
// 셋을 적용한다. 화면을 떠날 때 draft.purposes 전체를 한 번에 갱신.

import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../../../src/components/Button';
import {
  DEFAULT_PURPOSES,
  PurposeSelector,
} from '../../../src/components/onboarding/PurposeSelector';
import { StepHeader } from '../../../src/components/onboarding/StepHeader';
import { Text } from '../../../src/components/Text';
import { useAuth } from '../../../src/auth/AuthContext';
import { useOnboardingDraft } from '../../../src/auth/onboardingDraft';
import { colors } from '../../../src/theme/colors';
import { spacing } from '../../../src/theme/spacing';

export default function CaseAPurpose() {
  const router = useRouter();
  const { draft, update } = useOnboardingDraft();
  const { completeOnboarding } = useAuth();
  const [selected, setSelected] = useState<string[]>(draft.purposes[0] ?? []);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const onFinish = async () => {
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const purposes = draft.children.map(() => selected);
      await update({ purposes });
      await completeOnboarding();
      // AuthGate routes to /(tabs) once status flips to authenticated.
    } catch (e) {
      console.warn('[onboarding] case A submit failed', e);
      setError('지금은 저장이 잘 안 되네요. 잠시 후 다시 시도해 주세요.');
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']} testID="case-a-purpose">
      <StepHeader progress="Case A · 3/3" />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.heading}>
          <Text variant="h2" color="primary">
            어떤 마음으로{'\n'}기록을 남기고 싶나요?
          </Text>
          <Text variant="caption" color="muted">
            여러 개 선택할 수 있어요
          </Text>
        </View>
        <PurposeSelector options={DEFAULT_PURPOSES} selected={selected} onToggle={toggle} />
        <Button
          title={submitting ? '저장 중…' : '홈으로 가기'}
          variant="primary"
          fullWidth
          disabled={selected.length === 0 || submitting}
          onPress={onFinish}
          testID="case-a-finish"
        />
        {error ? (
          <Text variant="caption" color="coral" style={styles.error} testID="case-a-error">
            {error}
          </Text>
        ) : null}
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
  heading: { gap: spacing[2] },
  error: { textAlign: 'center' },
});
