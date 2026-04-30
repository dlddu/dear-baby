// 녹음 화면 — 음성 기록 흐름의 첫 단계. 사용자는 한 번 탭으로 녹음을
// 시작하고, 다시 탭으로 종료한다. 종료 직후 임시 오디오 파일(iOS는
// .wav / Android는 .m4a)과 길이를 들고 리뷰 화면으로 넘어간다
// (record-audio-review).
//
// 이 화면은 전송 / STT / 저장 어떤 것도 하지 않는다. 책임은 마이크 권한,
// 녹음 토글, 시각적 피드백뿐이다.

import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../src/components/Button';
import { Text } from '../src/components/Text';
import { colors } from '../src/theme/colors';
import { radius } from '../src/theme/radius';
import { spacing } from '../src/theme/spacing';
import { typography } from '../src/theme/typography';
import { createRecorder, type Recorder } from '../src/voice/recorder';

// 60s — 디바이스 STT(large-v3-turbo-q5)의 권장 처리 길이. 저장된 오디오
// 파일이 너무 커지지 않도록 cap도 같이 둔다.
const MAX_RECORDING_MS = 60_000;

function formatTime(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = String(Math.floor(total / 60)).padStart(2, '0');
  const s = String(total % 60).padStart(2, '0');
  return `${m}:${s}`;
}

export default function RecordAudioScreen() {
  const router = useRouter();
  const [isRecording, setIsRecording] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  // recorderRef holds the active recorder instance for the lifetime
  // of one recording session. Recreated on each start to avoid state
  // leaks between attempts.
  const recorderRef = useRef<Recorder | null>(null);
  const startedAtRef = useRef<number>(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopTicker = useCallback(() => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }, []);

  // Cleanup on unmount: if the user backed out mid-recording the
  // microphone must be released.
  useEffect(
    () => () => {
      stopTicker();
      void recorderRef.current?.cancel();
    },
    [stopTicker],
  );

  const handleStart = useCallback(async () => {
    try {
      const r = createRecorder();
      recorderRef.current = r;
      await r.start();
      startedAtRef.current = Date.now();
      setElapsedMs(0);
      setIsRecording(true);
      tickRef.current = setInterval(() => {
        const next = Date.now() - startedAtRef.current;
        setElapsedMs(next);
        if (next >= MAX_RECORDING_MS) {
          // Auto-stop at the cap. We trigger the same stop path so
          // the user lands on review with whatever they recorded.
          void handleStop();
        }
      }, 250);
    } catch (err) {
      console.error('recorder start failed', err);
      Alert.alert('녹음 시작 실패', '잠시 후 다시 시도해 주세요.');
      recorderRef.current = null;
      setIsRecording(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleStop = useCallback(async () => {
    stopTicker();
    const r = recorderRef.current;
    if (!r) {
      setIsRecording(false);
      return;
    }
    try {
      const result = await r.stop();
      recorderRef.current = null;
      setIsRecording(false);
      router.replace({
        pathname: '/record-audio-review',
        params: {
          audio_path: result.uri,
          audio_duration_ms: String(result.durationMs),
        },
      });
    } catch (err) {
      console.error('recorder stop failed', err);
      Alert.alert('녹음 종료 실패', '잠시 후 다시 시도해 주세요.');
      setIsRecording(false);
    }
  }, [router, stopTicker]);

  const handleCancel = useCallback(async () => {
    stopTicker();
    await recorderRef.current?.cancel();
    recorderRef.current = null;
    router.back();
  }, [router, stopTicker]);

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
          마음 가는 대로 들려주세요
        </Text>
        <Text variant="emotion" color="secondary" style={styles.subtitle}>
          녹음한 목소리는 이 기기에서만 텍스트로 정리해드려요.
        </Text>

        <Text
          variant="display"
          color="primary"
          style={styles.timer}
          testID="record-audio-time"
        >
          {formatTime(elapsedMs)}
        </Text>

        <View
          style={[
            styles.indicator,
            isRecording ? styles.indicatorOn : styles.indicatorOff,
          ]}
          testID="record-audio-level"
        />
      </View>

      <View style={styles.footer}>
        {isRecording ? (
          <Button
            title="멈추기"
            leading="⏹"
            variant="primary"
            fullWidth
            onPress={handleStop}
            testID="record-audio-stop"
          />
        ) : (
          <Button
            title="녹음 시작"
            leading="🎙"
            variant="primary"
            fullWidth
            onPress={handleStart}
            testID="record-audio-start"
          />
        )}
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
    paddingHorizontal: spacing[5],
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[4],
  },
  title: { textAlign: 'center' },
  subtitle: { textAlign: 'center', marginBottom: spacing[6] },
  timer: {
    ...typography.display,
    color: colors.text.primary,
  },
  indicator: {
    width: 96,
    height: 96,
    borderRadius: radius.full,
    marginTop: spacing[6],
  },
  indicatorOn: { backgroundColor: colors.primary.coral },
  indicatorOff: { backgroundColor: colors.bg.beige },
  footer: {
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[6],
  },
});
