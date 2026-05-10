import { StatusBar } from 'expo-status-bar';
import * as AppleAuthentication from 'expo-apple-authentication';
import { LinearGradient } from 'expo-linear-gradient';
import {
  GoogleSignin,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from '@react-native-google-signin/google-signin';
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
  GOOGLE_IOS_CLIENT_ID,
  GOOGLE_WEB_CLIENT_ID,
} from '../src/config/env';
import { colors } from '../src/theme/colors';
import { fontFamilies } from '../src/theme/fonts';
import { radius } from '../src/theme/radius';
import { shadows } from '../src/theme/shadows';
import { spacing } from '../src/theme/spacing';

// @react-native-google-signin/google-signin uses the web OAuth client ID as
// the audience for the ID token (so the backend can verify it against a
// single audience). The Android OAuth client is selected automatically by
// Google Play Services from the package name + signing certificate, so
// EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID is not passed at runtime — its
// presence in Cloud Console is what makes Android sign-in work.
//
// Skip configure() when there is no web client ID — this happens in CI,
// where the landing screen must still render for the Maestro health flow.
const hasGoogleConfig = Boolean(GOOGLE_WEB_CLIENT_ID);
if (hasGoogleConfig) {
  GoogleSignin.configure({
    webClientId: GOOGLE_WEB_CLIENT_ID,
    iosClientId: GOOGLE_IOS_CLIENT_ID || undefined,
  });
}

// The native Google sign-in module is not available on web; gate the button
// to native platforms so a web build (Expo dev tools, Storybook) doesn't
// throw at import time.
const isGoogleSignInSupported =
  Platform.OS === 'ios' || Platform.OS === 'android';

function GoogleSignInButton() {
  const { setSession } = useAuth();

  const onPress = async () => {
    try {
      if (Platform.OS === 'android') {
        await GoogleSignin.hasPlayServices();
      }
      const response = await GoogleSignin.signIn();
      if (!isSuccessResponse(response)) return;
      const idToken = response.data.idToken;
      if (!idToken) {
        console.error('google sign-in: missing idToken');
        return;
      }
      const session = await exchangeGoogleIdToken(idToken);
      await setSession(session);
    } catch (e) {
      if (isErrorWithCode(e) && e.code === statusCodes.SIGN_IN_CANCELLED) {
        return;
      }
      console.error('google sign-in failed', e);
    }
  };

  return (
    <Pressable
      testID="google-signin-button"
      onPress={onPress}
      style={({ pressed }) => [styles.googleButton, pressed && styles.pressed]}
    >
      <Text style={styles.googleGlyph}>G</Text>
      <Text variant="body" color="primary" style={styles.googleLabel}>
        Google로 시작하기
      </Text>
    </Pressable>
  );
}

// AppleSignInButton renders an ink-filled "Apple로 시작하기" pill that matches
// the M-01 mockup. We render our own button (instead of Apple's branded
// component) so the visual treatment matches Google's button — Apple's HIG
// allows custom buttons as long as the Apple logo and standard wording are
// used. The flow itself still goes through expo-apple-authentication.
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
    <Pressable
      testID="apple-signin-button"
      onPress={onPress}
      style={({ pressed }) => [styles.appleButton, pressed && styles.pressed]}
    >
      <Text style={styles.appleGlyph}></Text>
      <Text variant="body" color="onPrimary" style={styles.appleLabel}>
        Apple로 시작하기
      </Text>
    </Pressable>
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
    (async () => {
      try {
        const res = await fetch(`${API_URL}/health`);
        const json = (await res.json()) as { status: string };
        if (json.status !== 'ok' && !cancelled) setErrorVisible(true);
      } catch (e) {
        console.error('health check failed', e);
        if (!cancelled) setErrorVisible(true);
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
    };
  }, []);

  // Drive the toast fade in/out from a separate effect that depends on
  // errorVisible. Effects run after React commits, so the Animated.View
  // is mounted by the time start() runs and the native driver has a bound
  // view to write opacity/translateY to. Calling start() in the same tick
  // as setErrorVisible(true) — the previous shape — left the native driver
  // without a target view on the first frame and the toast never appeared.
  useEffect(() => {
    if (!errorVisible) return;
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
    const dismissTimer = setTimeout(() => {
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
        if (finished) setErrorVisible(false);
      });
    }, TOAST_VISIBLE_MS);
    return () => clearTimeout(dismissTimer);
  }, [errorVisible, errorOffset, errorOpacity]);

  return (
    <LinearGradient
      colors={[colors.bg.cream, 'rgba(245, 198, 168, 0.4)']}
      style={styles.container}
      testID="root"
    >
      <View style={styles.hero}>
        <Text style={styles.brand}>
          Dear{'\n'}Baby
        </Text>
        <Text style={styles.tagline}>기록을 책으로</Text>
        <Text variant="body" color="secondary" style={styles.subtitle}>
          매일의 작은 마음이{'\n'}사라지지 않도록
        </Text>
      </View>

      <View style={styles.actions}>
        {Platform.OS === 'ios' && <AppleSignInButton />}
        {hasGoogleConfig && isGoogleSignInSupported && <GoogleSignInButton />}
      </View>

      <View style={styles.footer}>
        <Text variant="caption" color="muted" style={styles.footerText}>
          계속하시면 <Text style={styles.footerLink}>이용약관</Text>과{'\n'}
          <Text style={styles.footerLink}>개인정보 처리방침</Text>에 동의합니다
        </Text>
      </View>

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
          accessible
          accessibilityLabel="health check complete"
          pointerEvents="none"
          style={styles.healthSentinel}
        />
      )}
      <StatusBar style="dark" />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing[6],
    paddingTop: 80,
    paddingBottom: spacing[6],
  },
  hero: {
    alignItems: 'center',
    paddingHorizontal: spacing[2],
  },
  // M-01 의 "Dear / Baby" 로고. mockup 의 44px/700 leading-none 그대로.
  brand: {
    fontFamily: fontFamilies.serif,
    fontSize: 44,
    fontWeight: '700',
    lineHeight: 44,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing[2],
  },
  // "기록을 책으로" — mockup 의 손글씨(Nanum Pen Script)를 앱의 감성 세리프
  // (Gowun Batang)로 매핑. 24px coral.
  tagline: {
    fontFamily: fontFamilies.emotion,
    fontSize: 24,
    lineHeight: 32,
    color: colors.primary.coral,
    textAlign: 'center',
  },
  subtitle: {
    textAlign: 'center',
    marginTop: spacing[3],
    maxWidth: 280,
  },
  actions: {
    marginTop: 48,
    gap: spacing[3],
  },
  appleButton: {
    height: 56,
    borderRadius: radius.full,
    backgroundColor: colors.text.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
  },
  appleGlyph: {
    fontSize: 18,
    color: colors.text.onPrimary,
  },
  appleLabel: {
    fontFamily: fontFamilies.sansSemibold,
    fontWeight: '600',
    fontSize: 15,
  },
  googleButton: {
    height: 56,
    borderRadius: radius.full,
    backgroundColor: colors.surface.ivory,
    borderWidth: 1,
    borderColor: colors.bg.beige,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    ...shadows.soft,
  },
  googleGlyph: {
    fontFamily: fontFamilies.sansBold,
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
  },
  googleLabel: {
    fontFamily: fontFamilies.sansSemibold,
    fontWeight: '600',
    fontSize: 15,
  },
  pressed: { opacity: 0.9 },
  footer: {
    marginTop: spacing[6],
    paddingHorizontal: spacing[2],
  },
  footerText: {
    fontSize: 11,
    lineHeight: 18,
    textAlign: 'center',
  },
  footerLink: {
    color: colors.primary.coral,
    textDecorationLine: 'underline',
  },
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
  // Invisible 4×4 sentinel used by Maestro to know the auto-fired health
  // fetch has settled. Sized large enough for Android's UI Automator to
  // include in the accessibility tree (a bare 1×1 View without an
  // accessibility role gets pruned). Tucked into the bottom-right corner
  // so it cannot collide with the toast (which sits at `bottom: spacing[8]`)
  // or the tester corner hit zones (anchored to the top).
  healthSentinel: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 4,
    height: 4,
  },
});
