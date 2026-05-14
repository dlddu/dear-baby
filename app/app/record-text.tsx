// Text record modal — Stage 2 "첫 기록" 경로. 사용자가 텍스트로 짧은 기록을
// 남기고, 저장 시 백엔드가 users.first_record_at 를 스탬프 → 홈 화면의 AI
// 미리보기가 언블러된다 (docs/wireframes/onboarding.md L104-106).
//
// 디자인 시스템 준수: 배경 cream, 입력 surface ivory + radius.md, Primary
// Button, Text variant 토큰, spacing 토큰. 하드코딩된 색/숫자 없음.

import { useLocalSearchParams, useRouter } from 'expo-router';
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
import { RecordChildBanner } from '../src/components/RecordChildBanner';
import { RecordQuestionHeader } from '../src/components/RecordQuestionHeader';
import { Text } from '../src/components/Text';
import { useAuth } from '../src/auth/AuthContext';
import {
  parseChildKindParam,
  parseChildOrdinalParam,
  resolveRecordChildDisplayName,
} from '../src/utils/recordChild';
import { colors } from '../src/theme/colors';
import { radius } from '../src/theme/radius';
import { spacing } from '../src/theme/spacing';
import { typography } from '../src/theme/typography';

const MAX_CONTENT_LENGTH = 2000;

export default function RecordTextScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    question?: string;
    week_label?: string;
    child_kind?: string;
    child_ordinal?: string;
  }>();
  const question = typeof params.question === 'string' ? params.question : '';
  const weekLabel =
    typeof params.week_label === 'string' && params.week_label.length > 0
      ? params.week_label
      : null;
  const childKind = parseChildKindParam(params.child_kind);
  const childOrdinal = parseChildOrdinalParam(params.child_ordinal);

  const { user, createTextRecord } = useAuth();
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);

  const trimmed = useMemo(() => content.trim(), [content]);
  const childDisplayName = useMemo(
    () => resolveRecordChildDisplayName(user, childKind, childOrdinal),
    [user, childKind, childOrdinal],
  );
  const canSave =
    trimmed.length > 0 && !saving && childKind !== null && childOrdinal !== null;

  const handleCancel = useCallback(() => {
    router.back();
  }, [router]);

  const handleSave = useCallback(async () => {
    if (!canSave || childKind === null || childOrdinal === null) return;
    setSaving(true);
    try {
      await createTextRecord(
        trimmed,
        question || undefined,
        childKind,
        childOrdinal,
      );
      router.back();
    } catch {
      Alert.alert('저장에 실패했어요', '잠시 후 다시 시도해주세요.');
    } finally {
      setSaving(false);
    }
  }, [canSave, trimmed, createTextRecord, router, question, childKind, childOrdinal]);

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
          {childDisplayName ? (
            <RecordChildBanner
              displayName={childDisplayName}
              testID="record-text-child-banner"
            />
          ) : null}
          <RecordQuestionHeader
            question={question}
            weekLabel={weekLabel}
            testID="record-text-question-header"
          />

          <View style={styles.inputWrap}>
            <TextInput
              value={content}
              onChangeText={setContent}
              multiline
              autoFocus
              placeholder="마음 가는 대로 적어보세요"
              placeholderTextColor={colors.text.muted}
              maxLength={MAX_CONTENT_LENGTH}
              style={styles.input}
              testID="record-text-input"
            />
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Button
            title={saving ? '저장 중…' : '저장'}
            variant="primary"
            fullWidth
            disabled={!canSave}
            onPress={handleSave}
            testID="record-text-save"
          />
        </View>
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
    paddingBottom: spacing[5],
    gap: spacing[4],
  },
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
  footer: {
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[5],
  },
});
