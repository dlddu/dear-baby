// Q1 — "현재 임신 중이신가요?" (AC-006-01)
//
// Two-option single-select. The answer is staged in the AsyncStorage
// draft (not sent to the server yet) so the user can revisit it before
// submission. Q2 picks the answer up and forks routing into A/B/C.
//
// Wireframe: docs/wireframes/onboarding/common.svg (Q1 panel).

import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '../../src/components/Button';
import { Text } from '../../src/components/Text';
import {
  ChoiceCard,
  ScreenScaffold,
} from '../../src/components/onboarding';
import { spacing } from '../../src/theme/spacing';
import { loadDraft, saveDraft } from '../../src/onboarding/draft';

export default function Q1() {
  const router = useRouter();
  const [answer, setAnswer] = useState<boolean | null>(null);

  useEffect(() => {
    void (async () => {
      const draft = await loadDraft();
      if (draft.q1 !== undefined) {
        setAnswer(draft.q1);
      }
    })();
  }, []);

  const onNext = async () => {
    if (answer === null) return;
    await saveDraft((d) => ({ ...d, q1: answer, last_step: 'q1' }));
    router.push('/(onboarding)/q2');
  };

  return (
    <ScreenScaffold
      current={1}
      total={3}
      stepLabel="1 / 3"
      testID="onboarding-q1"
      actions={
        <Button
          title="다음"
          variant="primary"
          fullWidth
          disabled={answer === null}
          onPress={onNext}
          testID="onboarding-q1-next"
        />
      }
    >
      <View style={styles.headerBlock}>
        <Text variant="h2" color="primary">
          현재 임신 중이신가요?
        </Text>
        <Text variant="body" color="secondary">
          맞춤 안내를 위한 첫 번째 질문이에요
        </Text>
      </View>
      <View style={styles.options}>
        <ChoiceCard
          label="예, 임신 중이에요"
          selected={answer === true}
          onPress={() => setAnswer(true)}
          testID="onboarding-q1-yes"
        />
        <ChoiceCard
          label="아니요"
          selected={answer === false}
          onPress={() => setAnswer(false)}
          testID="onboarding-q1-no"
        />
      </View>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  headerBlock: { gap: spacing[2] },
  options: { gap: spacing[3] },
});
