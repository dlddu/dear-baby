// B0 — Case B 1단계 안내 ("양육 중인 아이 먼저"). 와이어프레임
// docs/wireframes/onboarding/case-b.svg.

import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { View } from 'react-native';

import {
  OnboardingScreen,
  StepIndicator,
} from '../../../src/components/onboarding';
import { Text } from '../../../src/components/Text';
import { spacing } from '../../../src/theme/spacing';
import { saveDraft } from '../../../src/onboarding/draft';

export default function CaseBIntro1() {
  const router = useRouter();
  useFocusEffect(
    useCallback(() => {
      void saveDraft({ last_step: '/case-b/intro1' });
    }, []),
  );
  return (
    <OnboardingScreen
      case="B"
      step={1}
      totalSteps={7}
      progressLabel="Case B · 1단계"
      cta={{
        title: '시작하기',
        onPress: () => router.push('/(onboarding)/case-b/count1'),
        testID: 'b0-next',
      }}
      testID="onboarding-b0"
    >
      <View style={{ alignItems: 'center', gap: spacing[5] }}>
        <StepIndicator step="one" />
        <Text variant="h2" color="primary" style={{ textAlign: 'center' }}>
          양육 중인 아이를{'\n'}먼저 알려주세요
        </Text>
        <Text variant="body" color="secondary" style={{ textAlign: 'center' }}>
          이미 함께 자란 아이부터{'\n'}차근차근 입력해요
        </Text>
      </View>
    </OnboardingScreen>
  );
}
