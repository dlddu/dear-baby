import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { passwordLogin } from '../api/auth';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Text } from '../components/Text';
import { colors } from '../theme/colors';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';

import { useAuth } from './AuthContext';

export type TesterLoginModalProps = {
  visible: boolean;
  onClose: () => void;
};

// TesterLoginModal is the password-based login surface that the secret
// tap pattern unlocks. It posts to /auth/password-login and feeds the
// resulting session into AuthContext exactly like the OAuth buttons.
// The modal is mounted in production builds — gating happens via the
// gesture, not a build flag.
export function TesterLoginModal({ visible, onClose }: TesterLoginModalProps) {
  const { setSession } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const session = await passwordLogin({ email: email.trim(), password });
      await setSession(session);
      setEmail('');
      setPassword('');
      onClose();
    } catch (e) {
      console.error('tester login failed', e);
      setError('로그인에 실패했어요. 이메일과 비밀번호를 확인해주세요.');
    } finally {
      setSubmitting(false);
    }
  };

  const close = () => {
    if (submitting) return;
    setError(null);
    setEmail('');
    setPassword('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={close}
      testID="tester-login-modal"
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={styles.backdrop} onPress={close} />
        <Card style={styles.card} padding="lg">
          <Text variant="h2" color="primary" style={styles.title}>
            테스터 로그인
          </Text>
          <Text variant="caption" color="secondary" style={styles.subtitle}>
            App Store 리뷰 및 내부 테스트용 계정으로 로그인합니다.
          </Text>

          <Text variant="caption" color="secondary" style={styles.label}>
            이메일
          </Text>
          <TextInput
            testID="tester-login-email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            placeholder="tester@dear-baby.app"
            placeholderTextColor={colors.text.muted}
            style={styles.input}
          />

          <Text variant="caption" color="secondary" style={styles.label}>
            비밀번호
          </Text>
          <TextInput
            testID="tester-login-password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="••••••••"
            placeholderTextColor={colors.text.muted}
            style={styles.input}
          />

          {error && (
            <Text
              variant="caption"
              color="coral"
              style={styles.error}
              testID="tester-login-error"
            >
              {error}
            </Text>
          )}

          <View style={styles.actions}>
            <Pressable
              testID="tester-login-cancel"
              onPress={close}
              style={({ pressed }) => [
                styles.cancelButton,
                pressed && styles.pressed,
              ]}
            >
              <Text variant="body" color="secondary" style={styles.cancelLabel}>
                취소
              </Text>
            </Pressable>
            <View style={styles.submitWrapper}>
              <Button
                testID="tester-login-submit"
                title={submitting ? '로그인 중…' : '로그인'}
                variant="primary"
                onPress={submit}
                fullWidth
                disabled={
                  submitting ||
                  email.trim().length === 0 ||
                  password.length === 0
                }
              />
            </View>
          </View>
        </Card>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing[6],
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.shadow,
    opacity: 0.4,
  },
  card: {
    gap: spacing[3],
  },
  title: {
    textAlign: 'center',
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: spacing[2],
  },
  label: {
    marginTop: spacing[2],
  },
  input: {
    borderWidth: 1,
    borderColor: colors.bg.beige,
    backgroundColor: colors.bg.cream,
    borderRadius: radius.sm,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    color: colors.text.primary,
    fontSize: 15,
  },
  error: {
    marginTop: spacing[1],
  },
  actions: {
    flexDirection: 'row',
    gap: spacing[3],
    marginTop: spacing[4],
  },
  cancelButton: {
    flex: 1,
    borderRadius: radius.sm,
    paddingVertical: 14,
    paddingHorizontal: spacing[5],
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.bg.beige,
    backgroundColor: colors.bg.cream,
  },
  cancelLabel: {
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.85,
  },
  submitWrapper: {
    flex: 1,
  },
});
