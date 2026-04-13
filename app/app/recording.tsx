import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Audio } from 'expo-av';

import { colors, radius } from '../src/theme/colors';

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function WaveformBars() {
  const bars = useRef(
    Array.from({ length: 24 }, () => new Animated.Value(12)),
  ).current;

  useEffect(() => {
    const animations = bars.map((bar) => {
      const targetHeight = 16 + Math.random() * 48;
      return Animated.loop(
        Animated.sequence([
          Animated.timing(bar, {
            toValue: targetHeight,
            duration: 400 + Math.random() * 800,
            useNativeDriver: false,
          }),
          Animated.timing(bar, {
            toValue: 12,
            duration: 400 + Math.random() * 800,
            useNativeDriver: false,
          }),
        ]),
      );
    });
    animations.forEach((a) => a.start());
    return () => animations.forEach((a) => a.stop());
  }, [bars]);

  return (
    <View style={recordingStyles.waveform}>
      {bars.map((bar, i) => (
        <Animated.View
          key={i}
          style={[
            recordingStyles.waveBar,
            { height: bar },
          ]}
        />
      ))}
    </View>
  );
}

export default function RecordingScreen() {
  const router = useRouter();
  const [isRecording, setIsRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(() => {});
      }
    };
  }, []);

  async function startRecording() {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) return;

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
      );
      recordingRef.current = recording;
      setIsRecording(true);
      setSeconds(0);
      timerRef.current = setInterval(() => {
        setSeconds((s) => s + 1);
      }, 1000);
    } catch {
      // Permission denied or recording failed
    }
  }

  async function stopRecording() {
    if (!recordingRef.current) return;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsRecording(false);
    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;

      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });

      if (uri) {
        router.replace({
          pathname: '/converting',
          params: { audioUri: uri, duration: String(seconds) },
        });
      }
    } catch {
      recordingRef.current = null;
    }
  }

  return (
    <View style={recordingStyles.screen}>
      <Pressable style={recordingStyles.backBtn} onPress={() => router.back()}>
        <Text style={recordingStyles.backText}>‹</Text>
      </Pressable>

      {!isRecording ? (
        /* Idle State */
        <View style={recordingStyles.center}>
          <Text style={recordingStyles.idleTitle}>음성으로 기록하기</Text>
          <Text style={recordingStyles.idleSub}>
            아래 버튼을 눌러 녹음을 시작하세요
          </Text>
          <Pressable style={recordingStyles.micBtnIdle} onPress={startRecording}>
            <Text style={{ fontSize: 32 }}>🎙️</Text>
          </Pressable>
          <Text style={recordingStyles.hint}>탭하여 녹음 시작</Text>
        </View>
      ) : (
        /* Recording State */
        <View style={recordingStyles.center}>
          <View style={recordingStyles.statusRow}>
            <View style={recordingStyles.recDot} />
            <Text style={recordingStyles.statusText}>녹음 중</Text>
          </View>
          <Text style={recordingStyles.timer}>{formatTime(seconds)}</Text>
          <WaveformBars />
          <Pressable style={recordingStyles.stopBtn} onPress={stopRecording}>
            <View style={recordingStyles.stopIcon} />
          </Pressable>
          <Text style={recordingStyles.hint}>탭하여 녹음 종료</Text>
        </View>
      )}
    </View>
  );
}

const recordingStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bgCream,
  },
  backBtn: {
    position: 'absolute',
    top: 56,
    left: 24,
    zIndex: 10,
    padding: 8,
  },
  backText: {
    fontSize: 28,
    color: colors.textSecondary,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  idleTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  idleSub: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 40,
  },
  micBtnIdle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.accentPeach,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.accentPeach,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
    marginBottom: 16,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  recDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E55',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.accentCoral,
  },
  timer: {
    fontSize: 48,
    fontWeight: '600',
    color: colors.textPrimary,
    letterSpacing: 2,
    marginBottom: 32,
    fontStyle: 'italic',
  },
  waveform: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    height: 80,
    marginBottom: 40,
  },
  waveBar: {
    width: 4,
    backgroundColor: colors.accentPeach,
    borderRadius: 4,
  },
  stopBtn: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FEE',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#E55',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    marginBottom: 16,
  },
  stopIcon: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#E55',
  },
  hint: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4,
  },
});
