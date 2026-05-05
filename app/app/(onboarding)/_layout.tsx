import { Stack } from 'expo-router';

import { colors } from '../../src/theme/colors';

// Dedicated stack for the case-branching onboarding funnel. The
// individual screens own their own layout (cream background + scaffold
// chrome via <ScreenScaffold/>) so this stack just hides the system
// header.
//
// Route shape:
//   (onboarding)/q1                   AC-006-01 임신 여부
//   (onboarding)/q2                   AC-006-01 양육 여부 + 케이스 결정
//   (onboarding)/case-a/count         A1 단태/다태
//   (onboarding)/case-a/fetus         A2 태아 정보 (반복)
//   (onboarding)/case-a/purpose       A3 기록 목적
//   (onboarding)/case-b/intro1        B0 ① 양육 인디케이터
//   (onboarding)/case-b/count1        B1 양육 아이 수
//   (onboarding)/case-b/child         B2 양육 아이 정보 (반복)
//   (onboarding)/case-b/intro2        B3 ② 임신 인디케이터
//   (onboarding)/case-b/count2        B4 임신 아이 수
//   (onboarding)/case-b/fetus         B5 태아 정보 (반복)
//   (onboarding)/case-b/purpose       B6 아이별 기록 목적
//   (onboarding)/case-c/count         C1 양육 아이 수
//   (onboarding)/case-c/child         C2 아이 정보 (반복)
//   (onboarding)/case-c/purpose       C3 기록 목적
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
