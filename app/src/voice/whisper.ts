// On-device Korean speech-to-text via OpenAI Whisper.
//
// `whisper.rn` is a React Native binding around `whisper.cpp`, the C/C++
// re-implementation of Whisper that runs on mobile hardware. `whisper.cpp`
// consumes Whisper models in the **GGML** container format (`.bin`), which
// is the same format OpenAI's original PyTorch weights are converted to for
// on-device inference. That's why PRD-001's V-004 goal (on-device Korean
// STT) is satisfied here by a GGML model — it's simply the distribution
// format Whisper ships in for this runtime.
//
// The native module is only available in a prebuilt dev client or release
// build; it is not part of Expo Go. To keep the app importable in Jest /
// Expo Go and to survive the case where the prebuild hasn't been generated
// yet, we lazy-require `whisper.rn` and surface a structured error rather
// than crashing at module load.

import { Paths, File } from 'expo-file-system';

import { WHISPER_MODEL_FILENAME, WHISPER_MODEL_URL } from '../config/env';

// Lazy import type without forcing a runtime require of whisper.rn.
// Using `any` here keeps module resolution optional — TS still enforces
// typing at our public boundary (`transcribeAudio` below).
type WhisperContext = {
  transcribe(
    filePathOrBase64: string,
    options?: { language?: string; translate?: boolean; maxLen?: number },
  ): { stop: () => Promise<void>; promise: Promise<{ result: string }> };
  release(): Promise<void>;
};

type WhisperRN = {
  initWhisper: (opts: { filePath: string }) => Promise<WhisperContext>;
};

let cachedContext: WhisperContext | null = null;
let inflightInit: Promise<WhisperContext> | null = null;

/** Thrown when the native whisper.rn module is not linked (e.g. Expo Go). */
export class WhisperUnavailableError extends Error {
  constructor() {
    super(
      '음성 인식 모듈을 불러오지 못했어요. 앱을 최신 버전으로 업데이트해주세요.',
    );
    this.name = 'WhisperUnavailableError';
  }
}

function loadNativeModule(): WhisperRN {
  try {
    // Require at call time so Metro does not choke when the autolinked
    // native module is absent (unit tests, Expo Go, web preview).
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('whisper.rn') as WhisperRN;
    if (!mod?.initWhisper) throw new Error('initWhisper missing');
    return mod;
  } catch {
    throw new WhisperUnavailableError();
  }
}

/**
 * Ensures the GGML Whisper model is cached in the document directory,
 * downloading it on first launch. Returns the absolute file path.
 *
 * The model file is ~75 MB for `ggml-tiny.bin`; the one-time download is
 * the cost of on-device inference. Callers should show a loading state
 * the first time.
 */
export async function ensureWhisperModel(): Promise<string> {
  const target = new File(Paths.document, WHISPER_MODEL_FILENAME);
  if (target.exists) return target.uri;
  // `File.downloadFileAsync` writes the response body directly to the
  // destination and returns the final File handle. Errors propagate to
  // callers so they can surface a retry UI.
  const downloaded = await File.downloadFileAsync(
    WHISPER_MODEL_URL,
    target,
  );
  return downloaded.uri;
}

/**
 * Lazily initializes (and caches) the Whisper context. The context holds
 * the loaded model in memory — creating multiple contexts would waste RAM
 * and duplicate model load time, so we share one per process.
 */
async function getContext(): Promise<WhisperContext> {
  if (cachedContext) return cachedContext;
  if (inflightInit) return inflightInit;
  const rn = loadNativeModule();
  inflightInit = (async () => {
    const modelPath = await ensureWhisperModel();
    // whisper.rn expects a plain path without the `file://` scheme.
    const clean = modelPath.startsWith('file://')
      ? modelPath.slice(7)
      : modelPath;
    const ctx = await rn.initWhisper({ filePath: clean });
    cachedContext = ctx;
    return ctx;
  })();
  try {
    return await inflightInit;
  } finally {
    inflightInit = null;
  }
}

/**
 * Transcribes the audio at `audioPath` to Korean text. Hardcoded to
 * `language: 'ko'` because this app only supports Korean — we deliberately
 * avoid Whisper's automatic language detection, which can misidentify
 * short utterances.
 */
export async function transcribeAudio(audioPath: string): Promise<string> {
  const ctx = await getContext();
  const clean = audioPath.startsWith('file://') ? audioPath.slice(7) : audioPath;
  const { promise } = ctx.transcribe(clean, { language: 'ko' });
  const result = await promise;
  return (result?.result ?? '').trim();
}

/** Test hook — clears the cached context so the next call re-initializes. */
export async function __resetWhisperForTesting(): Promise<void> {
  if (cachedContext) {
    try {
      await cachedContext.release();
    } catch {
      // ignore
    }
  }
  cachedContext = null;
  inflightInit = null;
}
