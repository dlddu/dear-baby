import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React, { useCallback, useEffect } from 'react';
import { View } from 'react-native';

import { AnalyticsProvider } from '../src/analytics/AnalyticsProvider';
import { useAnalyticsIdentity } from '../src/analytics/useAnalyticsIdentity';
import { useScreenTracking } from '../src/analytics/useScreenTracking';
import { AuthProvider, useAuth } from '../src/auth/AuthContext';
import { ActiveChildProvider } from '../src/context/ActiveChildContext';
import { colors } from '../src/theme/colors';
import { useAppFonts } from '../src/theme/fonts';

// Keep the splash screen visible while we bootstrap fonts.
SplashScreen.preventAutoHideAsync().catch(() => {
  // ignore if already hidden (fast refresh / re-mount)
});

// AuthGate redirects the user between the public landing screen and the
// authenticated tab group based on auth status. While status is 'loading'
// it stays put — this is important for Maestro's health flow, which needs
// the landing screen to be visible on cold boot before any navigation
// effect runs.
function AuthGate({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  // Sync PostHog identity from inside AuthProvider's tree. Mounted here
  // (rather than in RootLayout) so that `useAuth()` is available.
  useAnalyticsIdentity();
  // Capture screen views from Expo Router's URL state. Required because
  // React Navigation v7 broke PostHog's built-in screen autocapture.
  useScreenTracking();

  useEffect(() => {
    if (status === 'loading') return;
    const root = segments[0];
    const inTabs = root === '(tabs)';
    const inOnboarding = root === '(onboarding)';
    // Authenticated-only modals live at the root but are still part of the
    // signed-in UX, so AuthGate treats them as equivalent to `(tabs)` — we
    // must not redirect back to the home tab or the modal would close
    // immediately after `router.push`.
    //
    // 'diary' covers diary/[id] + diary/[id]/edit — diary 상세·편집은
    // 풀스크린 push 라 (tabs) 밖에 살지만 인증된 사용자의 UX 의 연장이다.
    const inAuthedModal =
      root === 'record-text' ||
      root === 'record-audio' ||
      root === 'record-audio-review' ||
      root === 'drafts' ||
      root === 'diary';
    if (status === 'authenticated' && !inTabs && !inAuthedModal) {
      router.replace('/(tabs)');
    } else if (status === 'onboarding' && !inOnboarding) {
      router.replace('/(onboarding)/q1');
    } else if (
      status === 'unauthenticated' &&
      (inTabs || inOnboarding || inAuthedModal)
    ) {
      // `/` 는 (landing)/index 와 (tabs)/index 양쪽에 매칭되는 모호한 URL 이고,
      // expo-router 의 우선순위 타이브레이커는 "현재 서 있는 라우트의 그룹과의
      // 유사도" 다. 즉 (tabs) 안에서 로그아웃하면 맨 `/` 는 (tabs)/index 로
      // 되돌아가 무한 루프가 된다. 그룹을 명시해야 한다.
      router.replace('/(landing)');
    }
  }, [status, segments, router]);

  return <>{children}</>;
}

export default function RootLayout() {
  // Load the custom design-system fonts (Playfair Display / Noto Sans KR /
  // Gowun Batang) before unmounting the splash screen. The font assets are
  // bundled locally via `@expo-google-fonts/*`, so loading resolves on the
  // first frame and does not require network access.
  const [fontsLoaded, fontError] = useAppFonts();

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded || fontError) {
      await SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg.cream }} onLayout={onLayoutRootView}>
      <AnalyticsProvider>
        <AuthProvider>
          <ActiveChildProvider>
            <AuthGate>
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: colors.bg.cream },
                }}
              >
                {/* (landing) 은 _layout 이 없는 그룹이라 이 Stack 으로 호이스팅
                    된다. 스크린 이름은 가장 가까운 _layout 기준 상대 경로다. */}
                <Stack.Screen name="(landing)/index" />
                <Stack.Screen name="(onboarding)" />
                <Stack.Screen name="(tabs)" />
                <Stack.Screen
                  name="record-text"
                  options={{ presentation: 'modal', headerShown: false }}
                />
                <Stack.Screen
                  name="record-audio"
                  options={{ presentation: 'modal', headerShown: false }}
                />
                <Stack.Screen
                  name="record-audio-review"
                  options={{ presentation: 'modal', headerShown: false }}
                />
                <Stack.Screen
                  name="drafts"
                  options={{ presentation: 'modal', headerShown: false }}
                />
                <Stack.Screen name="diary/[id]" />
                <Stack.Screen name="diary/[id]/edit" />
              </Stack>
            </AuthGate>
          </ActiveChildProvider>
        </AuthProvider>
      </AnalyticsProvider>
    </View>
  );
}
