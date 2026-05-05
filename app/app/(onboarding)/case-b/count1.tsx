// B1 — 양육 중인 아이 수 (Case B 1단계). PRD-006 AC-006-03.
// 와이어프레임: docs/wireframes/onboarding/case-b.svg, B1.

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

export default function CaseBCount1() {
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
    const fetuses = d.children.filter((c) => c.kind === 'fetus');
    const existing = d.children.filter((c) => c.kind === 'child').slice(0, count);
    while (existing.length < count) {
      existing.push({ draft_id: genDraftId(), kind: 'child' });
    }
    // Children come first (양육 → 임신), fetuses preserved at the tail.
    const next: ChildDraft[] = [...existing, ...fetuses];
    await saveDraft({ children: next, last_step: '/case-b/count1' });
    router.push('/(onboarding)/case-b/child');
    setSubmitting(false);
  };

  const options = [
    { value: 1, label: '1명' },
    { value: 2, label: '2명' },
    { value: 3, label: '3명 이상' },
  ] as const;

  return (
    <CaseAccentTheme case="B">
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']} testID="case-b-count1">
        <ScrollView contentContainerStyle={styles.container}>
          <CaseHeader step={2} totalSteps={7} label="Case B · 1단계 ①" />
          <Text variant="h2" color="primary" style={styles.heading}>
            양육 중인 아이가{'\n'}몇 명인가요?
          </Text>
          <View style={styles.options}>
            {options.map((opt) => (
              <OptionCard
                key={opt.value}
                selected={count === opt.value}
                onPress={() => setCount(opt.value)}
                testID={`case-b-count1-${opt.value}`}
              >
                <Text variant="h3" color="primary">{opt.label}</Text>
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
            testID="case-b-count1-next"
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
  footer: {
    paddingHorizontal: spacing[6],
    paddingBottom: spacing[6],
    paddingTop: spacing[3],
  },
});
