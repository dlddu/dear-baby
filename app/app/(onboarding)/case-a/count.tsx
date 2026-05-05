// A1 — 임신 아이 수 (단태 / 다태). PRD-006 AC-006-02.
// 와이어프레임: docs/wireframes/onboarding/case-a.svg, A1.

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

export default function CaseACount() {
  const router = useRouter();
  const [count, setCount] = useState<1 | 2 | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void loadDraft().then((d) => {
      if (cancelled) return;
      const fetuses = d.children.filter((c) => c.kind === 'fetus');
      if (fetuses.length === 1) setCount(1);
      else if (fetuses.length >= 2) setCount(2);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const onNext = async () => {
    if (count === null || submitting) return;
    setSubmitting(true);
    const target = count === 1 ? 1 : 2;
    const d = await loadDraft();
    const fetuses = d.children.filter((c) => c.kind === 'fetus');
    let next: ChildDraft[] = fetuses.slice(0, target);
    while (next.length < target) {
      next.push({ draft_id: genDraftId(), kind: 'fetus' });
    }
    await saveDraft({ children: next, last_step: '/case-a/count' });
    router.push('/(onboarding)/case-a/fetus');
    setSubmitting(false);
  };

  return (
    <CaseAccentTheme case="A">
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']} testID="case-a-count">
        <ScrollView contentContainerStyle={styles.container}>
          <CaseHeader step={1} totalSteps={3} label="Case A · 1/3" />
          <Text variant="h2" color="primary" style={styles.heading}>
            임신 중인 아이는 몇 명인가요?
          </Text>
          <Text variant="caption" color="muted" style={styles.hint}>
            선택 시 입력할 태아 수가 결정됩니다
          </Text>
          <View style={styles.options}>
            <OptionCard
              selected={count === 1}
              onPress={() => setCount(1)}
              testID="case-a-count-single"
            >
              <Text variant="h3" color="primary" style={styles.optionTitle}>
                단태
              </Text>
              <Text variant="caption" color="muted" style={styles.optionCaption}>
                1명
              </Text>
            </OptionCard>
            <OptionCard
              selected={count === 2}
              onPress={() => setCount(2)}
              testID="case-a-count-multi"
            >
              <Text variant="h3" color="primary" style={styles.optionTitle}>
                다태
              </Text>
              <Text variant="caption" color="muted" style={styles.optionCaption}>
                2명 이상
              </Text>
            </OptionCard>
          </View>
        </ScrollView>
        <View style={styles.footer}>
          <Button
            title="다음"
            variant="primary"
            fullWidth
            disabled={count === null || submitting}
            onPress={onNext}
            testID="case-a-count-next"
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
  options: { flexDirection: 'row', gap: spacing[3] },
  optionTitle: { textAlign: 'center', marginBottom: spacing[1] },
  optionCaption: { textAlign: 'center' },
  footer: {
    paddingHorizontal: spacing[6],
    paddingBottom: spacing[6],
    paddingTop: spacing[3],
  },
});
