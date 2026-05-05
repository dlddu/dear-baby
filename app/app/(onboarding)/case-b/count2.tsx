// B4 — 임신 아이 수 (단태/다태)
//
// Wireframe: docs/wireframes/onboarding/case-b.svg (B4 panel).

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

export default function CaseBCount2() {
  const router = useRouter();
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    void (async () => {
      const d = await loadDraft();
      if (d.case !== 'B') {
        router.replace('/(onboarding)/q1');
        return;
      }
      const fetuses = d.children.filter((c) => c.kind === 'fetus').length;
      if (fetuses > 0) setCount(fetuses);
    })();
  }, [router]);

  const onNext = async () => {
    if (count == null) return;
    await saveDraft((d) => {
      const sized = resizeKind(d, 'fetus', count);
      return { ...sized, last_step: 'case-b/count2' };
    });
    router.push('/(onboarding)/case-b/fetus?index=0');
  };

  return (
    <ScreenScaffold
      case="B"
      current={5}
      total={7}
      stepLabel="Case B · 2단계 ①"
      testID="onboarding-b4"
      actions={
        <Button
          title="다음"
          variant="primary"
          fullWidth
          disabled={count == null}
          onPress={onNext}
          testID="onboarding-b4-next"
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
          testID="onboarding-b4-singleton"
        />
        <ChoiceCard
          label="다태"
          description="2명 이상"
          variant="tall"
          selected={count != null && count >= 2}
          onPress={() => setCount(2)}
          style={styles.col}
          testID="onboarding-b4-twins"
        />
      </View>
      <Text variant="caption" color="muted">
        기존 아이와 별도로 관리돼요
      </Text>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  headerBlock: { gap: spacing[2] },
  options: { flexDirection: 'row', gap: spacing[3] },
  col: { flex: 1 },
});
