// B4 — 임신 중인 아이 수 (Case B 2단계). 단태 / 다태.
// 와이어프레임: docs/wireframes/onboarding/case-b.svg, B4.

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

export default function CaseBCount2() {
  const router = useRouter();
  const [count, setCount] = useState<1 | 2 | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void loadDraft().then((d) => {
      if (cancelled) return;
      const fetuses = d.children.filter((c) => c.kind === 'fetus').length;
      if (fetuses === 1) setCount(1);
      else if (fetuses >= 2) setCount(2);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const onNext = async () => {
    if (count === null || submitting) return;
    setSubmitting(true);
    const d = await loadDraft();
    const target = count === 1 ? 1 : 2;
    const childRows = d.children.filter((c) => c.kind === 'child');
    const fetusRows = d.children.filter((c) => c.kind === 'fetus').slice(0, target);
    while (fetusRows.length < target) {
      fetusRows.push({ draft_id: genDraftId(), kind: 'fetus' });
    }
    const next: ChildDraft[] = [...childRows, ...fetusRows];
    await saveDraft({ children: next, last_step: '/case-b/count2' });
    router.push('/(onboarding)/case-b/fetus');
    setSubmitting(false);
  };

  return (
    <CaseAccentTheme case="B">
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']} testID="case-b-count2">
        <ScrollView contentContainerStyle={styles.container}>
          <CaseHeader step={5} totalSteps={7} label="Case B · 2단계 ①" />
          <Text variant="h2" color="primary" style={styles.heading}>
            임신 중인 아이는{'\n'}몇 명인가요?
          </Text>
          <Text variant="caption" color="muted" style={styles.hint}>
            기존 아이와 별도로 관리됩니다
          </Text>
          <View style={styles.options}>
            <OptionCard
              selected={count === 1}
              onPress={() => setCount(1)}
              testID="case-b-count2-single"
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
              testID="case-b-count2-multi"
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
            testID="case-b-count2-next"
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
