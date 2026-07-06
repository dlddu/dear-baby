import { useCallback, useState } from 'react';
import { Alert, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../../src/components/Button';
import { Text } from '../../src/components/Text';
import { useAuth } from '../../src/auth/AuthContext';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
// TEMPORARY — remove with the debug block below once source-map
// symbolication is confirmed on a release build.
import {
  triggerUncaughtException,
  triggerUnhandledRejection,
  triggerConsoleError,
} from '../../src/debug/testError';

export default function SettingsTab() {
  const { user, signOut } = useAuth();
  // signingOut drives the button's disabled + "로그아웃 중…" state so a slow
  // sign-out (SecureStore write) can't be double-tapped and gives feedback.
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = useCallback(() => {
    if (signingOut) return;
    // Confirm first — a single stray tap shouldn't end the session.
    Alert.alert('로그아웃', '정말 로그아웃할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '로그아웃',
        style: 'destructive',
        onPress: async () => {
          setSigningOut(true);
          try {
            await signOut();
            // On success AuthGate replaces to the landing screen and this
            // component unmounts, so we deliberately don't reset signingOut
            // here (that would setState after unmount).
          } catch (e) {
            console.error('[settings] sign out failed', e);
            setSigningOut(false);
            Alert.alert('로그아웃하지 못했어요', '잠시 후 다시 시도해주세요.');
          }
        },
      },
    ]);
  }, [signOut, signingOut]);

  return (
    <SafeAreaView style={styles.container} edges={['top']} testID="settings-tab">
      <Text variant="h2" color="primary">
        설정
      </Text>
      {user && (
        <Text variant="body" color="secondary">
          {user.email}
        </Text>
      )}
      <Button
        title={signingOut ? '로그아웃 중…' : '로그아웃'}
        variant="secondary"
        onPress={handleSignOut}
        disabled={signingOut}
        testID="sign-out-button"
        fullWidth
      />

      {/*
        TEMPORARY debug block — PostHog error-tracking / source-map check.
        Fires a distinctive SourceMapCanaryError through each autocapture path
        so you can confirm it lands in PostHog and, on a release build, that the
        stack trace symbolicates back to src/debug/testError.ts.
        Remove this block and src/debug/testError.ts once verified.
      */}
      <Text variant="body" color="secondary">
        디버그 · 에러 트래킹 테스트
      </Text>
      <Button
        title="테스트 에러 (uncaught)"
        variant="secondary"
        onPress={triggerUncaughtException}
        testID="debug-throw-uncaught"
        fullWidth
      />
      <Button
        title="테스트 에러 (promise rejection)"
        variant="secondary"
        onPress={triggerUnhandledRejection}
        testID="debug-throw-rejection"
        fullWidth
      />
      <Button
        title="테스트 에러 (console.error)"
        variant="secondary"
        onPress={triggerConsoleError}
        testID="debug-throw-console"
        fullWidth
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.cream,
    paddingHorizontal: spacing[5],
    paddingTop: spacing[6],
    gap: spacing[4],
  },
});
