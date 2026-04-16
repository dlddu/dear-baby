import { StatusBar } from 'expo-status-bar';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '../src/components/Button';
import { Text } from '../src/components/Text';
import { exchangeGoogleIdToken } from '../src/api/auth';
import { useAuth } from '../src/auth/AuthContext';
import {
  API_URL,
  GOOGLE_ANDROID_CLIENT_ID,
  GOOGLE_IOS_CLIENT_ID,
  GOOGLE_WEB_CLIENT_ID,
} from '../src/config/env';
import { colors } from '../src/theme/colors';
import { spacing } from '../src/theme/spacing';

// Dismisses the in-app browser when the OAuth redirect returns.
WebBrowser.maybeCompleteAuthSession();

// Only mount the Google sign-in button when a client ID is configured for
// the current platform. Without this guard, Google.useAuthRequest throws on
// Android when only iOS/web IDs are set, which blocks the landing screen
// from rendering and breaks the Maestro health flow.
const hasGoogleConfig =
  (Platform.OS === 'ios' && Boolean(GOOGLE_IOS_CLIENT_ID)) ||
  (Platform.OS === 'android' && Boolean(GOOGLE_ANDROID_CLIENT_ID)) ||
  (Platform.OS === 'web' && Boolean(GOOGLE_WEB_CLIENT_ID));

// GoogleSignInButton is split into its own component so that
// Google.useAuthRequest — which throws when invoked with no client IDs —
// is only ever called when at least one client ID is configured. CI does
// not set the EXPO_PUBLIC_GOOGLE_*_CLIENT_ID vars, so in CI this component
// is not mounted at all and the landing screen still renders for Maestro.
function GoogleSignInButton({
  onError,
}: {
  onError: (message: string) => void;
}) {
  const { setSession } = useAuth();
  const [, response, promptAsync] = Google.useAuthRequest({
    iosClientId: GOOGLE_IOS_CLIENT_ID || undefined,
    androidClientId: GOOGLE_ANDROID_CLIENT_ID || undefined,
    webClientId: GOOGLE_WEB_CLIENT_ID || undefined,
  });

  useEffect(() => {
    if (response?.type !== 'success') return;
    const idToken =
      response.authentication?.idToken ?? response.params?.id_token;
    if (!idToken) return;
    (async () => {
      try {
        const session = await exchangeGoogleIdToken(idToken);
        await setSession(session);
      } catch (e) {
        onError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, [response, setSession, onError]);

  return (
    <Pressable
      testID="google-signin-button"
      onPress={() => {
        onError('');
        promptAsync().catch((e) => {
          onError(e instanceof Error ? e.message : String(e));
        });
      }}
      style={({ pressed }) => [styles.googleButton, pressed && styles.pressed]}
    >
      <Text variant="body" color="primary" style={styles.googleLabel}>
        Sign in with Google
      </Text>
    </Pressable>
  );
}

// Landing screen shown when the user is not authenticated. This screen is
// load-bearing for the Maestro E2E flow at app/.maestro/health.yaml — it
// must keep the exact testIDs `root`, `check-health-button`, and
// `health-status`, and the health fetch must hit
// `${EXPO_PUBLIC_API_URL}/health` returning `{"status":"ok"}`.
export default function Landing() {
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  const checkHealth = async () => {
    setStatus('');
    setError('');
    try {
      const res = await fetch(`${API_URL}/health`);
      const json = (await res.json()) as { status: string };
      setStatus(json.status);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <View style={styles.container} testID="root">
      <Text variant="display" color="primary" style={styles.title}>
        dear-baby
      </Text>
      <Text variant="emotion" color="secondary" style={styles.tagline}>
        아기를 기다리는 소중한 시간, 함께 기록해볼까요?
      </Text>
      <Button
        title="Check health"
        variant="primary"
        onPress={checkHealth}
        testID="check-health-button"
      />
      {status !== '' && (
        <Text variant="body" color="primary" testID="health-status" style={styles.status}>
          status: {status}
        </Text>
      )}
      {hasGoogleConfig && <GoogleSignInButton onError={setError} />}
      {error !== '' && (
        <Text variant="caption" testID="health-error" style={styles.error}>
          error: {error}
        </Text>
      )}
      <StatusBar style="dark" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.cream,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[6],
    gap: spacing[4],
  },
  title: { textAlign: 'center' },
  tagline: { textAlign: 'center', marginBottom: spacing[4] },
  status: { color: colors.accent.sage, fontWeight: '600' },
  error: { color: '#A05040' },
  googleButton: {
    borderWidth: 1,
    borderColor: colors.bg.beige,
    backgroundColor: colors.surface.ivory,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: spacing[5],
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  googleLabel: { fontWeight: '600' },
  pressed: { opacity: 0.9 },
});
