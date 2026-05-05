// B3 — Case B 2단계 안내 ("이제 임신 중인 아이를 알려주세요").

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

export default function CaseBIntro2() {
  const router = useRouter();
  useFocusEffect(
    useCallback(() => {
      void saveDraft({ last_step: '/case-b/intro2' });
    }, []),
  );
  return (
    <OnboardingScreen
      case="B"
      step={4}
      totalSteps={7}
      progressLabel="Case B · 2단계"
      cta={{
        title: '계속하기',
        onPress: () => router.push('/(onboarding)/case-b/count2'),
        testID: 'b3-next',
      }}
      testID="onboarding-b3"
    >
      <View style={{ alignItems: 'center', gap: spacing[5] }}>
        <StepIndicator step="two" />
        <Text variant="h2" color="primary" style={{ textAlign: 'center' }}>
          이제 임신 중인{'\n'}아이를 알려주세요
        </Text>
        <Text variant="body" color="secondary" style={{ textAlign: 'center' }}>
          새로 만날 아이를 위한{'\n'}기록 공간을 만들어요
        </Text>
      </View>
    </OnboardingScreen>
  );
}
