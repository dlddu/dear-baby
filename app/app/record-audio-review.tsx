// Record-audio-review screen — Stage 2 음성 기록의 변환·편집·저장.
//
// 진입 시 자동으로 STT 를 실행 (whisperEngine.transcribe). 결과가
// 채워지면 사용자가 편집 가능한 multiline 입력에 표시. 하단에 액션 3개:
//
//  - "저장": POST /records (source=voice) 만 수행. record_id 받으면
//    오디오 파일을 보관함으로 옮기고 홈으로 복귀. 이 경로에서는 보관함에
//    LocalAudio 가 추가되어 사용자가 나중에 업로드를 결정할 수 있다.
//  - "저장 후 음성 원본 업로드": 위 저장 흐름 + 즉시 uploadAudio 호출.
//    성공 시 보관함은 비어 있고 서버에는 텍스트 + 오디오 모두 도달한다.
//    실패 시 보관함의 LocalAudio 는 'failed' 로 남는다.
//  - "취소": 임시 오디오/transcript 모두 폐기.
//
// 디자인 시스템 준수: 입력은 ivory + radius.md + beige 보더 (텍스트
// 화면과 동일). 두 저장 버튼은 primary/secondary 변형으로 위계.

import * as FileSystem from 'expo-file-system/legacy';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
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

import { createVoiceRecord } from '../src/api/records';
import { useAuth } from '../src/auth/AuthContext';
import { Button } from '../src/components/Button';
import { Text } from '../src/components/Text';
import * as draftStore from '../src/drafts/draftStore';
import { colors } from '../src/theme/colors';
import { radius } from '../src/theme/radius';
import { spacing } from '../src/theme/spacing';
import { typography } from '../src/theme/typography';
import { uploadAudio } from '../src/voice/uploadAudio';
import { transcribe } from '../src/voice/whisperEngine';

const MAX_CONTENT_LENGTH = 2000;
const PREVIEW_MAX = 80;

type SaveMode = 'save-only' | 'save-and-upload';

export default function RecordAudioReviewScreen() {
  const router = useRouter();
  const { applyUserFromRecord } = useAuth();
  const params = useLocalSearchParams<{ audio_path?: string; duration_ms?: string }>();
  const audioPath = params.audio_path ?? '';
  const durationMs = Number(params.duration_ms ?? 0);

  const [content, setContent] = useState('');
  const [transcribing, setTranscribing] = useState(true);
  const [transcribeError, setTranscribeError] = useState<string | null>(null);
  const [saving, setSaving] = useState<SaveMode | null>(null);

  const trimmed = useMemo(() => content.trim(), [content]);
  const canSave = trimmed.length > 0 && saving === null && !transcribing;

  // Auto-run STT on mount. Errors are non-fatal — user can still type
  // manually and save.
  useEffect(() => {
    if (!audioPath) {
      setTranscribing(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const result = await transcribe(audioPath, { language: 'ko' });
        if (cancelled) return;
        setContent(result.text);
      } catch (err) {
        if (cancelled) return;
        setTranscribeError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setTranscribing(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [audioPath]);

  const handleCancel = useCallback(async () => {
    // Discard the temp recording if it's still in our control. The
    // file lives outside drafts/ so deleting it here is safe.
    if (audioPath) {
      await FileSystem.deleteAsync(audioPath, { idempotent: true });
    }
    router.back();
  }, [audioPath, router]);

  const persist = useCallback(
    async (mode: SaveMode) => {
      if (!canSave) return;
      setSaving(mode);
      try {
        const { record, user } = await createVoiceRecord(trimmed);
        applyUserFromRecord(user);

        // Move the temp audio into the drafts folder under this record's
        // id. The drafts store is the single source of truth for "audio
        // not yet on the server" — even when we follow up with an
        // immediate upload, we route through the store so a mid-flight
        // crash leaves the audio recoverable.
        await draftStore.create({
          record_id: record.id,
          audio_source_path: audioPath,
          audio_duration_ms: durationMs,
          transcript_preview: trimmed.slice(0, PREVIEW_MAX),
        });

        if (mode === 'save-and-upload') {
          const result = await uploadAudio(record.id);
          if (result.status === 'failed') {
            // Server has the transcript; only the audio failed. Drop
            // the user back to home with a hint so they can retry from
            // the drafts list.
            Alert.alert(
              '텍스트는 저장됐어요',
              '음성 원본 업로드에 실패해서 보관함에 남아있어요. 마이 탭의 녹음 보관함에서 다시 시도할 수 있어요.',
            );
          }
        }
        router.replace('/(tabs)');
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        Alert.alert('저장에 실패했어요', msg);
      } finally {
        setSaving(null);
      }
    },
    [canSave, trimmed, applyUserFromRecord, audioPath, durationMs, router],
  );

  const placeholder = transcribing
    ? '음성을 텍스트로 바꾸고 있어요…'
    : transcribeError
      ? '변환에 실패했어요. 직접 입력해주세요.'
      : '오늘 아기에게 가장 해주고 싶은 말은?';

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
          <Text variant="h2" color="primary" style={styles.title}>
            오늘의 기록
          </Text>
          <Text variant="emotion" color="secondary" style={styles.subtitle}>
            변환된 글을 편하게 다듬어보세요 🌷
          </Text>

          <View style={styles.inputWrap}>
            <TextInput
              value={content}
              onChangeText={setContent}
              multiline
              editable={!transcribing}
              placeholder={placeholder}
              placeholderTextColor={colors.text.muted}
              maxLength={MAX_CONTENT_LENGTH}
              style={styles.input}
              testID="record-audio-review-input"
            />
          </View>

          <View style={styles.actions}>
            <Button
              title={
                saving === 'save-only'
                  ? '저장 중…'
                  : saving === 'save-and-upload'
                    ? '저장 + 업로드 중…'
                    : '저장 후 음성 원본 업로드'
              }
              variant="primary"
              fullWidth
              disabled={!canSave}
              onPress={() => void persist('save-and-upload')}
              testID="record-audio-review-save-and-upload"
            />
            <Button
              title={saving === 'save-only' ? '저장 중…' : '저장'}
              variant="secondary"
              fullWidth
              disabled={!canSave}
              onPress={() => void persist('save-only')}
              testID="record-audio-review-save"
            />
          </View>
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
  actions: { gap: spacing[3], marginTop: spacing[4] },
});
