// B0 — Case B 1단계 안내 ("양육 중인 아이를 먼저 알려주세요")
//
// Wireframe: docs/wireframes/onboarding/case-b.svg (B0 panel).

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

export default function CaseBIntro1() {
  const router = useRouter();

  useEffect(() => {
    void (async () => {
      const d = await loadDraft();
      if (d.case !== 'B') {
        router.replace('/(onboarding)/q1');
      }
    })();
  }, [router]);

  const onStart = async () => {
    await saveDraft((d) => ({ ...d, last_step: 'case-b/intro1' }));
    router.push('/(onboarding)/case-b/count1');
  };

  return (
    <ScreenScaffold
      case="B"
      current={1}
      total={7}
      stepLabel="Case B · 1단계"
      testID="onboarding-b0"
      actions={
        <Button
          title="시작하기"
          variant="primary"
          fullWidth
          onPress={onStart}
          testID="onboarding-b0-start"
        />
      }
    >
      <StepIndicator active="one" />
      <View style={styles.titleBlock}>
        <Text variant="h2" color="primary" style={styles.center}>
          양육 중인 아이를{'\n'}먼저 알려주세요
        </Text>
        <Text variant="body" color="secondary" style={styles.center}>
          이미 함께 자란 아이부터{'\n'}차근차근 입력해요
        </Text>
      </View>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  titleBlock: { gap: spacing[3] },
  center: { textAlign: 'center' },
});
