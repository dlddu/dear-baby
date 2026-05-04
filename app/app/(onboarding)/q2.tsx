// Q2 — 양육 여부 (PRD-006 AC-006-01)
//
// "이미 태어난 아이가 있나요?" — 예/아니요. After the user picks, the
// case is decided from (q1_pregnant, q2_caregiver) per the AC matrix:
//
//   임신 O · 양육 X → Case A
//   임신 O · 양육 O → Case B
//   임신 X · 양육 O → Case C
//   임신 X · 양육 X → Case A (with apologetic copy — see PRD §AC-006-01)

import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { Text } from '../../src/components/Text';
import {
  CaseAccentTheme,
  OnboardingProgressBar,
} from '../../src/components/onboarding';
import {
  loadDraft,
  resetChildren,
  saveDraft,
  type OnboardingDraft,
} from '../../src/onboarding/draft';
import type { CaseKind } from '../../src/api/onboarding';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';

function decideCase(
  q1: boolean | undefined,
  q2: boolean | undefined,
): CaseKind | null {
  if (typeof q1 !== 'boolean' || typeof q2 !== 'boolean') return null;
  if (q1 && !q2) return 'A';
  if (q1 && q2) return 'B';
  if (!q1 && q2) return 'C';
  return 'A'; // 임신X·양육X — fall through to Case A flow
}

function nextRouteForCase(c: CaseKind): string {
  switch (c) {
    case 'A':
      return '/(onboarding)/case-a/count';
    case 'B':
      return '/(onboarding)/case-b/intro1';
    case 'C':
      return '/(onboarding)/case-c/count';
  }
}

export default function OnboardingQ2() {
  const router = useRouter();
  const [draft, setDraft] = useState<OnboardingDraft | null>(null);
  const [caregiver, setCaregiver] = useState<boolean | null>(null);

  useEffect(() => {
    void (async () => {
      const d = await loadDraft();
      setDraft(d);
      if (typeof d.q2_caregiver === 'boolean') {
        setCaregiver(d.q2_caregiver);
      }
    })();
  }, []);

  const onPick = async (value: boolean) => {
    setCaregiver(value);
    const next = await saveDraft({
      q2_caregiver: value,
      last_step: '/q2',
    });
    setDraft(next);
    const decided = decideCase(next.q1_pregnant, value);
    if (decided) {
      // Reset the children array — the user may have come back from a
      // case-specific screen with stale entries from a different case.
      const cleared = await resetChildren([]);
      await saveDraft({ ...cleared, case: decided });
      router.push(nextRouteForCase(decided));
    }
  };

  const noPregnancyNoCaregiver =
    draft?.q1_pregnant === false && caregiver === false;

  return (
    <CaseAccentTheme case="common">
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']} testID="onboarding-q2">
        <OnboardingProgressBar n={2} of={3} />
        <View style={styles.body}>
          <View style={styles.hero}>
            <Text variant="h2" color="primary" style={styles.heading}>
              이미 태어난 아이가 있나요?
            </Text>
            <Text variant="emotion" color="secondary" style={styles.helper}>
              양육 중인 아이가 있다면 함께 기록을 모아볼게요
            </Text>
          </View>
          <View style={styles.actions}>
            <Button
              title="네, 있어요"
              variant={caregiver === true ? 'primary' : 'secondary'}
              fullWidth
              onPress={() => onPick(true)}
              testID="q2-yes"
            />
            <Button
              title="아니요, 없어요"
              variant={caregiver === false ? 'primary' : 'secondary'}
              fullWidth
              onPress={() => onPick(false)}
              testID="q2-no"
            />
            {noPregnancyNoCaregiver ? (
              <Card padding="md" surface="cream" style={styles.notice}>
                <Text variant="caption" color="secondary" style={styles.noticeText}>
                  지금은 임신·양육 중이 아니시군요. 임신을 준비 중인
                  단계까지 함께 살피는 흐름은 곧 준비할게요. 우선
                  임신 흐름으로 안내해 드릴 테니, 마음에 들지 않으면
                  설정에서 다시 조정해 주세요.
                </Text>
              </Card>
            ) : null}
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
  notice: { marginTop: spacing[2] },
  noticeText: { lineHeight: 18 },
});
