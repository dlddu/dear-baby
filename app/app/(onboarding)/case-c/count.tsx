// C1 — 양육 중인 아이 수 (1명 / 2명 / 3명 이상). PRD-006 AC-006-04.
// 와이어프레임: docs/wireframes/onboarding/case-c.svg, C1.

import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../../../src/components/Button';
import { Text } from '../../../src/components/Text';
import {
  CaseAccentTheme,
  CaseHeader,
  OptionCard,
} from '../../../src/components/onboarding';
import {
  genDraftId,
  loadDraft,
  saveDraft,
  type ChildDraft,
} from '../../../src/onboarding/draft';
import { colors } from '../../../src/theme/colors';
import { spacing } from '../../../src/theme/spacing';

export default function CaseCCount() {
  const router = useRouter();
  const [count, setCount] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void loadDraft().then((d) => {
      if (cancelled) return;
      const childCount = d.children.filter((c) => c.kind === 'child').length;
      if (childCount > 0) setCount(Math.min(childCount, 3));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const onNext = async () => {
    if (count === null || submitting) return;
    setSubmitting(true);
    const d = await loadDraft();
    const target = count;
    const children = d.children.filter((c) => c.kind === 'child');
    let next: ChildDraft[] = children.slice(0, target);
    while (next.length < target) {
      next.push({ draft_id: genDraftId(), kind: 'child' });
    }
    await saveDraft({ children: next, last_step: '/case-c/count' });
    router.push('/(onboarding)/case-c/child');
    setSubmitting(false);
  };

  const options: ReadonlyArray<{ value: number; label: string; testID: string }> = [
    { value: 1, label: '1명', testID: 'case-c-count-1' },
    { value: 2, label: '2명', testID: 'case-c-count-2' },
    { value: 3, label: '3명 이상', testID: 'case-c-count-3' },
  ];

  return (
    <CaseAccentTheme case="C">
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']} testID="case-c-count">
        <ScrollView contentContainerStyle={styles.container}>
          <CaseHeader step={1} totalSteps={3} label="Case C · 1/3" />
          <Text variant="h2" color="primary" style={styles.heading}>
            양육 중인 아이가 몇 명인가요?
          </Text>
          <View style={styles.options}>
            {options.map((opt) => (
              <OptionCard
                key={opt.value}
                selected={count === opt.value}
                onPress={() => setCount(opt.value)}
                testID={opt.testID}
              >
                <Text variant="h3" color="primary" style={styles.optionLabel}>
                  {opt.label}
                </Text>
              </OptionCard>
            ))}
          </View>
        </ScrollView>
        <View style={styles.footer}>
          <Button
            title="다음"
            variant="primary"
            fullWidth
            disabled={count === null || submitting}
            onPress={onNext}
            testID="case-c-count-next"
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
  heading: { marginBottom: spacing[5] },
  options: { gap: spacing[3] },
  optionLabel: { textAlign: 'left', fontWeight: '600' },
  footer: {
    paddingHorizontal: spacing[6],
    paddingBottom: spacing[6],
    paddingTop: spacing[3],
  },
});
