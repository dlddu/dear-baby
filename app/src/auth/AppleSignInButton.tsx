// Sign in with Apple button — iOS only.
//
// Apple's HIG requires the native AppleAuthenticationButton style; we render
// it whenever the device reports support and silently skip otherwise. The
// callback hands the identity token to the backend via /auth/apple, which
// verifies it against Apple's JWKS and issues our own access/refresh pair.
//
// Apple only delivers the user's full name on the very first sign-in
// (via the authorization response, never inside the JWT). We forward
// whatever we receive so the backend can persist it on the new user
// row; subsequent sign-ins pass an empty name and the backend keeps the
// stored value.

import * as AppleAuthentication from 'expo-apple-authentication';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet } from 'react-native';

import { exchangeAppleIdentityToken } from '../api/auth';
import { radius } from '../theme/radius';
import { useAuth } from './AuthContext';

export function AppleSignInButton() {
  const { setSession } = useAuth();
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (Platform.OS !== 'ios') {
      return;
    }
    AppleAuthentication.isAvailableAsync()
      .then((ok) => {
        if (!cancelled) setSupported(ok);
      })
      .catch(() => {
        if (!cancelled) setSupported(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (Platform.OS !== 'ios' || !supported) {
    return null;
  }

  return (
    <AppleAuthentication.AppleAuthenticationButton
      buttonType={
        AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN
      }
      buttonStyle={
        AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
      }
      cornerRadius={radius.sm}
      style={styles.button}
      onPress={async () => {
        try {
          const credential = await AppleAuthentication.signInAsync({
            requestedScopes: [
              AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
              AppleAuthentication.AppleAuthenticationScope.EMAIL,
            ],
          });
          const idToken = credential.identityToken;
          if (!idToken) {
            console.warn('apple sign-in: missing identityToken');
            return;
          }
          // fullName is only present on the FIRST authorization — Apple
          // omits it on every subsequent sign-in for the same user. We
          // join given+family with a single space so the backend stores
          // a sensible display name; if both are missing the empty
          // string tells the backend to leave any prior name untouched.
          const fullName = credential.fullName;
          const name = [fullName?.givenName, fullName?.familyName]
            .filter(Boolean)
            .join(' ')
            .trim();
          const session = await exchangeAppleIdentityToken(idToken, name);
          await setSession(session);
        } catch (e: unknown) {
          // Apple throws { code: 'ERR_REQUEST_CANCELED' } when the user
          // dismisses the sheet — that's not an error worth logging.
          if (
            typeof e === 'object' &&
            e !== null &&
            'code' in e &&
            (e as { code: string }).code === 'ERR_REQUEST_CANCELED'
          ) {
            return;
          }
          console.error('apple sign-in failed', e);
        }
      }}
    />
  );
}

const styles = StyleSheet.create({
  // Match the height of the Google button so the two CTAs align in the
  // landing screen stack. Width is driven by the parent (alignSelf:
  // 'stretch') for the same reason.
  button: {
    alignSelf: 'stretch',
    height: 52,
  },
});
