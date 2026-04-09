import { StatusBar } from 'expo-status-bar';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { Button, StyleSheet, Text, View } from 'react-native';

import { exchangeGoogleIdToken } from '../src/api/auth';
import { useAuth } from '../src/auth/AuthContext';
import {
  API_URL,
  GOOGLE_ANDROID_CLIENT_ID,
  GOOGLE_IOS_CLIENT_ID,
  GOOGLE_WEB_CLIENT_ID,
} from '../src/config/env';

// Dismisses the in-app browser when the OAuth redirect returns.
WebBrowser.maybeCompleteAuthSession();

// Landing screen shown when the user is not authenticated. This screen is
// load-bearing for the Maestro E2E flow at app/.maestro/health.yaml — it
// must keep the exact testIDs `root`, `check-health-button`, and
// `health-status`, and the health fetch must hit
// `${EXPO_PUBLIC_API_URL}/health` returning `{"status":"ok"}`.
export default function Landing() {
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const { setSession } = useAuth();

  const [, response, promptAsync] = Google.useAuthRequest({
    iosClientId: GOOGLE_IOS_CLIENT_ID || undefined,
    androidClientId: GOOGLE_ANDROID_CLIENT_ID || undefined,
    webClientId: GOOGLE_WEB_CLIENT_ID || undefined,
  });

  useEffect(() => {
    if (response?.type !== 'success') return;
    const idToken = response.params?.id_token;
    if (!idToken) return;
    (async () => {
      try {
        const session = await exchangeGoogleIdToken(idToken);
        await setSession(session);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, [response, setSession]);

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
      <Text style={styles.title}>dear-baby</Text>
      <Button
        title="Check health"
        onPress={checkHealth}
        testID="check-health-button"
      />
      {status !== '' && (
        <Text style={styles.status} testID="health-status">
          status: {status}
        </Text>
      )}
      <Button
        title="Sign in with Google"
        onPress={() => {
          setError('');
          promptAsync().catch((e) => {
            setError(e instanceof Error ? e.message : String(e));
          });
        }}
        testID="google-signin-button"
      />
      {error !== '' && (
        <Text style={styles.error} testID="health-error">
          error: {error}
        </Text>
      )}
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  title: { fontSize: 24, fontWeight: '600' },
  status: { fontSize: 18, color: '#0a0' },
  error: { fontSize: 14, color: '#a00' },
});
