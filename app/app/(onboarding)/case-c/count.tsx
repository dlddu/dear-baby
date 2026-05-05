// C1 — 양육 아이 수 (Case C)
//
// Wireframe: docs/wireframes/onboarding/case-c.svg (C1 panel).

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

export default function CaseCCount() {
  const router = useRouter();
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    void (async () => {
      const d = await loadDraft();
      if (d.case !== 'C') {
        router.replace('/(onboarding)/q1');
        return;
      }
      const kids = d.children.filter((c) => c.kind === 'child').length;
      if (kids > 0) setCount(kids);
    })();
  }, [router]);

  const onNext = async () => {
    if (count == null) return;
    await saveDraft((d) => {
      const sized = resizeKind(d, 'child', count);
      return { ...sized, last_step: 'case-c/count' };
    });
    router.push('/(onboarding)/case-c/child?index=0');
  };

  return (
    <ScreenScaffold
      case="C"
      current={1}
      total={3}
      testID="onboarding-c1"
      actions={
        <Button
          title="다음"
          variant="primary"
          fullWidth
          disabled={count == null}
          onPress={onNext}
          testID="onboarding-c1-next"
        />
      }
    >
      <View style={styles.headerBlock}>
        <Text variant="h2" color="primary">
          양육 중인 아이가{'\n'}몇 명인가요?
        </Text>
      </View>
      <View style={styles.options}>
        <ChoiceCard
          label="1명"
          selected={count === 1}
          onPress={() => setCount(1)}
          testID="onboarding-c1-1"
        />
        <ChoiceCard
          label="2명"
          selected={count === 2}
          onPress={() => setCount(2)}
          testID="onboarding-c1-2"
        />
        <ChoiceCard
          label="3명 이상"
          selected={count === 3}
          onPress={() => setCount(3)}
          testID="onboarding-c1-3"
        />
      </View>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  headerBlock: { gap: spacing[2] },
  options: { gap: spacing[3] },
});
