// 변환·편집 화면 — 녹음이 끝난 직후 진입한다. 진입과 동시에 디바이스
// 사이드 STT(whisper.rn)를 실행하고, 결과가 도착하면 편집 가능한
// multiline 입력에 채운다. 하단에는 세 개의 액션이 있다:
//
//   - [저장]                : 텍스트만 서버에, 오디오는 보관함으로
//   - [저장 후 음성 원본 업로드] : 위 + S3 업로드 즉시 실행
//   - [취소]                : 모두 폐기
//
// 저장 후 업로드 흐름의 ③·④ 단계가 실패해도 텍스트는 이미 서버에
// 안전하게 도착한 상태이므로, 사용자가 보관함에서 [업로드] 재시도할
// 수 있도록 LocalAudio 만 'failed' 상태로 남긴다.

import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import * as FileSystem from 'expo-file-system/legacy';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../src/components/Button';
import { RecordQuestionHeader } from '../src/components/RecordQuestionHeader';
import { Text } from '../src/components/Text';
import { useAuth } from '../src/auth/AuthContext';
import * as draftStore from '../src/drafts/draftStore';
import { colors } from '../src/theme/colors';
import { radius } from '../src/theme/radius';
import { spacing } from '../src/theme/spacing';
import { typography } from '../src/theme/typography';
import { uploadAudio } from '../src/voice/uploadAudio';
import { transcribe } from '../src/voice/whisperEngine';

const MAX_CONTENT_LENGTH = 2000;

type Phase = 'transcribing' | 'editing' | 'saving' | 'saving_and_uploading';

export default function RecordAudioReviewScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    audio_path?: string;
    audio_duration_ms?: string;
    question?: string;
    week_label?: string;
  }>();
  const audioPath = typeof params.audio_path === 'string' ? params.audio_path : '';
  const audioDurationMs = Number(params.audio_duration_ms ?? '0') || 0;
  const question = typeof params.question === 'string' ? params.question : '';
  const weekLabel =
    typeof params.week_label === 'string' && params.week_label.length > 0
      ? params.week_label
      : null;

  const { createVoiceRecord } = useAuth();
  const [content, setContent] = useState('');
  const [phase, setPhase] = useState<Phase>('transcribing');
  const [transcribeError, setTranscribeError] = useState<string | null>(null);
  // disposed prevents the cleanup effect from deleting the audio when
  // the user has explicitly chosen to keep it (Save / Save+Upload).
  const consumedRef = useRef(false);

  const trimmed = useMemo(() => content.trim(), [content]);
  const canSave = trimmed.length > 0 && phase === 'editing';

  const uploadButtonTitle =
    phase === 'saving_and_uploading' ? '업로드 중…' : '저장 후 음성 원본 업로드';
  const saveButtonTitle = phase === 'saving' ? '저장 중…' : '저장';

  // STT — runs once on mount. We don't expose a re-run button: if the
  // user wants to re-transcribe they go back and re-record. The
  // transcript is editable so small corrections happen in-place.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!audioPath) {
        if (!cancelled) setTranscribeError('녹음 파일을 찾지 못했어요.');
        return;
      }
      try {
        const text = await transcribe(audioPath);
        if (cancelled) return;
        setContent(text);
        setPhase('editing');
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : '음성 변환에 실패했어요.';
        setTranscribeError(msg);
        // Even on STT failure we let the user edit — they can type
        // the transcript by hand and still keep the audio for later.
        setPhase('editing');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [audioPath]);

  // Cleanup: if the user backed out (cancel / hardware back) without
  // saving, delete the temp audio so it doesn't pile up in cache.
  useEffect(
    () => () => {
      if (!consumedRef.current && audioPath) {
        void FileSystem.deleteAsync(audioPath, { idempotent: true });
      }
    },
    [audioPath],
  );

  const persistDraftOnSuccess = useCallback(
    async (recordID: string, createdAt: string) => {
      consumedRef.current = true;
      await draftStore.create({
        record_id: recordID,
        created_at: createdAt,
        tempAudioPath: audioPath,
        audio_duration_ms: audioDurationMs,
        transcript_preview: trimmed,
      });
    },
    [audioDurationMs, audioPath, trimmed],
  );

  const handleSave = useCallback(async () => {
    if (!canSave) return;
    setPhase('saving');
    try {
      const record = await createVoiceRecord(trimmed, question || undefined);
      await persistDraftOnSuccess(record.id, record.created_at);
      router.replace('/(tabs)');
    } catch (err) {
      console.error('record save failed', err);
      Alert.alert('저장에 실패했어요', '잠시 후 다시 시도해 주세요.');
      setPhase('editing');
    }
  }, [canSave, createVoiceRecord, persistDraftOnSuccess, router, trimmed, question]);

  const handleSaveAndUpload = useCallback(async () => {
    if (!canSave) return;
    setPhase('saving_and_uploading');
    try {
      const record = await createVoiceRecord(trimmed, question || undefined);
      await persistDraftOnSuccess(record.id, record.created_at);
      // Fire the upload — uploadAudio handles its own errors and
      // marks the LocalAudio as 'failed' on the way out, so we don't
      // need to surface the result here. The home screen will show
      // the boy's drafts banner if the upload didn't clear the row.
      const result = await uploadAudio(record.id);
      if (result.status === 'failed') {
        Alert.alert(
          '음성 원본 업로드를 마치지 못했어요',
          '텍스트는 안전하게 저장됐어요. 보관함에서 다시 시도해 주세요.',
        );
      }
      router.replace('/(tabs)');
    } catch (err) {
      console.error('record save+upload failed', err);
      Alert.alert('저장에 실패했어요', '잠시 후 다시 시도해 주세요.');
      setPhase('editing');
    }
  }, [canSave, createVoiceRecord, persistDraftOnSuccess, router, trimmed, question]);

  const handleCancel = useCallback(() => {
    router.back();
  }, [router]);

  return (
    <SafeAreaView
      style={styles.safe}
      edges={['top', 'bottom']}
      testID="record-audio-review-screen"
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
            testID="record-audio-review-cancel"
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
            testID="record-audio-review-question-header"
          />
          <Text variant="h2" color="primary" style={styles.title}>
            방금 들려주신 말이에요
          </Text>
          <Text variant="emotion" color="secondary" style={styles.subtitle}>
            정리한 글을 살펴보고, 손보고 싶은 부분이 있으면 살짝 다듬어주세요.
          </Text>

          {phase === 'transcribing' ? (
            <View style={styles.loading} testID="record-audio-review-loading">
              <ActivityIndicator color={colors.primary.coral} />
              <Text variant="caption" color="muted" style={styles.loadingText}>
                음성을 정리하는 중이에요…
              </Text>
            </View>
          ) : (
            <View style={styles.inputWrap}>
              <TextInput
                value={content}
                onChangeText={setContent}
                multiline
                placeholder="여기에 입력해도 괜찮아요"
                placeholderTextColor={colors.text.muted}
                maxLength={MAX_CONTENT_LENGTH}
                style={styles.input}
                testID="record-audio-review-input"
                editable={phase === 'editing'}
              />
            </View>
          )}

          {transcribeError ? (
            <Text
              variant="caption"
              color="muted"
              testID="record-audio-review-stt-error"
            >
              자동 변환에 실패했어요. 직접 입력해주셔도 괜찮아요.
            </Text>
          ) : null}
        </ScrollView>

        <View style={styles.footer}>
          <Button
            title={uploadButtonTitle}
            leading="☁️"
            variant="primary"
            fullWidth
            disabled={!canSave}
            onPress={handleSaveAndUpload}
            testID="record-audio-review-save-and-upload"
          />
          <View style={{ height: spacing[2] }} />
          <Button
            title={saveButtonTitle}
            leading="📓"
            variant="secondary"
            fullWidth
            disabled={!canSave}
            onPress={handleSave}
            testID="record-audio-review-save"
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
    paddingBottom: spacing[6],
    gap: spacing[4],
  },
  title: { marginTop: spacing[2] },
  subtitle: { marginBottom: spacing[2] },
  loading: {
    alignItems: 'center',
    paddingVertical: spacing[8],
    gap: spacing[3],
  },
  loadingText: { textAlign: 'center' },
  inputWrap: {
    backgroundColor: colors.surface.ivory,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.bg.beige,
    padding: spacing[4],
    minHeight: 220,
  },
  input: {
    ...typography.body,
    color: colors.text.primary,
    textAlignVertical: 'top',
    minHeight: 200,
  },
  footer: {
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[5],
  },
});
