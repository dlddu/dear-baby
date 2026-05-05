// Q1 — 임신 여부 체크 (PRD-006 AC-006-01).
// 와이어프레임: docs/wireframes/onboarding/common.svg, Q1.

import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../../src/components/Button';
import { Text } from '../../src/components/Text';
import {
  OptionCard,
  ProgressBar,
} from '../../src/components/onboarding';
import { loadDraft, saveDraft } from '../../src/onboarding/draft';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';

export default function OnboardingQ1() {
  const router = useRouter();
  const [pregnant, setPregnant] = useState<boolean | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void loadDraft().then((d) => {
      if (cancelled) return;
      if (d.q1_pregnant !== undefined) setPregnant(d.q1_pregnant);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const onNext = async () => {
    if (pregnant === null || submitting) return;
    setSubmitting(true);
    await saveDraft({ q1_pregnant: pregnant, last_step: '/q1' });
    router.push('/(onboarding)/q2');
    setSubmitting(false);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']} testID="onboarding-q1">
      <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
        <ProgressBar current={1} total={3} tone="neutral" />
        <Text variant="caption" color="muted" style={styles.step}>
          1 / 3
        </Text>
        <Text variant="h2" color="primary" style={styles.heading}>
          현재 임신 중이신가요?
        </Text>
        <Text variant="body" color="secondary" style={styles.subhead}>
          맞춤 안내를 위한 첫 번째 질문이에요
        </Text>

        <View style={styles.options}>
          <OptionCard
            selected={pregnant === true}
            onPress={() => setPregnant(true)}
            testID="q1-option-yes"
          >
            <Text variant="h3" color="primary" style={styles.optionLabel}>
              예, 임신 중이에요
            </Text>
          </OptionCard>
          <OptionCard
            selected={pregnant === false}
            onPress={() => setPregnant(false)}
            testID="q1-option-no"
          >
            <Text variant="h3" color="primary" style={styles.optionLabel}>
              아니요
            </Text>
          </OptionCard>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button
          title="다음"
          variant="primary"
          fullWidth
          disabled={pregnant === null || submitting}
          onPress={onNext}
          testID="q1-next"
        />
      </View>
      <StatusBar style="dark" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.cream },
  container: {
    paddingHorizontal: spacing[6],
    paddingTop: spacing[6],
    paddingBottom: spacing[6],
    gap: spacing[3],
  },
  step: { marginBottom: spacing[2] },
  heading: { marginTop: spacing[2] },
  subhead: { marginBottom: spacing[5] },
  options: { gap: spacing[3] },
  optionLabel: { textAlign: 'center' },
  footer: {
    paddingHorizontal: spacing[6],
    paddingBottom: spacing[6],
    paddingTop: spacing[3],
  },
});
