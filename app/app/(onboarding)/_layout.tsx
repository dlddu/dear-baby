import { Stack } from 'expo-router';

import { colors } from '../../src/theme/colors';

// Dedicated stack for the PRD-006 케이스 분기 온보딩 funnel. The funnel is
// strictly forward — back navigation is handled by each screen's
// StepHeader, and screens keep their own state in SecureStore via
// useOnboardingDraft so accidental kill/relaunch resumes mid-funnel.
//
// Step order: intro → case-pregnancy → case-children → case-X/* → complete.
// The case-X branches are mounted as nested screens (file-based routing
// picks them up automatically); each screen guards its own preconditions
// against the draft.
export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg.cream },
      }}
    >
      <Stack.Screen name="intro" />
      <Stack.Screen name="case-pregnancy" />
      <Stack.Screen name="case-children" />
      <Stack.Screen name="case-a/multiple" />
      <Stack.Screen name="case-a/fetus/[index]" />
      <Stack.Screen name="case-a/purpose" />
      <Stack.Screen name="case-b/intro" />
      <Stack.Screen name="case-b/count" />
      <Stack.Screen name="case-b/child/[index]" />
      <Stack.Screen name="case-b/pregnancy-intro" />
      <Stack.Screen name="case-b/multiple" />
      <Stack.Screen name="case-b/fetus/[index]" />
      <Stack.Screen name="case-b/purposes" />
      <Stack.Screen name="case-c/count" />
      <Stack.Screen name="case-c/child/[index]" />
      <Stack.Screen name="case-c/purpose" />
      <Stack.Screen name="complete" />
    </Stack>
  );
}
