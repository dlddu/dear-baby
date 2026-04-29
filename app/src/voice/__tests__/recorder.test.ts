// Recorder integration tests.
//
// The native side (expo-audio's AudioModule.AudioRecorder) can't be
// loaded from a node test, so we mock expo-audio at the require
// boundary the same way recorder.ts consumes it. The interesting
// thing we test here is the *configuration* the recorder hands to
// AudioRecorder, because the production bug that swallowed
// transcripts was a configuration mismatch — the recorder produced
// AAC m4a but whisper.rn only decodes 16-bit PCM WAV.
//
// recorder.ts therefore exports WHISPER_COMPATIBLE_OPTIONS as a
// constant; this suite is the contract that keeps it WAV-shaped.

import { jest } from '@jest/globals';

import {
  WHISPER_COMPATIBLE_OPTIONS,
  recordingOptionsForPlatform,
} from '../recorder';

// resetModules between tests so jest.doMock factories registered in
// one block don't leak into the next (FixtureRecorder tests vs.
// NativeRecorder tests use different expo-audio shapes).
beforeEach(() => {
  jest.resetModules();
});

describe('WHISPER_COMPATIBLE_OPTIONS — declared shape', () => {
  it('uses a .wav extension so AVAudioRecorder writes a RIFF/WAVE container', () => {
    expect(WHISPER_COMPATIBLE_OPTIONS.extension).toBe('.wav');
  });

  it('targets whisper\'s native 16 kHz mono so we skip a resampling pass', () => {
    expect(WHISPER_COMPATIBLE_OPTIONS.sampleRate).toBe(16000);
    expect(WHISPER_COMPATIBLE_OPTIONS.numberOfChannels).toBe(1);
  });

  it('declares iOS LINEARPCM 16-bit so the produced WAV is decodable by whisper.rn', () => {
    const ios = WHISPER_COMPATIBLE_OPTIONS.ios;
    expect(ios.outputFormat).toBe('lpcm');
    expect(ios.linearPCMBitDepth).toBe(16);
    // little-endian, integer — whisper.rn reads LE int16 directly.
    expect(ios.linearPCMIsBigEndian).toBe(false);
    expect(ios.linearPCMIsFloat).toBe(false);
  });

  it('does NOT silently fall back to an AAC preset on iOS', () => {
    // Regression guard: any of the AAC family format codes ('aac ',
    // 'aach', 'aacl', etc.) would produce an m4a payload that
    // whisper.rn skips 44 bytes into and decodes as garbage.
    expect(WHISPER_COMPATIBLE_OPTIONS.ios.outputFormat).not.toMatch(/^aac/);
  });
});

describe('Android limitation — documented bug', () => {
  // Android's MediaRecorder cannot emit linear PCM / WAV. The
  // OutputFormat enum tops out at MPEG-4 / 3GP / WebM, so the
  // recorder.ts options object falls back to a compressed format on
  // Android. This test pins the known-bad behaviour so it surfaces
  // in CI — the day someone swaps the Android recorder for an
  // AudioRecord-based native module that can write WAV, this test
  // updates with a one-line change and the assertion in the next
  // suite ("WAV header guard") starts protecting Android too.
  it('records compressed audio on Android (incompatible with whisper.rn)', () => {
    expect(WHISPER_COMPATIBLE_OPTIONS.android.outputFormat).toBe('mpeg4');
    expect(WHISPER_COMPATIBLE_OPTIONS.android.audioEncoder).toBe('aac');
  });
});

describe('recordingOptionsForPlatform()', () => {
  it('returns WHISPER_COMPATIBLE_OPTIONS verbatim — no per-platform munging', () => {
    // The function is a thin shim today, but having a single
    // chokepoint means we can introduce per-platform fallbacks
    // (e.g. an AudioRecord-based path for Android) without touching
    // every consumer.
    expect(recordingOptionsForPlatform()).toEqual(WHISPER_COMPATIBLE_OPTIONS);
  });
});

describe('createRecorder() — fixture mode', () => {
  it('returns a fixture-backed recorder when E2E_AUDIO_FIXTURE is set', async () => {
    const writeAsStringAsync = jest.fn(async () => undefined);
    const makeDirectoryAsync = jest.fn(async () => undefined);

    let recorderModule!: typeof import('../recorder');
    jest.isolateModules(() => {
      jest.doMock('../../config/env', () => ({ E2E_AUDIO_FIXTURE: true }));
      jest.doMock('expo-file-system/legacy', () => ({
        cacheDirectory: '/cache/',
        writeAsStringAsync,
        makeDirectoryAsync,
      }));
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      recorderModule = require('../recorder');
    });

    const recorder = recorderModule.createRecorder();
    await recorder.start();
    const result = await recorder.stop();

    // Fixture path lands in the voice-rec/ folder under the cache
    // directory and uses .wav so the WAV header guard (which the
    // upload step doesn't run, but which a future caller might)
    // does not flag the file as obviously wrong-format.
    expect(result.uri).toMatch(/^\/cache\/voice-rec\/fixture-\d+\.wav$/);
    expect(result.durationMs).toBeGreaterThanOrEqual(1500);
    expect(writeAsStringAsync).toHaveBeenCalledTimes(1);
    expect(makeDirectoryAsync).toHaveBeenCalledTimes(1);
  });

  it('cancel() on a fresh fixture recorder is a no-op', async () => {
    let recorderModule!: typeof import('../recorder');
    jest.isolateModules(() => {
      jest.doMock('../../config/env', () => ({ E2E_AUDIO_FIXTURE: true }));
      jest.doMock('expo-file-system/legacy', () => ({
        cacheDirectory: '/cache/',
        writeAsStringAsync: jest.fn(async () => undefined),
        makeDirectoryAsync: jest.fn(async () => undefined),
      }));
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      recorderModule = require('../recorder');
    });

    await expect(recorderModule.createRecorder().cancel()).resolves.toBeUndefined();
  });
});

describe('createRecorder() — native path uses the WAV options', () => {
  it('initialises AudioRecorder with WHISPER_COMPATIBLE_OPTIONS', async () => {
    // We capture the options the recorder passes to AudioRecorder so
    // we can assert on them. The mock chains record(), stop(),
    // prepareToRecordAsync() with the minimum the production code
    // touches.
    const passedOpts: unknown[] = [];

    class FakeAudioRecorder {
      uri = '/cache/voice-rec/some-recording.wav';
      constructor(opts: unknown) {
        passedOpts.push(opts);
      }
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      async prepareToRecordAsync(_opts: unknown) {
        /* noop */
      }
      record() {
        /* noop */
      }
      async stop() {
        /* noop */
      }
    }

    let recorderModule!: typeof import('../recorder');
    jest.isolateModules(() => {
      jest.doMock('../../config/env', () => ({ E2E_AUDIO_FIXTURE: false }));
      jest.doMock(
        'expo-audio',
        () => ({
          requestRecordingPermissionsAsync: jest.fn(async () => ({
            granted: true,
          })),
          setAudioModeAsync: jest.fn(async () => undefined),
          AudioModule: { AudioRecorder: FakeAudioRecorder },
        }),
        { virtual: true },
      );
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      recorderModule = require('../recorder');
    });

    const recorder = recorderModule.createRecorder();
    await recorder.start();
    const result = await recorder.stop();

    expect(passedOpts).toHaveLength(1);
    expect(passedOpts[0]).toEqual(WHISPER_COMPATIBLE_OPTIONS);
    expect(result.uri).toBe('/cache/voice-rec/some-recording.wav');
  });

  it('throws "mic permission denied" instead of silently recording silence', async () => {
    let recorderModule!: typeof import('../recorder');
    jest.isolateModules(() => {
      jest.doMock('../../config/env', () => ({ E2E_AUDIO_FIXTURE: false }));
      jest.doMock(
        'expo-audio',
        () => ({
          requestRecordingPermissionsAsync: jest.fn(async () => ({
            granted: false,
          })),
          setAudioModeAsync: jest.fn(async () => undefined),
          AudioModule: { AudioRecorder: class {} },
        }),
        { virtual: true },
      );
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      recorderModule = require('../recorder');
    });

    await expect(recorderModule.createRecorder().start()).rejects.toThrow(
      /mic permission/,
    );
  });

  it('throws when the AudioRecorder class is missing (managed Expo Go)', async () => {
    let recorderModule!: typeof import('../recorder');
    jest.isolateModules(() => {
      jest.doMock('../../config/env', () => ({ E2E_AUDIO_FIXTURE: false }));
      jest.doMock(
        'expo-audio',
        () => ({
          requestRecordingPermissionsAsync: jest.fn(async () => ({
            granted: true,
          })),
          setAudioModeAsync: jest.fn(async () => undefined),
          // No AudioModule field at all — what managed Expo Go gives us.
        }),
        { virtual: true },
      );
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      recorderModule = require('../recorder');
    });

    await expect(recorderModule.createRecorder().start()).rejects.toThrow(
      /AudioRecorder unavailable/,
    );
  });
});
