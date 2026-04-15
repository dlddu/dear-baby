// Voice diary capture flow — implements PRD-001 AC-001-01 (record), AC-001-02
// (STT), AC-001-03 (edit) in a single screen with four sequential states:
//
//   idle      → user taps "음성 기록 시작" to begin
//   recording → live recording with a pulse indicator
//   transcribing → Whisper (GGML) is running
//   review    → transcription ready, user can edit and save
//
// The screen stays a single route (no modal stack) so the user's mental
// model — "한 번에 한 가지 일만" — matches the minimalist Stage 2
// onboarding described in docs/design-system/onboarding.md.

import {
  requestRecordingPermissionsAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { Badge } from '../../src/components/Badge';
import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { Text } from '../../src/components/Text';
import { newRecordId } from '../../src/records/id';
import { saveRecord } from '../../src/records/storage';
import { VOICE_DIARY_RECORDING_OPTIONS } from '../../src/voice/recorder';
import { transcribeAudio, WhisperUnavailableError } from '../../src/voice/whisper';
import { colors } from '../../src/theme/colors';
import { radius } from '../../src/theme/radius';
import { spacing } from '../../src/theme/spacing';

type Phase = 'idle' | 'recording' | 'transcribing' | 'review';

export default function VoiceRecordScreen() {
  const router = useRouter();

  const recorder = useAudioRecorder(VOICE_DIARY_RECORDING_OPTIONS);
  const recorderState = useAudioRecorderState(recorder, 250);

  const [phase, setPhase] = useState<Phase>('idle');
  const [audioPath, setAudioPath] = useState<string | null>(null);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const startRecording = useCallback(async () => {
    setError(null);
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      setError('마이크 권한을 허용해주세요.');
      return;
    }
    await recorder.prepareToRecordAsync(VOICE_DIARY_RECORDING_OPTIONS);
    recorder.record();
    setPhase('recording');
  }, [recorder]);

  const stopAndTranscribe = useCallback(async () => {
    try {
      await recorder.stop();
      const uri = recorder.uri;
      if (!uri) {
        setError('녹음 파일을 찾지 못했어요. 다시 시도해주세요.');
        setPhase('idle');
        return;
      }
      setAudioPath(uri);
      setPhase('transcribing');
      const text = await transcribeAudio(uri);
      setTranscript(text);
      setPhase('review');
    } catch (e) {
      if (e instanceof WhisperUnavailableError) {
        setError(e.message);
      } else {
        setError('음성을 텍스트로 옮기는 중에 문제가 생겼어요.');
      }
      setPhase('review');
    }
  }, [recorder]);

  const save = useCallback(async () => {
    if (!transcript.trim()) {
      Alert.alert('기록할 내용이 없어요', '텍스트를 확인해주세요.');
      return;
    }
    setSaving(true);
    await saveRecord({
      id: newRecordId(),
      type: 'voice',
      text: transcript.trim(),
      audioPath: audioPath ?? undefined,
      createdAt: new Date().toISOString(),
    });
    setSaving(false);
    // Replace instead of push so the user doesn't land back on the
    // recording screen when they hit back.
    router.replace('/(tabs)/records');
  }, [audioPath, router, transcript]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <Text variant="h2" color="primary">
          음성으로 기록
        </Text>
        <Text variant="emotion" color="secondary" style={styles.subtitle}>
          아기에게 하고 싶은 말을 들려주세요 🌷
        </Text>

        {phase === 'idle' && (
          <Card surface="cream" style={styles.card} testID="voice-idle-card">
            <Text variant="body" color="secondary" style={styles.hint}>
              준비가 되시면 아래 버튼을 눌러주세요.{'\n'}
              녹음이 끝나면 AI가 자동으로 텍스트로 옮겨드려요.
            </Text>
            <Button
              title="음성 기록 시작"
              leading="🎙"
              onPress={startRecording}
              fullWidth
              testID="voice-start-btn"
            />
          </Card>
        )}

        {phase === 'recording' && (
          <Card style={styles.card} testID="voice-recording-card">
            <View style={styles.recordingHeader}>
              <View style={styles.pulseDot} />
              <Text variant="h3" color="coral">
                녹음 중… {formatDuration(recorderState.durationMillis)}
              </Text>
            </View>
            <Text variant="caption" color="muted" style={styles.hint}>
              멈추고 싶을 때 아래 버튼을 눌러주세요.
            </Text>
            <Button
              title="녹음 종료"
              leading="⏹"
              onPress={stopAndTranscribe}
              fullWidth
              testID="voice-stop-btn"
            />
          </Card>
        )}

        {phase === 'transcribing' && (
          <Card style={styles.card} testID="voice-transcribing-card">
            <View style={styles.loadingRow}>
              <ActivityIndicator color={colors.primary.coral} />
              <Text variant="body" color="secondary">
                AI가 글로 옮기고 있어요…
              </Text>
            </View>
            <Text variant="caption" color="muted" style={styles.hint}>
              Whisper(GGML) 모델이 처음 실행될 때에는 조금 더 걸릴 수 있어요.
            </Text>
          </Card>
        )}

        {phase === 'review' && (
          <>
            <View style={styles.reviewHeader}>
              <Badge label="음성 기록" variant="category" />
              <Text variant="caption" color="muted">
                필요하면 아래 내용을 수정해주세요
              </Text>
            </View>
            <TextInput
              value={transcript}
              onChangeText={setTranscript}
              multiline
              placeholder="아직 인식된 내용이 없어요. 직접 입력해도 괜찮아요."
              placeholderTextColor={colors.text.muted}
              style={styles.textarea}
              testID="voice-transcript-input"
            />
            {error && (
              <Text variant="caption" color="coral" style={styles.errorText}>
                {error}
              </Text>
            )}
            <Button
              title={saving ? '저장 중…' : '기록 저장'}
              onPress={save}
              disabled={saving || !transcript.trim()}
              fullWidth
              testID="voice-save-btn"
            />
            <Button
              title="취소"
              variant="secondary"
              onPress={() => router.back()}
              fullWidth
            />
          </>
        )}

        {error && phase !== 'review' && (
          <Text variant="caption" color="coral" style={styles.errorText}>
            {error}
          </Text>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function formatDuration(ms: number | undefined | null): string {
  const total = Math.floor((ms ?? 0) / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.cream },
  scroll: {
    padding: spacing[5],
    gap: spacing[3],
  },
  subtitle: { marginBottom: spacing[3] },
  card: { gap: spacing[3] },
  hint: { lineHeight: 22 },
  recordingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  pulseDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary.coral,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing[2],
  },
  textarea: {
    minHeight: 180,
    borderRadius: radius.md,
    backgroundColor: colors.surface.ivory,
    borderWidth: 1,
    borderColor: colors.bg.beige,
    padding: spacing[4],
    color: colors.text.primary,
    fontSize: 15,
    lineHeight: 24,
    textAlignVertical: 'top',
  },
  errorText: { marginTop: spacing[2] },
});
