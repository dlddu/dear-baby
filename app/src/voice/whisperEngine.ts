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

import { E2E_AUDIO_FIXTURE } from '../config/env';
import { ensureModel } from './modelManager';

// initWhisper is the only symbol whisper.rn exports we need. We keep
// the full type loose to avoid a hard import — the cost of `any` is
// confined to this module.
type WhisperContext = {
  transcribe: (
    audio: string,
    opts: { language?: string; maxLen?: number; tokenTimestamps?: boolean },
  ) => { promise: Promise<{ result: string }> };
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
  // We deliberately don't pass `maxLen` here. whisper.rn's `maxLen`
  // option caps the *segment text length in characters*, not wall
  // time as the previous comment claimed; setting it to the
  // recording-duration-in-seconds value (60) was a no-op at best
  // and cut Korean segments mid-sentence at worst. The recorder
  // already caps audio to 60s (record-audio.tsx MAX_RECORDING_MS),
  // so wall-time runaway is bounded upstream.
  const { promise } = c.transcribe(audioPath, {
    language: options.language ?? 'ko',
    tokenTimestamps: false,
  });
  const result = await promise;
  return (result?.result ?? '').trim();
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
