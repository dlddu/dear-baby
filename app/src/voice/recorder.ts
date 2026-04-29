// Recorder is a thin abstraction over expo-audio's recording API. It
// exists for two reasons:
//
//   1. The E2E fixture mode needs to substitute a fake recorder that
//      produces a deterministic file path and duration without ever
//      touching the microphone.
//   2. The expo-audio API surface is verbose; the screens want a
//      "start / stop / current millis" view, not the full recorder
//      lifecycle.
//
// Format note — important.
//
// whisper.rn's transcribeFile reads the audio file as raw bytes,
// strips a fixed 44-byte WAV header, and treats the rest as
// little-endian 16-bit PCM. It does NOT decode m4a / AAC / mp3.
// expo-audio's bundled RecordingPresets all default to AAC in an m4a
// container, which is silently incompatible — whisper sees garbage
// samples and returns "" for the transcript. To stay on a WAV path
// the recorder MUST be initialised with linear PCM options. The
// constant below is the single source of truth and is asserted by
// recorder.test.ts so a future preset bump can't reintroduce the
// regression.

import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

import { E2E_AUDIO_FIXTURE } from '../config/env';

export type StopResult = {
  uri: string;
  durationMs: number;
};

// Recorder is a small interface; both the real implementation and the
// fixture conform to it.
export interface Recorder {
  start(): Promise<void>;
  stop(): Promise<StopResult>;
  /** Best-effort cancellation; safe to call even if start() failed. */
  cancel(): Promise<void>;
}

// The shape mirrors expo-audio's RecordingOptions just enough for
// our use, but we keep the fields loosely typed (`unknown`) on the
// platform sub-objects so a minor expo-audio bump doesn't break the
// build. The recorder.test.ts suite asserts the runtime values.
type WhisperCompatibleOptions = {
  extension: string;
  sampleRate: number;
  numberOfChannels: number;
  bitRate: number;
  ios: Record<string, unknown>;
  android: Record<string, unknown>;
};

// Whisper's native sample rate is 16 kHz mono — the model resamples
// internally if you give it something else, but going in at 16 kHz
// removes a wasted resampling pass on every transcribe and roughly
// halves the on-disk size compared to a 44.1 kHz capture.
//
// Bit rate is informational for PCM (it's derived from sample rate
// × bit depth × channels), but expo-audio still wants a value.
// 16 000 × 16 × 1 = 256 000.
export const WHISPER_COMPATIBLE_OPTIONS: WhisperCompatibleOptions = {
  extension: '.wav',
  sampleRate: 16000,
  numberOfChannels: 1,
  bitRate: 256000,
  ios: {
    // 'lpcm' = IOSOutputFormat.LINEARPCM. Combined with the .wav
    // extension AVAudioRecorder writes a canonical RIFF/WAVE file
    // that whisper.rn's 44-byte cut decodes correctly.
    outputFormat: 'lpcm',
    audioQuality: 0x7f, // AudioQuality.MAX — irrelevant for PCM but required
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  android: {
    // Android MediaRecorder cannot emit linear PCM / WAV — its
    // OutputFormat enum only lists container formats (MPEG-4, 3GP,
    // WebM, …). A future change should swap the Android recorder
    // for an AudioRecord-based native module that writes a WAV
    // directly. Until then the value below is a best-effort
    // configuration that at least keeps the file mono-channel at
    // whisper's preferred sample rate; the file itself is still
    // AAC-in-MP4 and will fail the WAV header guard, which is the
    // signal the upstream caller needs to either skip transcription
    // or fall back to a server-side STT.
    outputFormat: 'mpeg4',
    audioEncoder: 'aac',
  },
};

// fixtureRecorder writes a tiny placeholder file synchronously and
// returns a fixed duration. Maestro and unit tests hit this path; the
// transcript and upload stages also short-circuit elsewhere so the
// fake bytes are never read.
class FixtureRecorder implements Recorder {
  private startedAt = 0;

  async start(): Promise<void> {
    this.startedAt = Date.now();
  }

  async stop(): Promise<StopResult> {
    const dir = `${FileSystem.cacheDirectory ?? ''}voice-rec/`;
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    const uri = `${dir}fixture-${this.startedAt}.wav`;
    // Placeholder bytes — never decoded because the STT and S3 paths
    // are also short-circuited under the same flag.
    await FileSystem.writeAsStringAsync(uri, 'FIXTURE');
    return {
      uri,
      durationMs: Math.max(1500, Date.now() - this.startedAt),
    };
  }

  async cancel(): Promise<void> {
    /* noop */
  }
}

// nativeRecorder lazily requires expo-audio so the bundle compiles
// even if the native module isn't installed (managed Expo Go). On a
// dev or release build with expo-audio linked in, it uses the
// AudioRecorder class directly with a WAV-compatible configuration.
class NativeRecorder implements Recorder {
  // recorder is `any` because expo-audio's types churn between
  // patch versions and we don't want the TS compiler to fail loudly
  // when developers bump the dep — the surface we use is small.
  private recorder: any | null = null;
  private startedAt = 0;

  async start(): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const audio = require('expo-audio');
    const status = await audio.requestRecordingPermissionsAsync();
    if (!status.granted) {
      throw new Error('mic permission denied');
    }
    await audio.setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    // expo-audio v1.x exposes the AudioRecorder class on AudioModule, not on
    // the package root, so `new audio.AudioRecorder(...)` would crash with
    // "Cannot read property 'prototype' of undefined" in Hermes.
    const AudioRecorder = audio.AudioModule?.AudioRecorder;
    if (!AudioRecorder) throw new Error('expo-audio AudioRecorder unavailable');
    // recordingOptionsForPlatform flattens platform-specific options
    // onto the top-level (see its comment) — pass the same flat
    // object to both the constructor and prepareToRecordAsync so they
    // agree on the format.
    const opts = recordingOptionsForPlatform();
    this.recorder = new AudioRecorder(opts);
    await this.recorder.prepareToRecordAsync(opts);
    this.recorder.record();
    this.startedAt = Date.now();
  }

  async stop(): Promise<StopResult> {
    if (!this.recorder) throw new Error('recorder not started');
    await this.recorder.stop();
    const uri: string = this.recorder.uri ?? '';
    const durationMs = Math.max(0, Date.now() - this.startedAt);
    this.recorder = null;
    if (!uri) throw new Error('recorder produced no uri');
    return { uri, durationMs };
  }

  async cancel(): Promise<void> {
    if (!this.recorder) return;
    try {
      await this.recorder.stop();
    } catch {
      /* swallow — best-effort cleanup */
    }
    this.recorder = null;
  }
}

// recordingOptionsForPlatform flattens the platform-specific block of
// WHISPER_COMPATIBLE_OPTIONS into the shape expo-audio's *imperative*
// AudioRecorder constructor expects.
//
// Why this exists: the public hook `useAudioRecorder(options)` runs
// `createRecordingOptions` internally — it reads `options.ios` /
// `options.android` and spreads it onto the top-level fields before
// crossing the bridge. The imperative path
// `new AudioModule.AudioRecorder(options)` does NOT do this flatten,
// so an `outputFormat: 'lpcm'` left inside `options.ios` is silently
// dropped on iOS — AVAudioRecorder gets no AVFormatIDKey and falls
// back to whatever default the OS picks (AAC in practice on recent
// iOS), producing an m4a-shaped payload that whisper.rn can't decode.
// That's the root cause of the "STT 결과가 안 나와요 / [미리보기] 만
// 보여요" symptom even after the previous WAV-config landing.
//
// We could switch to useAudioRecorder, but the recorder.ts surface is
// imperative (start / stop / cancel) and the hook is render-coupled.
// Flattening here keeps the call site unchanged.
type FlatRecordingOptions = {
  extension: string;
  sampleRate: number;
  numberOfChannels: number;
  bitRate: number;
  isMeteringEnabled: boolean;
} & Record<string, unknown>;

export function recordingOptionsForPlatform(
  platformOS: 'ios' | 'android' | 'web' | string = Platform.OS,
): FlatRecordingOptions {
  const flat: FlatRecordingOptions = {
    extension: WHISPER_COMPATIBLE_OPTIONS.extension,
    sampleRate: WHISPER_COMPATIBLE_OPTIONS.sampleRate,
    numberOfChannels: WHISPER_COMPATIBLE_OPTIONS.numberOfChannels,
    bitRate: WHISPER_COMPATIBLE_OPTIONS.bitRate,
    isMeteringEnabled: false,
  };
  if (platformOS === 'ios') {
    Object.assign(flat, WHISPER_COMPATIBLE_OPTIONS.ios);
  } else if (platformOS === 'android') {
    Object.assign(flat, WHISPER_COMPATIBLE_OPTIONS.android);
  }
  return flat;
}

export function createRecorder(): Recorder {
  return E2E_AUDIO_FIXTURE ? new FixtureRecorder() : new NativeRecorder();
}
