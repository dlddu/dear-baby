import { StatusBar } from 'expo-status-bar';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useRef, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, View } from 'react-native';

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
import { shadows } from '../src/theme/shadows';
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
// must keep the `root` testID, and the auto-fired health fetch must hit
// `${EXPO_PUBLIC_API_URL}/health` returning `{"status":"ok"}`. When the
// fetch fails or returns a non-ok status the `health-error-toast` testID
// becomes visible; CI asserts the inverse to prove the backend is up.
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
const TOAST_VISIBLE_MS = 3500;
const TOAST_FADE_MS = 200;
const TOAST_OFFSET_PX = 12;

export default function Landing() {
  const [testerLoginVisible, setTesterLoginVisible] = useState(false);
  const [errorVisible, setErrorVisible] = useState(false);
  const [healthChecked, setHealthChecked] = useState(false);
  const errorOpacity = useRef(new Animated.Value(0)).current;
  const errorOffset = useRef(new Animated.Value(TOAST_OFFSET_PX)).current;
  const { onLeftPress, onRightPress } = useTesterLoginGesture(() => {
    setTesterLoginVisible(true);
  });

  useEffect(() => {
    let cancelled = false;
    let dismissTimer: ReturnType<typeof setTimeout> | undefined;

    const showError = () => {
      if (cancelled) return;
      setErrorVisible(true);
      Animated.parallel([
        Animated.timing(errorOpacity, {
          toValue: 1,
          duration: TOAST_FADE_MS,
          useNativeDriver: true,
        }),
        Animated.timing(errorOffset, {
          toValue: 0,
          duration: TOAST_FADE_MS,
          useNativeDriver: true,
        }),
      ]).start();
      dismissTimer = setTimeout(() => {
        Animated.parallel([
          Animated.timing(errorOpacity, {
            toValue: 0,
            duration: TOAST_FADE_MS,
            useNativeDriver: true,
          }),
          Animated.timing(errorOffset, {
            toValue: TOAST_OFFSET_PX,
            duration: TOAST_FADE_MS,
            useNativeDriver: true,
          }),
        ]).start(({ finished }) => {
          if (!cancelled && finished) setErrorVisible(false);
        });
      }, TOAST_VISIBLE_MS);
    };

    (async () => {
      try {
        const res = await fetch(`${API_URL}/health`);
        const json = (await res.json()) as { status: string };
        if (json.status !== 'ok') showError();
      } catch (e) {
        console.error('health check failed', e);
        showError();
      } finally {
        // `health-check-complete` is the positive signal Maestro waits on
        // before asserting the error toast's absence. Without it the test
        // would race the async fetch and pass before the toast had a chance
        // to render. Set in finally so success and failure both flip the
        // flag — the toast (or its absence) is the actual signal under test.
        if (!cancelled) setHealthChecked(true);
      }
    })();

    return () => {
      cancelled = true;
      if (dismissTimer) clearTimeout(dismissTimer);
    };
  }, [errorOffset, errorOpacity]);

  return (
    <View style={styles.container} testID="root">
      <Text variant="display" color="primary" style={styles.title}>
        dear-baby
      </Text>
      <Text variant="emotion" color="secondary" style={styles.tagline}>
        아기를 기다리는 소중한 시간, 함께 기록해볼까요?
      </Text>
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
      {errorVisible && (
        <Animated.View
          testID="health-error-toast"
          accessibilityRole="alert"
          pointerEvents="none"
          style={[
            styles.toast,
            {
              opacity: errorOpacity,
              transform: [{ translateY: errorOffset }],
            },
          ]}
        >
          <Text variant="body" color="onPrimary" style={styles.toastText}>
            서버에 연결할 수 없어요
          </Text>
        </Animated.View>
      )}
      {healthChecked && (
        <View
          testID="health-check-complete"
          pointerEvents="none"
          style={styles.healthSentinel}
        />
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
  //
  // `top: 60` keeps the entire box south of every iPhone's safe-area
  // top inset (the iPhone 16 dynamic island reaches ~59pt), so iOS
  // delivers the touch to React instead of consuming it as a system
  // gesture. Android's status bar is shorter (~24-32dp) so 60 is
  // generous on both platforms.
  cornerHit: {
    position: 'absolute',
    top: 60,
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
  toast: {
    position: 'absolute',
    bottom: spacing[8],
    left: spacing[5],
    right: spacing[5],
    backgroundColor: colors.primary.coral,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    borderRadius: radius.sm,
    alignItems: 'center',
    ...shadows.elevated,
  },
  toastText: {
    fontWeight: '600',
    textAlign: 'center',
  },
  // Invisible 1×1 sentinel used by Maestro to know the auto-fired health
  // fetch has settled. Kept off-screen so it cannot collide with any
  // visual element or the corner hit zones.
  healthSentinel: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 1,
    height: 1,
  },
});
