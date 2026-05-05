// Q2 — "이미 태어난 아이가 있나요?" (AC-006-01)
//
// Forks routing into Case A / B / C based on the (q1, q2) answer pair:
//   - (yes, yes)   → Case B (양육 + 임신)
//   - (yes, no)    → Case A (임신만)
//   - (no, yes)    → Case C (양육만)
//   - (no, no)     → Case A with a warm copy ("임신을 준비 중이시라면…")
//
// The PRD asks us to be welcoming on the (no, no) corner rather than
// blocking the user. We show an inline note in that case so the user
// understands why we're routing them to the pregnancy funnel.
//
// Wireframe: docs/wireframes/onboarding/common.svg (Q2 panel).

import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { Text } from '../../src/components/Text';
import {
  ChoiceCard,
  ScreenScaffold,
} from '../../src/components/onboarding';
import { spacing } from '../../src/theme/spacing';
import { determineCase, loadDraft, saveDraft } from '../../src/onboarding/draft';

export default function Q2() {
  const router = useRouter();
  const [q1, setQ1] = useState<boolean | null>(null);
  const [q2, setQ2] = useState<boolean | null>(null);

  useEffect(() => {
    void (async () => {
      const draft = await loadDraft();
      if (draft.q1 === undefined) {
        // User landed on Q2 without finishing Q1 — bounce them back.
        router.replace('/(onboarding)/q1');
        return;
      }
      setQ1(draft.q1);
      if (draft.q2 !== undefined) setQ2(draft.q2);
    })();
  }, [router]);

  const showFallbackCopy = q1 === false && q2 === false;

  const onNext = async () => {
    if (q1 === null || q2 === null) return;
    const caseKind = determineCase(q1, q2);
    await saveDraft((d) => ({
      ...d,
      q2,
      case: caseKind,
      last_step: 'q2',
    }));
    switch (caseKind) {
      case 'A':
        router.push('/(onboarding)/case-a/count');
        break;
      case 'B':
        router.push('/(onboarding)/case-b/intro1');
        break;
      case 'C':
        router.push('/(onboarding)/case-c/count');
        break;
    }
  };

  return (
    <ScreenScaffold
      current={2}
      total={3}
      stepLabel="2 / 3"
      testID="onboarding-q2"
      actions={
        <Button
          title="다음"
          variant="primary"
          fullWidth
          disabled={q2 === null}
          onPress={onNext}
          testID="onboarding-q2-next"
        />
      }
    >
      <View style={styles.headerBlock}>
        <Text variant="h2" color="primary">
          이미 태어난 아이가 있나요?
        </Text>
        <Text variant="body" color="secondary">
          현재 양육 중인 아이를 알려주세요
        </Text>
      </View>
      <View style={styles.options}>
        <ChoiceCard
          label="예, 양육 중이에요"
          selected={q2 === true}
          onPress={() => setQ2(true)}
          testID="onboarding-q2-yes"
        />
        <ChoiceCard
          label="아니요"
          selected={q2 === false}
          onPress={() => setQ2(false)}
          testID="onboarding-q2-no"
        />
      </View>
      {showFallbackCopy ? (
        <Card padding="md" surface="cream" testID="onboarding-q2-fallback-note">
          <Text variant="body" color="secondary">
            임신을 준비 중이시거나 아이를 기다리는 마음을 함께 기록할 수 있도록
            임산부 흐름으로 안내드릴게요.
          </Text>
        </Card>
      ) : null}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  headerBlock: { gap: spacing[2] },
  options: { gap: spacing[3] },
});
