// whisperEngine wraps whisper.rn behind a tiny, stable surface so
// callers don't depend on the native API directly. The whisper.rn
// import is dynamic so the module loads (and the bundle compiles) even
// when the native side isn't installed yet — important for fast-refresh
// on dev clients without the prebuild and for the E2E fixture path.
//
// transcribe(audioPath) returns the final transcript. We deliberately
// don't expose partial / streaming results yet: the review screen
// shows a single loading spinner and replaces it with the full text,
// which keeps the UX simple and the surface area small. If we add
// partials later they go through this same module.
//
// Why we don't call ctx.transcribe(filePath) directly:
//
// whisper.rn's transcribeFile path skips a hard-coded 44 bytes from
// the start of the file, treating the rest as little-endian int16
// samples. AVAudioRecorder on iOS sometimes emits a JUNK / FLLR pad
// chunk between `fmt ` and `data`, pushing the real PCM offset past
// 44 — and even a one-byte misalignment shifts every 16-bit sample
// by half, which whisper hears as static and hallucinates filler
// tokens for (`[한국어의 한국어]` was the giveaway). To stay robust
// across iOS WAV layouts, we read the file ourselves, parse the
// chunk list to locate the real PCM region, and feed the raw
// samples to ctx.transcribeData() — that path uses cutHeader:NO and
// reads exactly what we hand it.

import * as FileSystem from 'expo-file-system/legacy';

import { E2E_AUDIO_FIXTURE } from '../config/env';
import { findWaveDataChunk } from './audioFormat';
import { ensureModel } from './modelManager';

// We accept either of whisper.rn's transcribe entry points so the
// engine works against the real native module and against the
// virtual mock in tests.
type TranscribeFn = (
  audioPath: string,
  opts: { language?: string; tokenTimestamps?: boolean },
) => { promise: Promise<{ result: string }> };

type TranscribeDataFn = (
  base64Pcm: string,
  opts: { language?: string; tokenTimestamps?: boolean },
) => { promise: Promise<{ result: string }> };

type WhisperContext = {
  transcribe: TranscribeFn;
  transcribeData?: TranscribeDataFn;
  release: () => Promise<void>;
};

let ctx: WhisperContext | null = null;
let loading: Promise<WhisperContext> | null = null;

async function getContext(): Promise<WhisperContext> {
  if (ctx) return ctx;
  if (loading) return loading;
  loading = (async () => {
    const modelPath = await ensureModel();
    // Dynamic require keeps Metro from hard-failing when whisper.rn
    // isn't yet linked into the native binary (e.g. fast-refresh on
    // a managed Expo Go session, which can't load native code).
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const whisper = require('whisper.rn');
    const initWhisper = whisper.initWhisper ?? whisper.default?.initWhisper;
    if (!initWhisper) {
      throw new Error('whisper.rn not linked');
    }
    const created: WhisperContext = await initWhisper({ filePath: modelPath });
    ctx = created;
    return created;
  })();
  try {
    return await loading;
  } finally {
    loading = null;
  }
}

export type TranscribeOptions = {
  // language defaults to Korean. Whisper's language detection is
  // generally accurate for Korean but failures (silence, music) can
  // misroute to English; pinning language="ko" keeps the output stable.
  language?: string;
};

export async function transcribe(
  audioPath: string,
  options: TranscribeOptions = {},
): Promise<string> {
  if (E2E_AUDIO_FIXTURE) {
    // Deterministic transcript for Maestro. The string is intentionally
    // recognisable so the assertion in the .yaml flow can match it
    // verbatim without leaking real test data.
    return '오늘 아기가 처음으로 발로 차 줬어요. 잊지 않으려고 남겨둘게요 🌷';
  }
  const c = await getContext();
  const opts = {
    language: options.language ?? 'ko',
    // We deliberately don't pass `maxLen` here. whisper.rn's
    // `maxLen` option caps the *segment text length in characters*,
    // not wall time as the previous comment claimed; setting it to
    // the recording-duration-in-seconds value (60) was a no-op at
    // best and cut Korean segments mid-sentence at worst. The
    // recorder already caps audio to 60 s upstream.
    tokenTimestamps: false,
  };

  // Prefer the data path when whisper.rn exposes it: that route
  // does NOT cut a hard-coded 44 bytes off the front of the file,
  // so AVAudioRecorder's JUNK/FLLR padding can't shift our sample
  // boundaries. Falls back to the file path for the rare build
  // where transcribeData is missing (older whisper.rn forks).
  if (typeof c.transcribeData === 'function') {
    const pcmBase64 = await loadPcmFromWav(audioPath);
    const { promise } = c.transcribeData(pcmBase64, opts);
    const result = await promise;
    return (result?.result ?? '').trim();
  }

  const { promise } = c.transcribe(audioPath, opts);
  const result = await promise;
  return (result?.result ?? '').trim();
}

// loadPcmFromWav reads an on-disk WAV, walks its chunk list, and
// returns the raw PCM region as a base64 string ready to hand to
// whisper.rn's transcribeData() entry point.
//
// Logs are deliberately verbose: PostHog Session Replay captures
// console.warn / console.error (analytics/client.ts:24-30), so a
// real-device STT failure surfaces in the replay timeline with the
// file size + parse failure reason — that's the primary debug
// channel since iOS native logs don't reach PostHog.
async function loadPcmFromWav(audioPath: string): Promise<string> {
  const wavBase64 = await FileSystem.readAsStringAsync(audioPath, {
    encoding: 'base64',
  });
  const bytes = base64ToBytes(wavBase64);
  const chunk = findWaveDataChunk(bytes);
  if (!chunk.ok) {
    console.warn(
      'whisper-stt: WAV parse failed — falling back to whole-file transcribe',
      {
        path: audioPath,
        size: bytes.length,
        reason: chunk.reason,
        detail: chunk.detail,
      },
    );
    // Letting the caller fall through to ctx.transcribe(filePath)
    // would re-introduce the 44-byte cut bug. Instead we throw with
    // a clear message — the review screen catches this and lets the
    // user type the transcript by hand.
    throw new Error(`STT input not a decodable WAV: ${chunk.reason}`);
  }
  if (chunk.bitsPerSample !== 16) {
    throw new Error(
      `STT input is ${chunk.bitsPerSample}-bit, expected 16-bit`,
    );
  }
  const pcm = bytes.subarray(chunk.dataOffset, chunk.dataOffset + chunk.dataSize);
  return bytesToBase64(pcm);
}

// base64ToBytes / bytesToBase64 use Hermes' built-in atob / btoa
// (RN ≥0.71 ships them). Going through latin1-encoded strings keeps
// us off any third-party polyfill.
function base64ToBytes(b64: string): Uint8Array {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const atob: (s: string) => string = (globalThis as any).atob;
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToBase64(bytes: Uint8Array): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const btoa: (s: string) => string = (globalThis as any).btoa;
  // Process in 8 KB chunks so we don't blow the call-stack on a
  // 60-second recording (~1.9 MB of PCM).
  const chunkSize = 8192;
  let bin = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const end = Math.min(i + chunkSize, bytes.length);
    bin += String.fromCharCode.apply(
      null,
      bytes.subarray(i, end) as unknown as number[],
    );
  }
  return btoa(bin);
}

// release is exported for the rare cases where we want to free native
// memory (e.g. background-state hooks). The home screen does not call
// it — the cost of keeping the model loaded across screens is much
// smaller than the cost of re-loading on every record.
export async function release(): Promise<void> {
  if (!ctx) return;
  try {
    await ctx.release();
  } finally {
    ctx = null;
  }
}
