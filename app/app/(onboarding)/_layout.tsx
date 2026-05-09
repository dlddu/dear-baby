import { Stack } from 'expo-router';

import { OnboardingProvider } from '../../src/onboarding/OnboardingContext';
import { colors } from '../../src/theme/colors';

// Dedicated stack for the onboarding funnel. Keeps the header hidden so each
// screen can own its own full-bleed layout, and uses the same cream
// background as the rest of the app so there are no seams between stacks.
//
// OnboardingProvider 는 이 스택 안에서 마운트되고, mount 시 SecureStore
// 에서 진행 중 입력을 hydrate 한다. 사용자가 앱을 강제 종료한 뒤
// 재진입해도 마지막 입력 상태가 그대로 표시된다. `completeOnboarding`
// 성공 시 SecureStore 의 진행 슬롯은 자동으로 정리된다.
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
        <Stack.Screen name="a1" />
        <Stack.Screen name="a2" />
        <Stack.Screen name="c1" />
        <Stack.Screen name="c2" />
        <Stack.Screen name="not-ready" />
      </Stack>
    </OnboardingProvider>
  );
}
