import { Stack, useRouter, useSegments } from 'expo-router';
import React, { useEffect } from 'react';

import { AuthProvider, useAuth } from '../src/auth/AuthContext';

// AuthGate redirects the user between the public landing screen and the
// authenticated tab group based on auth status. While status is 'loading'
// it stays put — this is important for Maestro's health flow, which needs
// the landing screen to be visible on cold boot before any navigation
// effect runs.
function AuthGate({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (status === 'loading') return;
    const inTabs = segments[0] === '(tabs)';
    if (status === 'authenticated' && !inTabs) {
      router.replace('/(tabs)');
    } else if (status === 'unauthenticated' && inTabs) {
      router.replace('/');
    }
  }, [status, segments, router]);

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <AuthGate>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(tabs)" />
        </Stack>
      </AuthGate>
    </AuthProvider>
  );
}
