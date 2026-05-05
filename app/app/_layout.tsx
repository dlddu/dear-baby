import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React, { useCallback, useEffect } from 'react';
import { View } from 'react-native';

import { AnalyticsProvider } from '../src/analytics/AnalyticsProvider';
import { useAnalyticsIdentity } from '../src/analytics/useAnalyticsIdentity';
import { useScreenTracking } from '../src/analytics/useScreenTracking';
import { AuthProvider, useAuth } from '../src/auth/AuthContext';
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
    const inAuthedModal =
      root === 'record-text' ||
      root === 'record-audio' ||
      root === 'record-audio-review' ||
      root === 'drafts';
    if (status === 'authenticated' && !inTabs && !inAuthedModal) {
      router.replace('/(tabs)');
    } else if (status === 'onboarding' && !inOnboarding) {
      router.replace('/(onboarding)/q1');
    } else if (
      status === 'unauthenticated' &&
      (inTabs || inOnboarding || inAuthedModal)
    ) {
      router.replace('/');
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
          <AuthGate>
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: colors.bg.cream },
              }}
            >
              <Stack.Screen name="index" />
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
            </Stack>
          </AuthGate>
        </AuthProvider>
      </AnalyticsProvider>
    </View>
  );
}
