import { Stack } from 'expo-router';

import { colors } from '../../src/theme/colors';

// Dedicated stack for the case-branched onboarding funnel (PRD-006).
// Header is hidden so each screen can own its own progress bar / case
// indicator. Cream background matches the rest of the app so there are
// no visible seams between stacks.
export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg.cream },
      }}
    >
      {/* Common entry — Q1 → Q2 → case decision */}
      <Stack.Screen name="q1" />
      <Stack.Screen name="q2" />
      {/* Case A — fetus only */}
      <Stack.Screen name="case-a/count" />
      <Stack.Screen name="case-a/fetus" />
      <Stack.Screen name="case-a/purpose" />
      {/* Case B — parenting first, then pregnancy */}
      <Stack.Screen name="case-b/intro1" />
      <Stack.Screen name="case-b/count1" />
      <Stack.Screen name="case-b/child" />
      <Stack.Screen name="case-b/intro2" />
      <Stack.Screen name="case-b/count2" />
      <Stack.Screen name="case-b/fetus" />
      <Stack.Screen name="case-b/purpose" />
      {/* Case C — parenting only */}
      <Stack.Screen name="case-c/count" />
      <Stack.Screen name="case-c/child" />
      <Stack.Screen name="case-c/purpose" />
    </Stack>
  );
}
