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
// On iOS the recorder produces a 16 kHz mono linear-PCM .wav file —
// whisper.cpp consumes WAV directly without an AAC decode pass, which
// shortens cold-start STT latency and avoids a quality loss step. On
// Android the HIGH_QUALITY preset (.m4a / AAC) is kept because the
// platform's recommended capture path is encoded MP4. Either way the
// review screen moves the file into the archive on save.

import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

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
    const ext = Platform.OS === 'ios' ? 'wav' : 'm4a';
    const uri = `${dir}fixture-${this.startedAt}.${ext}`;
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
// AudioRecorder class directly.
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
    const presets = audio.RecordingPresets ?? {};
    const opts = recordingOptionsFor(presets);
    // expo-audio v1.x exposes the AudioRecorder class on AudioModule, not on
    // the package root, so `new audio.AudioRecorder(...)` would crash with
    // "Cannot read property 'prototype' of undefined" in Hermes.
    const AudioRecorder = audio.AudioModule?.AudioRecorder;
    if (!AudioRecorder) throw new Error('expo-audio AudioRecorder unavailable');
    this.recorder = new AudioRecorder(opts);
    // prepareToRecordAsync's prototype shim flattens preset options to the
    // platform-specific shape the native side expects.
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

export function createRecorder(): Recorder {
  return E2E_AUDIO_FIXTURE ? new FixtureRecorder() : new NativeRecorder();
}

// recordingOptionsFor picks the platform-appropriate recorder config.
// On iOS we override the preset with linear-PCM @ 16 kHz mono — that's
// the format whisper.cpp ingests natively, so the STT path skips the
// AAC decode. Android stays on HIGH_QUALITY (.m4a / AAC) because the
// platform's capture pipeline is built around encoded MP4; forcing PCM
// there would require additional MediaRecorder gymnastics for no STT
// gain.
function recordingOptionsFor(presets: Record<string, unknown>): any {
  if (Platform.OS === 'ios') {
    return {
      extension: '.wav',
      sampleRate: 16000,
      numberOfChannels: 1,
      bitRate: 256000,
      ios: {
        extension: '.wav',
        // 'lpcm' = IOSOutputFormat.LINEARPCM. Whisper expects 16-bit
        // little-endian signed PCM at 16 kHz mono — every field below
        // matches that contract.
        outputFormat: 'lpcm',
        // 96 = AudioQuality.HIGH; PCM is lossless so quality mostly
        // affects the resampler, not the encoder.
        audioQuality: 96,
        sampleRate: 16000,
        numberOfChannels: 1,
        bitRate: 256000,
        linearPCMBitDepth: 16,
        linearPCMIsBigEndian: false,
        linearPCMIsFloat: false,
      },
    };
  }
  return presets.HIGH_QUALITY ?? presets.LOW_QUALITY ?? {};
}
