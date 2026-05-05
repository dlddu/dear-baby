// B3 — Case B 2단계 안내 ("이제 임신 중인 아이를 알려주세요")
//
// Wireframe: docs/wireframes/onboarding/case-b.svg (B3 panel).

import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '../../../src/components/Button';
import { Text } from '../../../src/components/Text';
import {
  ScreenScaffold,
  StepIndicator,
} from '../../../src/components/onboarding';
import { spacing } from '../../../src/theme/spacing';
import { loadDraft, saveDraft } from '../../../src/onboarding/draft';

export default function CaseBIntro2() {
  const router = useRouter();

  useEffect(() => {
    void (async () => {
      const d = await loadDraft();
      if (d.case !== 'B' || d.children.filter((c) => c.kind === 'child').length === 0) {
        router.replace('/(onboarding)/q1');
      }
    })();
  }, [router]);

  const onContinue = async () => {
    await saveDraft((d) => ({ ...d, last_step: 'case-b/intro2' }));
    router.push('/(onboarding)/case-b/count2');
  };

  return (
    <ScreenScaffold
      case="B"
      current={4}
      total={7}
      stepLabel="Case B · 2단계"
      testID="onboarding-b3"
      actions={
        <Button
          title="계속하기"
          variant="primary"
          fullWidth
          onPress={onContinue}
          testID="onboarding-b3-continue"
        />
      }
    >
      <StepIndicator active="two" />
      <View style={styles.titleBlock}>
        <Text variant="h2" color="primary" style={styles.center}>
          이제 임신 중인{'\n'}아이를 알려주세요
        </Text>
        <Text variant="body" color="secondary" style={styles.center}>
          새로 만날 아이를 위한{'\n'}기록 공간을 만들어요
        </Text>
      </View>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  titleBlock: { gap: spacing[3] },
  center: { textAlign: 'center' },
});
