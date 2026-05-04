// Q1 — 임신 여부 (PRD-006 AC-006-01)
//
// "현재 임신 중이신가요?" — 예/아니요. The answer is saved to the draft;
// the case is decided after Q2 sees both answers.

import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../../src/components/Button';
import { Text } from '../../src/components/Text';
import {
  CaseAccentTheme,
  OnboardingProgressBar,
} from '../../src/components/onboarding';
import { loadDraft, saveDraft } from '../../src/onboarding/draft';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';

export default function OnboardingQ1() {
  const router = useRouter();
  const [pregnant, setPregnant] = useState<boolean | null>(null);

  useEffect(() => {
    void (async () => {
      const draft = await loadDraft();
      if (typeof draft.q1_pregnant === 'boolean') {
        setPregnant(draft.q1_pregnant);
      }
    })();
  }, []);

  const onPick = async (value: boolean) => {
    setPregnant(value);
    await saveDraft({ q1_pregnant: value, last_step: '/q1' });
    router.push('/(onboarding)/q2');
  };

  return (
    <CaseAccentTheme case="common">
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']} testID="onboarding-q1">
        <OnboardingProgressBar n={1} of={3} />
        <View style={styles.body}>
          <View style={styles.hero}>
            <Text variant="h2" color="primary" style={styles.heading}>
              현재 임신 중이신가요?
            </Text>
            <Text variant="emotion" color="secondary" style={styles.helper}>
              어떤 흐름이 가장 잘 맞을지 함께 정해볼게요
            </Text>
          </View>
          <View style={styles.actions}>
            <Button
              title="네, 임신 중이에요"
              variant={pregnant === true ? 'primary' : 'secondary'}
              fullWidth
              onPress={() => onPick(true)}
              testID="q1-yes"
            />
            <Button
              title="아니요, 임신 중이 아니에요"
              variant={pregnant === false ? 'primary' : 'secondary'}
              fullWidth
              onPress={() => onPick(false)}
              testID="q1-no"
            />
          </View>
        </View>
        <StatusBar style="dark" />
      </SafeAreaView>
    </CaseAccentTheme>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.cream },
  body: {
    flex: 1,
    paddingHorizontal: spacing[6],
    paddingTop: spacing[8],
    paddingBottom: spacing[6],
    justifyContent: 'space-between',
  },
  hero: { gap: spacing[3] },
  heading: { textAlign: 'left' },
  helper: { textAlign: 'left' },
  actions: { gap: spacing[3] },
});
