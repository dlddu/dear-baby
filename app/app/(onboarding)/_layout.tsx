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
      <Stack.Screen name="welcome" />
    </Stack>
  );
}
