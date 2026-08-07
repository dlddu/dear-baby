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
import { RecordQuestionHeader } from '../src/components/RecordQuestionHeader';
import { Text } from '../src/components/Text';
import { VisibilityToggle } from '../src/components/VisibilityToggle';
import type { RecordVisibility } from '../src/api/types';
import { useAuth } from '../src/auth/AuthContext';
import { useActiveChild } from '../src/context/ActiveChildContext';
import { colors } from '../src/theme/colors';
import { radius } from '../src/theme/radius';
import { spacing } from '../src/theme/spacing';
import { typography } from '../src/theme/typography';

const MAX_CONTENT_LENGTH = 2000;

export default function RecordTextScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ question?: string; week_label?: string }>();
  const question = typeof params.question === 'string' ? params.question : '';
  const weekLabel =
    typeof params.week_label === 'string' && params.week_label.length > 0
      ? params.week_label
      : null;

  const { createTextRecord } = useAuth();
  const { activeChild } = useActiveChild();
  const [content, setContent] = useState('');
  // AC-001-06 — 저장 시점 공개 여부. 기본값은 비공개(사용자 신뢰 우선,
  // 서버 기본값과 동일). 공개를 고른 기록만 커뮤니티(PRD-009)로 이어진다.
  const [visibility, setVisibility] = useState<RecordVisibility>('private');
  const [saving, setSaving] = useState(false);

  const trimmed = useMemo(() => content.trim(), [content]);
  const canSave = trimmed.length > 0 && !saving;

  const handleCancel = useCallback(() => {
    router.back();
  }, [router]);

  const handleSave = useCallback(async () => {
    if (!canSave) return;
    if (!activeChild) {
      // 정상 흐름에서는 도달 불가 — 홈에 도착했다는 것 자체가 활성 아이가
      // 있다는 뜻 (Onboarding 가드). 다만 컴파일 타임에 nullable 이라
      // 마지막 안전망을 둔다.
      Alert.alert('저장할 수 없어요', '활성 아이가 설정되지 않았습니다.');
      return;
    }
    setSaving(true);
    try {
      await createTextRecord(trimmed, {
        subjectId: activeChild.subjectId,
        questionText: question || undefined,
        visibility,
      });
      router.back();
    } catch {
      Alert.alert('저장에 실패했어요', '잠시 후 다시 시도해주세요.');
    } finally {
      setSaving(false);
    }
  }, [canSave, trimmed, createTextRecord, router, question, activeChild, visibility]);

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
          <VisibilityToggle
            value={visibility}
            onChange={setVisibility}
            disabled={saving}
            testID="record-text-visibility"
          />
          <View style={{ height: spacing[3] }} />
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
