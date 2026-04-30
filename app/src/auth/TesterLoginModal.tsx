// TesterLoginModal surfaces the QA-only test login fixtures behind a
// hidden gesture (see useTesterGesture). It hits POST /auth/test-login,
// which is only mounted on the backend when TEST_AUTH_ENABLED=true; in
// production builds the call returns 404 and the modal surfaces an
// error inline so QA can tell whether they're running an internal
// build by accident.

import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { testLogin } from '../api/auth';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Text } from '../components/Text';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { useAuth } from './AuthContext';

// Fixtures mirror the personas seeded by `make seed-test-users`. Keeping
// the email strings in a single shared list makes it harder for QA and
// the seed script to drift out of sync.
const FIXTURES: ReadonlyArray<{
  label: string;
  caption: string;
  email: string;
  onboarded: boolean;
}> = [
  {
    label: '온보딩 테스터',
    caption: '온보딩 화면부터 다시 진행',
    email: 'tester-onboarding@dear-baby.test',
    onboarded: false,
  },
  {
    label: '기록 테스터',
    caption: '온보딩 완료 상태로 홈 진입',
    email: 'tester-onboarded@dear-baby.test',
    onboarded: true,
  },
  {
    label: 'QA 테스터',
    caption: 'due 2026-12-25, 온보딩 완료',
    email: 'tester-qa@dear-baby.test',
    onboarded: true,
  },
];

export type TesterLoginModalProps = {
  visible: boolean;
  onClose: () => void;
};

export function TesterLoginModal({ visible, onClose }: TesterLoginModalProps) {
  const { setSession } = useAuth();
  const [busyEmail, setBusyEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handlePick = async (email: string, onboarded: boolean) => {
    setBusyEmail(email);
    setError(null);
    try {
      const session = await testLogin({ email, onboarded });
      await setSession(session);
      onClose();
    } catch (e) {
      console.error('tester login failed', e);
      setError('로그인 실패. 백엔드의 TEST_AUTH_ENABLED를 확인하세요.');
    } finally {
      setBusyEmail(null);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        style={styles.backdrop}
        accessibilityRole="button"
        accessibilityLabel="닫기"
        onPress={() => {
          if (busyEmail === null) onClose();
        }}
      >
        {/* Stop-propagation Pressable so taps inside the card don't dismiss. */}
        <Pressable onPress={() => {}} style={styles.cardWrap}>
          <Card padding="lg" style={styles.card}>
            <Text variant="h3" color="primary" style={styles.title}>
              테스터 로그인
            </Text>
            <Text variant="caption" color="secondary" style={styles.subtitle}>
              QA 시드 계정으로 즉시 로그인합니다.
            </Text>
            <View style={styles.list}>
              {FIXTURES.map((fx) => (
                <View key={fx.email} style={styles.row}>
                  <Button
                    title={busyEmail === fx.email ? '로그인 중…' : fx.label}
                    variant="primary"
                    fullWidth
                    disabled={busyEmail !== null}
                    onPress={() => handlePick(fx.email, fx.onboarded)}
                    testID={`tester-login-${fx.email}`}
                  />
                  <Text
                    variant="caption"
                    color="muted"
                    style={styles.caption}
                  >
                    {fx.caption}
                  </Text>
                </View>
              ))}
            </View>
            {error !== null && (
              <Text variant="caption" color="coral" style={styles.error}>
                {error}
              </Text>
            )}
            <Button
              title="닫기"
              variant="secondary"
              fullWidth
              disabled={busyEmail !== null}
              onPress={onClose}
              testID="tester-login-close"
            />
          </Card>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(61, 46, 30, 0.45)',
    justifyContent: 'center',
    paddingHorizontal: spacing[6],
  },
  cardWrap: {
    width: '100%',
  },
  card: {
    backgroundColor: colors.surface.ivory,
    gap: spacing[4],
  },
  title: { textAlign: 'center' },
  subtitle: { textAlign: 'center' },
  list: { gap: spacing[3] },
  row: { gap: spacing[1] },
  caption: { textAlign: 'center' },
  error: { textAlign: 'center' },
});
