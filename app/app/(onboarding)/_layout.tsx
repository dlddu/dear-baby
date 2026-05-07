import { Stack } from 'expo-router';

import { OnboardingProvider } from '../../src/onboarding/OnboardingContext';
import { colors } from '../../src/theme/colors';

// Dedicated stack for the onboarding funnel. Keeps the header hidden so each
// screen can own its own full-bleed layout, and uses the same cream
// background as the rest of the app so there are no seams between stacks.
//
// OnboardingProvider 는 이 스택 안에서만 살아 있다. 사용자가 홈으로 빠져
// 나가면 Provider 가 unmount 되며 Q1·Q2 답변도 함께 정리된다 (영속화 X).
export default function OnboardingLayout() {
  return (
    <OnboardingProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg.cream },
        }}
      >
        <Stack.Screen name="q1" />
        <Stack.Screen name="q2" />
        <Stack.Screen name="welcome" />
        <Stack.Screen name="not-ready" />
      </Stack>
    </OnboardingProvider>
  );
}
