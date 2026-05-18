// 일기 탭 — 기록 편집 (M-40). 본문 textarea + 취소/저장 두 액션.
//
// 변경 가능 범위:
//   - 본문(content) — PATCH /records/{id} 의 content 필드
//
// 변경 불가 (UI 에서는 회색 톤으로 락 표시): 작성일·질문·아이 컨텍스트·음성
// 원본 (M-40 의 잠금 영역). PRD-008 AC-008-05 명세대로 시간 축 보존.
//
// 미디어 추가/제거는 PRD-005 의 소관 — 본 화면은 자리만 잡지 않고 본문
// 편집만 지원한다 (mockup 의 미디어 그리드는 PRD-005 에서 채움).
//
// iOS 스와이프 백: CLAUDE.md 규칙. 저장은 명시 액션이고, 핸들러는 본문을
// 서버에 영속화하기만 하므로 (다른 상태 갱신 없음) 스와이프 백 시에도
// 일관성이 깨지지 않는다.

import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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

import { getRecord, updateRecordContent } from '../../../src/api/records';
import type { Record } from '../../../src/api/types';
import { useAuth } from '../../../src/auth/AuthContext';
import { ChildContextChip } from '../../../src/components/diary/ChildContextChip';
import {
  describeSubject,
  formatDetailDate,
} from '../../../src/components/diary/subjectLookup';
import { Text } from '../../../src/components/Text';
import { colors } from '../../../src/theme/colors';
import { radius } from '../../../src/theme/radius';
import { shadows } from '../../../src/theme/shadows';
import { spacing } from '../../../src/theme/spacing';
import { typography } from '../../../src/theme/typography';

const MAX_CONTENT_LENGTH = 2000;

export default function DiaryEditScreen() {
  const router = useRouter();
  const { id: rawId } = useLocalSearchParams<{ id: string }>();
  const id = typeof rawId === 'string' ? rawId : '';
  const { user } = useAuth();

  const [record, setRecord] = useState<Record | null>(null);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      void getRecord(id)
        .then((r) => {
          if (cancelled) return;
          setRecord(r);
          setContent(r.content);
        })
        .catch(() => {
          if (!cancelled) setRecord(null);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }, [id]),
  );

  const trimmed = useMemo(() => content.trim(), [content]);
  const dirty = record != null && trimmed !== record.content.trim();
  const canSave = trimmed.length > 0 && dirty && !saving;

  const handleCancel = useCallback(() => {
    router.back();
  }, [router]);

  const handleSave = useCallback(async () => {
    if (!record || !canSave) return;
    setSaving(true);
    try {
      await updateRecordContent(record.id, trimmed);
      router.back();
    } catch {
      Alert.alert('저장에 실패했어요', '잠시 후 다시 시도해주세요.');
    } finally {
      setSaving(false);
    }
  }, [record, trimmed, canSave, router]);

  if (loading && !record) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary.coral} />
        </View>
      </SafeAreaView>
    );
  }
  if (!record) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <TopBar
          onCancel={handleCancel}
          onSave={() => {}}
          saveLabel="저장"
          canSave={false}
        />
        <View style={styles.notFound}>
          <Text variant="body" color="muted">
            기록을 찾을 수 없어요.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const subj = describeSubject(user, record.subject_id, record.created_at);

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']} testID="diary-edit">
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TopBar
          onCancel={handleCancel}
          onSave={handleSave}
          saveLabel={saving ? '저장 중…' : '저장'}
          canSave={canSave}
        />
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.metaBlock}>
            <View style={styles.metaRow}>
              <Text variant="h3" color="secondary">
                {formatDetailDate(record.created_at)}
              </Text>
              <Text variant="micro" color="muted">
                🔒 변경 불가
              </Text>
            </View>
            <ChildContextChip
              emoji={subj.emoji}
              name={subj.name}
              contextLabel={subj.contextLabel}
            />
            <Text variant="micro" color="muted">
              작성일 · 질문 · 아이 컨텍스트 · 음성 원본은 시간 축 보존을 위해
              편집할 수 없어요
            </Text>
          </View>

          {record.question_text ? (
            <View style={styles.quote}>
              <Text variant="micro" color="muted">
                Q. {subj.name}가 엄마에게 🔒
              </Text>
              <Text variant="body" color="secondary" style={styles.quoteText}>
                {record.question_text}
              </Text>
            </View>
          ) : null}

          {record.audio_s3_key ? (
            <View style={styles.audioLock}>
              <Text variant="micro" color="secondary">
                🎙️ 음성 원본 · 변경 불가
              </Text>
            </View>
          ) : null}

          <View style={styles.inputBlock}>
            <View style={styles.inputHeader}>
              <Text variant="micro" color="secondary" style={styles.aLabel}>
                A. 답변 본문
              </Text>
              <Text variant="micro" color="muted" style={styles.charCount}>
                {trimmed.length} 자
              </Text>
            </View>
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
                testID="diary-edit-input"
              />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function TopBar({
  onCancel,
  onSave,
  saveLabel,
  canSave,
}: {
  onCancel: () => void;
  onSave: () => void;
  saveLabel: string;
  canSave: boolean;
}) {
  return (
    <View style={styles.topBar}>
      <Pressable
        onPress={onCancel}
        accessibilityRole="button"
        hitSlop={8}
        testID="diary-edit-cancel"
      >
        <Text variant="body" color="secondary">
          취소
        </Text>
      </Pressable>
      <Text variant="h3" color="primary">
        기록 편집
      </Text>
      <Pressable
        onPress={onSave}
        accessibilityRole="button"
        hitSlop={8}
        disabled={!canSave}
        testID="diary-edit-save"
        style={!canSave && styles.disabledAction}
      >
        <Text
          variant="body"
          color={canSave ? 'coral' : 'muted'}
          style={styles.saveText}
        >
          {saveLabel}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg.cream },
  flex: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  notFound: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.bg.beige,
  },
  saveText: { fontWeight: '700' },
  disabledAction: { opacity: 0.6 },
  container: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
    paddingBottom: spacing[8],
    gap: spacing[4],
  },
  metaBlock: {
    backgroundColor: colors.bg.beige + '33', // 20% alpha
    borderRadius: radius.md,
    padding: spacing[3],
    gap: spacing[2],
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  quote: {
    borderLeftWidth: 2,
    borderLeftColor: colors.bg.beige,
    paddingLeft: spacing[3],
    gap: spacing[1],
  },
  quoteText: { lineHeight: 22 },
  audioLock: {
    backgroundColor: colors.bg.beige + '4D',
    borderRadius: radius.sm,
    padding: spacing[2],
  },
  inputBlock: { gap: spacing[2] },
  inputHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  aLabel: { fontWeight: '600' },
  charCount: { fontVariant: ['tabular-nums'] },
  inputWrap: {
    backgroundColor: colors.surface.ivory,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary.coral + '66',
    padding: spacing[3],
    minHeight: 220,
    ...shadows.soft,
  },
  input: {
    ...typography.body,
    color: colors.text.primary,
    textAlignVertical: 'top',
    minHeight: 200,
  },
});
