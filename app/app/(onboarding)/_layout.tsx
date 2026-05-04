import { Stack } from 'expo-router';

import { colors } from '../../src/theme/colors';

// Dedicated stack for the onboarding funnel. Keeps the header hidden so each
// screen can own its own full-bleed layout, and uses the same cream
// background as the rest of the app so there are no seams between stacks.
export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg.cream },
      }}
    >
      <Stack.Screen name="q1" />
      <Stack.Screen name="q2" />
      <Stack.Screen name="case-a/count" />
      <Stack.Screen name="case-a/fetus" />
      <Stack.Screen name="case-a/purpose" />
      <Stack.Screen name="case-b/intro1" />
      <Stack.Screen name="case-b/count1" />
      <Stack.Screen name="case-b/child" />
      <Stack.Screen name="case-b/intro2" />
      <Stack.Screen name="case-b/count2" />
      <Stack.Screen name="case-b/fetus" />
      <Stack.Screen name="case-b/purpose" />
      <Stack.Screen name="case-c/count" />
      <Stack.Screen name="case-c/child" />
      <Stack.Screen name="case-c/purpose" />
    </Stack>
  );
}
