import { StatusBar } from 'expo-status-bar';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '../src/components/Button';
import { Text } from '../src/components/Text';
import {
  exchangeAppleAuthCode,
  exchangeGoogleIdToken,
} from '../src/api/auth';
import { useAuth } from '../src/auth/AuthContext';
import { TesterLoginModal } from '../src/auth/TesterLoginModal';
import { useTesterLoginGesture } from '../src/auth/useTesterLoginGesture';
import {
  API_URL,
  GOOGLE_ANDROID_CLIENT_ID,
  GOOGLE_IOS_CLIENT_ID,
  GOOGLE_WEB_CLIENT_ID,
} from '../src/config/env';
import { colors } from '../src/theme/colors';
import { radius } from '../src/theme/radius';
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
function GoogleSignInButton() {
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
        console.error('google sign-in failed', e);
      }
    })();
  }, [response, setSession]);

  return (
    <Pressable
      testID="google-signin-button"
      onPress={() => {
        promptAsync().catch((e) => {
          console.error('google prompt failed', e);
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

// AppleSignInButton renders Apple's branded "Sign in with Apple" button on
// iOS and exchanges the returned authorization code with the backend. Apple
// only delivers the user's full name on the very first sign-in, so we
// forward whatever we get and let the backend persist it; on subsequent
// sign-ins Apple sends a null fullName and the backend keeps the previously
// stored value (see users.Store.UpsertByOAuth).
function AppleSignInButton() {
  const { setSession } = useAuth();
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    AppleAuthentication.isAvailableAsync()
      .then((ok) => {
        if (!cancelled) setAvailable(ok);
      })
      .catch(() => {
        // Older iOS or simulator without Apple ID — leave button hidden.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!available) return null;

  const onPress = async () => {
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.authorizationCode) {
        console.error('apple sign-in: missing authorizationCode');
        return;
      }
      const session = await exchangeAppleAuthCode({
        code: credential.authorizationCode,
        givenName: credential.fullName?.givenName ?? null,
        familyName: credential.fullName?.familyName ?? null,
      });
      await setSession(session);
    } catch (e: any) {
      // ERR_REQUEST_CANCELED is the user dismissing the modal — silent.
      if (e?.code === 'ERR_REQUEST_CANCELED') return;
      console.error('apple sign-in failed', e);
    }
  };

  return (
    <AppleAuthentication.AppleAuthenticationButton
      testID="apple-signin-button"
      buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
      buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
      cornerRadius={radius.sm}
      style={styles.appleButton}
      onPress={onPress}
    />
  );
}

// Landing screen shown when the user is not authenticated. This screen is
// load-bearing for the Maestro E2E flow at app/.maestro/health.yaml — it
// must keep the exact testIDs `root`, `check-health-button`, and
// `health-status`, and the health fetch must hit
// `${EXPO_PUBLIC_API_URL}/health` returning `{"status":"ok"}`.
//
// The two corner Pressables are intentionally invisible. Tapping the
// top-left 5–7 times and then the top-right 10+ times opens the
// tester-login modal (see useTesterLoginGesture). The same code runs
// in production — the Apple beta reviewer uses this gesture to log in
// with the seeded test account, and the Maestro flows drive it via
// the testIDs.
//
// They MUST stay in the accessibility tree (no `accessibilityElementsHidden`,
// no `importantForAccessibility="no-hide-descendants"`) — Maestro's
// element lookup uses the same accessibility identifiers Apple/Google
// expose, so hiding the pressables there hides them from the test
// harness too.
export default function Landing() {
  const [status, setStatus] = useState('');
  const [testerLoginVisible, setTesterLoginVisible] = useState(false);
  const { onLeftPress, onRightPress } = useTesterLoginGesture(() => {
    setTesterLoginVisible(true);
  });

  const checkHealth = async () => {
    setStatus('');
    try {
      const res = await fetch(`${API_URL}/health`);
      const json = (await res.json()) as { status: string };
      setStatus(json.status);
    } catch (e) {
      console.error('health check failed', e);
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
      {hasGoogleConfig && <GoogleSignInButton />}
      {Platform.OS === 'ios' && <AppleSignInButton />}

      <Pressable
        testID="tester-corner-tl"
        accessibilityRole="button"
        accessibilityLabel="tester corner top left"
        onPress={onLeftPress}
        style={[styles.cornerHit, styles.cornerHitTopLeft]}
      />
      <Pressable
        testID="tester-corner-tr"
        accessibilityRole="button"
        accessibilityLabel="tester corner top right"
        onPress={onRightPress}
        style={[styles.cornerHit, styles.cornerHitTopRight]}
      />
      <TesterLoginModal
        visible={testerLoginVisible}
        onClose={() => setTesterLoginVisible(false)}
      />
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
  googleButton: {
    borderWidth: 1,
    borderColor: colors.bg.beige,
    backgroundColor: colors.surface.ivory,
    borderRadius: radius.sm,
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[5],
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  googleLabel: { fontWeight: '600' },
  pressed: { opacity: 0.9 },
  // Invisible 80×80 hot zones in the top corners. Sized large enough
  // for a thumb-friendly tap target without spilling into the safe area
  // where the OS chrome lives. Background is omitted so the cream
  // landing screen shows through — testers cannot see them, only feel
  // them out by following the tap-count instructions.
  cornerHit: {
    position: 'absolute',
    top: 0,
    width: 80,
    height: 80,
  },
  cornerHitTopLeft: {
    left: 0,
  },
  cornerHitTopRight: {
    right: 0,
  },
  // Apple HIG requires the proprietary AppleAuthenticationButton with a
  // fixed height/width set via style. Background color and border radius
  // must be controlled by buttonStyle/cornerRadius props (see component
  // docs); we only set width + height here.
  appleButton: {
    alignSelf: 'stretch',
    height: 48,
  },
});
