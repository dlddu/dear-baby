// B4 — 임신 아이 수 (PRD-006 AC-006-03 ②)

import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../../../src/components/Button';
import { Text } from '../../../src/components/Text';
import {
  CaseAccentTheme,
  CountPicker,
  OnboardingProgressBar,
} from '../../../src/components/onboarding';
import {
  loadDraft,
  makeLocalID,
  saveDraft,
} from '../../../src/onboarding/draft';
import { colors } from '../../../src/theme/colors';
import { spacing } from '../../../src/theme/spacing';

export default function CaseBCount2() {
  const router = useRouter();
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    void (async () => {
      const draft = await loadDraft();
      if (draft.fetus_count) setCount(draft.fetus_count);
    })();
  }, []);

  const onContinue = async () => {
    if (count == null) return;
    const draft = await loadDraft();
    const caregivers = draft.children.filter((c) => c.kind === 'child');
    const fetusSlots = Array.from({ length: count }, () => ({
      local_id: makeLocalID(),
      kind: 'fetus' as const,
    }));
    await saveDraft({
      fetus_count: count,
      children: [...caregivers, ...fetusSlots],
    });
    router.push('/(onboarding)/case-b/fetus?index=0');
  };

  return (
    <CaseAccentTheme case="B">
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']} testID="onboarding-case-b-count2">
        <OnboardingProgressBar n={5} of={7} />
        <ScrollView style={styles.scroll} contentContainerStyle={styles.body}>
          <View style={styles.hero}>
            <Text variant="h2" color="primary" style={styles.heading}>
              임신 중인 아이는 몇 명인가요?
            </Text>
          </View>
          <CountPicker
            value={count}
            onChange={setCount}
            mode="pregnancy"
            testID="case-b-count2"
          />
        </ScrollView>
        <View style={styles.footer}>
          <Button
            title="계속하기"
            variant="primary"
            fullWidth
            disabled={count == null}
            onPress={onContinue}
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
  scroll: { flex: 1 },
  body: {
    paddingHorizontal: spacing[6],
    paddingTop: spacing[8],
    paddingBottom: spacing[6],
    gap: spacing[6],
  },
  hero: { gap: spacing[3] },
  heading: { textAlign: 'left' },
  footer: { paddingHorizontal: spacing[6], paddingBottom: spacing[4] },
});
