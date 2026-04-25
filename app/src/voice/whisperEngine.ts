// On-device Whisper STT engine — wraps `whisper.rn` so the rest of the
// app deals with a plain `transcribe(audioPath)` async function and not
// the lower-level context lifecycle.
//
// Korean is forced via the language hint; without it, Whisper will
// occasionally pick the wrong language for short utterances and the
// transcript becomes nonsense the user has to retype.
//
// Fixture mode: when EXPO_PUBLIC_E2E_AUDIO_FIXTURE=1, this engine
// returns a canned transcript without touching whisper.rn. The Maestro
// E2E flows depend on this — Maestro can tap, but it cannot speak into
// a microphone.

import { ensureModel } from './modelManager';

const FIXTURE_TRANSCRIPT = '오늘 너의 작은 움직임이 처음 느껴졌어. 정말 신기했어.';

function isFixtureMode(): boolean {
  return process.env.EXPO_PUBLIC_E2E_AUDIO_FIXTURE === '1';
}

export type TranscribeOptions = {
  /** Locale hint. Defaults to ko. */
  language?: string;
  /** Per-call hard cap to bail out of a runaway decode. */
  timeoutMs?: number;
  /** AbortSignal to cancel a long-running transcription. */
  signal?: AbortSignal;
  /** Streaming partial callback — fires as the engine emits new tokens. */
  onPartial?: (text: string) => void;
};

export type TranscribeResult = {
  text: string;
  durationMs: number;
};

let cachedContext: unknown = null;

async function getContext(): Promise<unknown> {
  if (cachedContext) return cachedContext;
  const modelPath = await ensureModel();
  // `whisper.rn` is loaded lazily so unit/dev environments without the
  // native module don't crash at import time.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('whisper.rn');
  cachedContext = await mod.initWhisper({ filePath: modelPath });
  return cachedContext;
}

/**
 * Transcribes the given audio file path on-device. The returned text is
 * Korean by default and may be empty if the user said nothing.
 */
export async function transcribe(
  audioPath: string,
  opts: TranscribeOptions = {},
): Promise<TranscribeResult> {
  const start = Date.now();
  if (isFixtureMode()) {
    if (opts.onPartial) opts.onPartial(FIXTURE_TRANSCRIPT);
    return { text: FIXTURE_TRANSCRIPT, durationMs: 0 };
  }

  const ctx = (await getContext()) as {
    transcribe: (
      path: string,
      options: { language: string; onProgress?: (data: unknown) => void },
    ) => { promise: Promise<{ result: string }> };
  };

  const job = ctx.transcribe(audioPath, {
    language: opts.language ?? 'ko',
    onProgress: () => {
      // whisper.rn doesn't currently expose partial transcripts; this
      // hook is kept so the UI can show a heartbeat even without
      // intermediate text.
      if (opts.onPartial) opts.onPartial('');
    },
  });

  const timeoutMs = opts.timeoutMs ?? 60_000;
  const result = await Promise.race([
    job.promise,
    new Promise<{ result: string }>((_, reject) =>
      setTimeout(() => reject(new Error('transcribe timeout')), timeoutMs),
    ),
  ]);

  return {
    text: (result.result ?? '').trim(),
    durationMs: Date.now() - start,
  };
}
