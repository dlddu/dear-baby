// A1 — 임신 아이 수 (PRD-006 AC-006-02)

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
  resetChildren,
} from '../../../src/onboarding/draft';
import { colors } from '../../../src/theme/colors';
import { spacing } from '../../../src/theme/spacing';

export default function CaseACount() {
  const router = useRouter();
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    void (async () => {
      const draft = await loadDraft();
      const fetuses = draft.children.filter((c) => c.kind === 'fetus');
      if (fetuses.length === 1) setCount(1);
      else if (fetuses.length >= 2) setCount(2);
    })();
  }, []);

  const onContinue = async () => {
    if (count == null) return;
    const slots = Array.from({ length: count }, () => ({
      local_id: makeLocalID(),
      kind: 'fetus' as const,
    }));
    await resetChildren(slots);
    router.push('/(onboarding)/case-a/fetus?index=0');
  };

  return (
    <CaseAccentTheme case="A">
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']} testID="onboarding-case-a-count">
        <OnboardingProgressBar n={1} of={3} label="Case A · 1/3" />
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.hero}>
            <Text variant="h2" color="primary" style={styles.heading}>
              지금 만나고 있는 아이는 몇 명인가요?
            </Text>
            <Text variant="emotion" color="secondary" style={styles.helper}>
              다태아도 괜찮아요. 한 명씩 따로 정보를 알려주세요.
            </Text>
          </View>
          <CountPicker
            value={count}
            onChange={setCount}
            mode="pregnancy"
            testID="case-a-count"
          />
        </ScrollView>
        <View style={styles.footer}>
          <Button
            title="계속하기"
            variant="primary"
            fullWidth
            disabled={count == null}
            onPress={onContinue}
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
  scroll: { flex: 1 },
  body: {
    paddingHorizontal: spacing[6],
    paddingTop: spacing[8],
    paddingBottom: spacing[6],
    gap: spacing[6],
  },
  hero: { gap: spacing[3] },
  heading: { textAlign: 'left' },
  helper: { textAlign: 'left' },
  footer: { paddingHorizontal: spacing[6], paddingBottom: spacing[4] },
});
