// Q2 — 양육 여부 체크 + 케이스 결정 (PRD-006 AC-006-01).
// 와이어프레임: docs/wireframes/onboarding/common.svg, Q2.

import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../../src/components/Button';
import { Text } from '../../src/components/Text';
import {
  OptionCard,
  ProgressBar,
} from '../../src/components/onboarding';
import { loadDraft, resolveCase, saveDraft } from '../../src/onboarding/draft';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';

export default function OnboardingQ2() {
  const router = useRouter();
  const [q1, setQ1] = useState<boolean | null>(null);
  const [q2, setQ2] = useState<boolean | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void loadDraft().then((d) => {
      if (cancelled) return;
      if (d.q1_pregnant !== undefined) setQ1(d.q1_pregnant);
      if (d.q2_caregiver !== undefined) setQ2(d.q2_caregiver);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // The 양해 카피 fires when both answers are negative — the user is
  // routed into Case A but with a softer welcome (PRD-006 AC-006-01).
  const sympatheticCopy = useMemo(() => {
    if (q1 === false && q2 === false) {
      return '아직 시작 전이라도 괜찮아요. 미리 마음을 적어두는 분들도 있어요.';
    }
    return null;
  }, [q1, q2]);

  const onNext = async () => {
    if (q1 === null || q2 === null || submitting) return;
    setSubmitting(true);
    const caseKind = resolveCase(q1, q2);
    await saveDraft({
      q1_pregnant: q1,
      q2_caregiver: q2,
      case: caseKind,
      last_step: '/q2',
    });
    switch (caseKind) {
      case 'A':
        router.replace('/(onboarding)/case-a/count');
        break;
      case 'B':
        router.replace('/(onboarding)/case-b/intro1');
        break;
      case 'C':
        router.replace('/(onboarding)/case-c/count');
        break;
    }
    setSubmitting(false);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']} testID="onboarding-q2">
      <ScrollView contentContainerStyle={styles.container}>
        <ProgressBar current={2} total={3} tone="neutral" />
        <Text variant="caption" color="muted" style={styles.step}>
          2 / 3
        </Text>
        <Text variant="h2" color="primary" style={styles.heading}>
          이미 태어난 아이가 있나요?
        </Text>
        <Text variant="body" color="secondary" style={styles.subhead}>
          현재 양육 중인 아이를 알려주세요
        </Text>

        <View style={styles.options}>
          <OptionCard
            selected={q2 === true}
            onPress={() => setQ2(true)}
            testID="q2-option-yes"
          >
            <Text variant="h3" color="primary" style={styles.optionLabel}>
              예, 양육 중이에요
            </Text>
          </OptionCard>
          <OptionCard
            selected={q2 === false}
            onPress={() => setQ2(false)}
            testID="q2-option-no"
          >
            <Text variant="h3" color="primary" style={styles.optionLabel}>
              아니요
            </Text>
          </OptionCard>
        </View>

        {sympatheticCopy ? (
          <Text
            variant="caption"
            color="secondary"
            style={styles.sympathetic}
            testID="q2-sympathetic"
          >
            {sympatheticCopy}
          </Text>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <Button
          title="다음"
          variant="primary"
          fullWidth
          disabled={q1 === null || q2 === null || submitting}
          onPress={onNext}
          testID="q2-next"
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
  sympathetic: {
    marginTop: spacing[5],
    paddingHorizontal: spacing[3],
    textAlign: 'center',
  },
  footer: {
    paddingHorizontal: spacing[6],
    paddingBottom: spacing[6],
    paddingTop: spacing[3],
  },
});
