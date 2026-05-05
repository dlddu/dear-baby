// Q1 — 임신 여부 체크 (와이어프레임 docs/wireframes/onboarding/common.svg)
// 케이스 결정 전 그레이 진행 바 사용. 1 / 3 단계.

import { useFocusEffect } from 'expo-router';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';

import { OnboardingScreen, SelectCard } from '../../src/components/onboarding';
import { Text } from '../../src/components/Text';
import { spacing } from '../../src/theme/spacing';
import { loadDraft, saveDraft } from '../../src/onboarding/draft';

export default function OnboardingQ1() {
  const router = useRouter();
  const [pregnant, setPregnant] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    void loadDraft().then((d) => setPregnant(d.q1_pregnant));
  }, []);

  useFocusEffect(
    useCallback(() => {
      void saveDraft({ last_step: '/q1' });
    }, []),
  );

  const onNext = async () => {
    if (pregnant === undefined) return;
    await saveDraft({ q1_pregnant: pregnant });
    router.push('/(onboarding)/q2');
  };

  return (
    <OnboardingScreen
      step={1}
      totalSteps={3}
      cta={{
        title: '다음',
        onPress: onNext,
        disabled: pregnant === undefined,
        testID: 'q1-next',
      }}
      testID="onboarding-q1"
    >
      <View style={{ gap: spacing[2] }}>
        <Text variant="h2" color="primary">
          현재 임신 중이신가요?
        </Text>
        <Text variant="body" color="secondary">
          맞춤 안내를 위한 첫 번째 질문이에요
        </Text>
      </View>
      <View style={{ gap: spacing[3] }}>
        <SelectCard
          title="예, 임신 중이에요"
          selected={pregnant === true}
          onPress={() => setPregnant(true)}
          testID="q1-yes"
        />
        <SelectCard
          title="아니요"
          selected={pregnant === false}
          onPress={() => setPregnant(false)}
          testID="q1-no"
        />
      </View>
    </OnboardingScreen>
  );
}
