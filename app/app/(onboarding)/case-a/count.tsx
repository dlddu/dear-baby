// A1 — 임신 아이 수 (단태/다태) (AC-006-02)
//
// Two-card grid identical to the wireframe. Selecting "다태" opens a
// stepper for 2/3+ — but for now we only ask "단태" vs "다태" and treat
// 다태 as 2 unless the user changes the count on the next screen. This
// matches the wireframe (the 다태 card just says "2명 이상").
//
// Wireframe: docs/wireframes/onboarding/case-a.svg (A1 panel).

import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '../../../src/components/Button';
import { Text } from '../../../src/components/Text';
import {
  ChoiceCard,
  ScreenScaffold,
} from '../../../src/components/onboarding';
import { spacing } from '../../../src/theme/spacing';
import { loadDraft, resizeKind, saveDraft } from '../../../src/onboarding/draft';

export default function CaseACount() {
  const router = useRouter();
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    void (async () => {
      const draft = await loadDraft();
      const fetuses = draft.children.filter((c) => c.kind === 'fetus').length;
      if (fetuses > 0) setCount(fetuses);
    })();
  }, []);

  const onNext = async () => {
    if (count == null) return;
    await saveDraft((d) => {
      const sized = resizeKind(d, 'fetus', count);
      return { ...sized, last_step: 'case-a/count' };
    });
    router.push('/(onboarding)/case-a/fetus?index=0');
  };

  return (
    <ScreenScaffold
      case="A"
      current={1}
      total={3}
      testID="onboarding-a1"
      actions={
        <Button
          title="다음"
          variant="primary"
          fullWidth
          disabled={count == null}
          onPress={onNext}
          testID="onboarding-a1-next"
        />
      }
    >
      <View style={styles.headerBlock}>
        <Text variant="h2" color="primary">
          임신 중인 아이는{'\n'}몇 명인가요?
        </Text>
      </View>
      <View style={styles.options}>
        <ChoiceCard
          label="단태"
          description="1명"
          variant="tall"
          selected={count === 1}
          onPress={() => setCount(1)}
          style={styles.col}
          testID="onboarding-a1-singleton"
        />
        <ChoiceCard
          label="다태"
          description="2명 이상"
          variant="tall"
          selected={count != null && count >= 2}
          onPress={() => setCount(2)}
          style={styles.col}
          testID="onboarding-a1-twins"
        />
      </View>
      <Text variant="caption" color="muted">
        선택 시 입력할 태아 수가 결정돼요
      </Text>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  headerBlock: { gap: spacing[2] },
  options: { flexDirection: 'row', gap: spacing[3] },
  col: { flex: 1 },
});
