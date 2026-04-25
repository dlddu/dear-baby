// Record-audio screen — Stage 2 음성 기록 진입점.
//
// 단일 녹음 토글: 시작 → 정지. 정지 시 m4a 파일 경로와 길이를 review
// 화면으로 넘긴다. review 에서 STT/저장이 일어난다.
//
// 디자인 시스템 준수: 배경 cream, IconCircle for the mic glyph, primary
// Button for the toggle, Text variant 토큰. 하드코딩된 색/숫자 없음.
//
// E2E fixture: EXPO_PUBLIC_E2E_AUDIO_FIXTURE=1 일 때 실제 녹음 없이
// "녹음됨" 상태로 즉시 review 화면으로 진입한다 — Maestro 가 마이크
// 입력을 흉내낼 수 없기 때문.

import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../src/components/Button';
import { IconCircle } from '../src/components/IconCircle';
import { Text } from '../src/components/Text';
import { colors } from '../src/theme/colors';
import { spacing } from '../src/theme/spacing';

const FIXTURE = process.env.EXPO_PUBLIC_E2E_AUDIO_FIXTURE === '1';
const FIXTURE_PATH = 'fixture://audio.m4a';
const FIXTURE_DURATION_MS = 4500;

function formatDuration(ms: number): string {
  const total = Math.floor(ms / 1000);
  const mm = String(Math.floor(total / 60)).padStart(2, '0');
  const ss = String(total % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

export default function RecordAudioScreen() {
  const router = useRouter();
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recState = useAudioRecorderState(recorder, 250);
  const [permissionAsked, setPermissionAsked] = useState(false);

  // Request mic permission on mount; bounce back to home with an alert
  // when denied. Doing this on mount instead of on first tap means the
  // user sees the system prompt immediately, matching the OS-suggested
  // pattern for screens whose sole purpose is recording.
  useEffect(() => {
    if (FIXTURE) {
      setPermissionAsked(true);
      return;
    }
    void (async () => {
      const status = await requestRecordingPermissionsAsync();
      if (!status.granted) {
        Alert.alert(
          '마이크 권한이 필요해요',
          '설정에서 마이크 사용을 허용해주세요.',
        );
        router.back();
        return;
      }
      setPermissionAsked(true);
    })();
  }, [router]);

  const handleStart = useCallback(async () => {
    if (FIXTURE) return;
    await recorder.prepareToRecordAsync();
    recorder.record();
  }, [recorder]);

  const handleStop = useCallback(async () => {
    if (FIXTURE) {
      router.replace({
        pathname: '/record-audio-review',
        params: {
          audio_path: FIXTURE_PATH,
          duration_ms: String(FIXTURE_DURATION_MS),
        },
      });
      return;
    }
    await recorder.stop();
    const uri = recorder.uri;
    if (!uri) {
      Alert.alert('녹음에 실패했어요', '잠시 후 다시 시도해주세요.');
      return;
    }
    router.replace({
      pathname: '/record-audio-review',
      params: {
        audio_path: uri,
        duration_ms: String(recState.durationMillis ?? 0),
      },
    });
  }, [recorder, recState.durationMillis, router]);

  const handleCancel = useCallback(() => {
    if (recState.isRecording) void recorder.stop();
    router.back();
  }, [recState.isRecording, recorder, router]);

  if (!permissionAsked) {
    return <SafeAreaView style={styles.safe} edges={['top', 'bottom']} />;
  }

  const isRecording = FIXTURE ? false : recState.isRecording;
  const duration = FIXTURE ? 0 : recState.durationMillis ?? 0;

  return (
    <SafeAreaView
      style={styles.safe}
      edges={['top', 'bottom']}
      testID="record-audio-screen"
    >
      <View style={styles.topbar}>
        <Pressable
          accessibilityRole="button"
          onPress={handleCancel}
          hitSlop={8}
          testID="record-audio-cancel"
        >
          <Text variant="body" color="secondary">
            취소
          </Text>
        </Pressable>
      </View>

      <View style={styles.body}>
        <Text variant="h2" color="primary" style={styles.title}>
          말로 전하는 사랑
        </Text>
        <Text variant="emotion" color="secondary" style={styles.subtitle}>
          편안하게 아기에게 들려주세요 🌷
        </Text>

        <View style={styles.micWrap} testID="record-audio-level">
          <IconCircle
            glyph="🎙"
            tone="voice"
            size={120}
            style={isRecording ? styles.micActive : undefined}
          />
        </View>

        <Text
          variant="h2"
          color={isRecording ? 'coral' : 'secondary'}
          style={styles.time}
          testID="record-audio-time"
        >
          {formatDuration(duration)}
        </Text>

        <View style={styles.actions}>
          {isRecording ? (
            <Button
              title="정지"
              variant="primary"
              fullWidth
              onPress={handleStop}
              testID="record-audio-toggle"
            />
          ) : FIXTURE ? (
            <Button
              title="다음"
              variant="primary"
              fullWidth
              onPress={handleStop}
              testID="record-audio-next"
            />
          ) : (
            <Button
              title="녹음 시작"
              leading="🎙"
              variant="primary"
              fullWidth
              onPress={handleStart}
              testID="record-audio-toggle"
            />
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.cream },
  topbar: {
    flexDirection: 'row',
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[3],
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[5],
    gap: spacing[5],
  },
  title: { textAlign: 'center' },
  subtitle: { textAlign: 'center', marginBottom: spacing[4] },
  micWrap: { marginVertical: spacing[6] },
  // 녹음 중에는 IconCircle 그림자만 강조 — 색은 토큰만 사용한다.
  micActive: { opacity: 0.95 },
  time: { fontVariant: ['tabular-nums'] },
  actions: { alignSelf: 'stretch', marginTop: spacing[6] },
});
