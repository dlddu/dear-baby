import { Stack } from 'expo-router';

import { colors } from '../../src/theme/colors';

// Dedicated stack for the case-branching onboarding funnel. Each screen
// owns its own full-bleed layout (header hidden) and shares the cream
// background with the rest of the app so there are no seams between
// stacks. Routes:
//
//   q1, q2          — common 임신/양육 questions
//   case-a/{count,fetus,purpose}
//   case-b/{intro1,count1,child,intro2,count2,fetus,purpose}
//   case-c/{count,child,purpose}
export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg.cream },
      }}
    />
  );
}
