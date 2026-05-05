import { Stack } from 'expo-router';

import { colors } from '../../src/theme/colors';

// Dedicated stack for the case-branching onboarding funnel (PRD-006).
// Each case lives in its own subfolder (case-a/, case-b/, case-c/) so
// the intra-case navigation stays scoped, and the top-level `q1` /
// `q2` files own the common entry. Header is hidden on every screen
// because each one renders its own progress bar + case header.
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
