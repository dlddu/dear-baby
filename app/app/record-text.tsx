// Text record modal — Stage 2 "첫 기록" 경로. 사용자가 텍스트로 짧은 기록을
// 남기고, 저장 시 백엔드가 users.first_record_at 를 스탬프 → 홈 화면의 AI
// 미리보기가 언블러된다 (docs/design-system/onboarding.md L104-106).
//
// 디자인 시스템 준수: 배경 cream, 입력 surface ivory + radius.md, Primary
// Button, Text variant 토큰, spacing 토큰. 하드코딩된 색/숫자 없음.

import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../src/components/Button';
import { Text } from '../src/components/Text';
import { useAuth } from '../src/auth/AuthContext';
import { colors } from '../src/theme/colors';
import { radius } from '../src/theme/radius';
import { spacing } from '../src/theme/spacing';
import { typography } from '../src/theme/typography';

const MAX_CONTENT_LENGTH = 2000;

export default function RecordTextScreen() {
  const router = useRouter();
  const { createTextRecord } = useAuth();
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);

  const trimmed = useMemo(() => content.trim(), [content]);
  const canSave = trimmed.length > 0 && !saving;

  const handleCancel = useCallback(() => {
    router.back();
  }, [router]);

  const handleSave = useCallback(async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      await createTextRecord(trimmed);
      router.back();
    } catch {
      Alert.alert('저장에 실패했어요', '잠시 후 다시 시도해주세요.');
    } finally {
      setSaving(false);
    }
  }, [canSave, trimmed, createTextRecord, router]);

  return (
    <SafeAreaView
      style={styles.safe}
      edges={['top', 'bottom']}
      testID="record-text-screen"
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.topbar}>
          <Pressable
            accessibilityRole="button"
            onPress={handleCancel}
            hitSlop={8}
            testID="record-text-cancel"
          >
            <Text variant="body" color="secondary">
              취소
            </Text>
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          <Text variant="h2" color="primary" style={styles.title}>
            오늘의 기록
          </Text>
          <Text variant="emotion" color="secondary" style={styles.subtitle}>
            아기에게 전하고 싶은 말을 남겨보세요 🌷
          </Text>

          <View style={styles.inputWrap}>
            <TextInput
              value={content}
              onChangeText={setContent}
              multiline
              autoFocus
              placeholder="오늘 아기에게 가장 해주고 싶은 말은?"
              placeholderTextColor={colors.text.muted}
              maxLength={MAX_CONTENT_LENGTH}
              style={styles.input}
              testID="record-text-input"
            />
          </View>

          <Button
            title={saving ? '저장 중…' : '저장'}
            variant="primary"
            fullWidth
            disabled={!canSave}
            onPress={handleSave}
            testID="record-text-save"
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.cream },
  flex: { flex: 1 },
  topbar: {
    flexDirection: 'row',
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[3],
  },
  container: {
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[8],
    gap: spacing[4],
  },
  title: { marginTop: spacing[2] },
  subtitle: { marginBottom: spacing[2] },
  inputWrap: {
    backgroundColor: colors.surface.ivory,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.bg.beige,
    padding: spacing[4],
    minHeight: 200,
  },
  input: {
    ...typography.body,
    color: colors.text.primary,
    textAlignVertical: 'top',
    minHeight: 180,
  },
});
