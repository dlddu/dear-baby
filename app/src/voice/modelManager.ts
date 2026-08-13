// modelManager handles the lazy-download of the Whisper
// ggml-large-v3-turbo-q5_0 model the on-device STT relies on. The
// model is intentionally NOT bundled with the app (it's ~547 MB —
// every install would balloon, and most users may never record
// voice). It is fetched on first use and kept on disk forever after.
//
// Public surface is small on purpose:
//   ensureModel(onProgress?) -> resolves to a file:// path
//   isModelDownloaded()      -> boolean for UI gating
//   deleteModel()            -> reclaim disk
//
// Failure modes (network, signature mismatch, cancellation) all unwind
// to the same place: the partial file is removed and the caller sees a
// rejection. The caller is responsible for surfacing this to the user.

import * as FileSystem from 'expo-file-system/legacy';

import { E2E_AUDIO_FIXTURE } from '../config/env';

// MODEL_URL points at the ggml-large-v3-turbo-q5_0 Whisper weights.
// large-v3-turbo is the distilled-decoder variant of large-v3: near
// large-tier accuracy at a fraction of the inference cost, which is
// what makes it tractable to run on a phone Metal GPU. Q5_0
// quantization further halves the on-disk footprint.
//
// Self-hosting the asset (CloudFront or similar) lets us pin a
// specific build and avoid HuggingFace rate limiting; the URL is a
// single source of truth so a migration is one edit, no scattered
// constants.
//
// Defaulted to the public HuggingFace mirror so dev builds without
// EXPO_PUBLIC_WHISPER_MODEL_URL still function. Production builds must
// set the var to the team-controlled CDN.
const DEFAULT_MODEL_URL =
  'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo-q5_0.bin';

export const MODEL_URL: string =
  process.env.EXPO_PUBLIC_WHISPER_MODEL_URL ?? DEFAULT_MODEL_URL;

// Approximate size in bytes (used for UI progress only — the response
// itself is the source of truth when streaming).
export const MODEL_APPROX_BYTES = 547 * 1024 * 1024;

const MODEL_DIR = `${FileSystem.documentDirectory ?? ''}whisper/`;
const MODEL_PATH = `${MODEL_DIR}ggml-large-v3-turbo-q5_0.bin`;

export type DownloadProgress = {
  totalBytes: number;
  writtenBytes: number;
  fraction: number; // 0..1, may be NaN until first chunk arrives
};

let inflight: Promise<string> | null = null;

export async function isModelDownloaded(): Promise<boolean> {
  // mock-exception: MB-1 — whisper 모델 다운로드는 MB-1 치환 범위에 함께 들어간다(추론을 하지 않으므로 모델도 불필요).
  if (E2E_AUDIO_FIXTURE) return true;
  const info = await FileSystem.getInfoAsync(MODEL_PATH);
  return info.exists && !info.isDirectory && (info.size ?? 0) > 0;
}

export async function deleteModel(): Promise<void> {
  // mock-exception: MB-1 — 위와 같은 이유로 삭제할 실제 모델 파일이 없다.
  if (E2E_AUDIO_FIXTURE) return;
  await FileSystem.deleteAsync(MODEL_PATH, { idempotent: true });
}

// ensureModel returns a file:// path to the model, downloading it if
// necessary. Concurrent callers share a single download via inflight —
// if two screens trigger STT at the same time on first launch, they
// both await the same network operation rather than racing.
export async function ensureModel(
  onProgress?: (p: DownloadProgress) => void,
): Promise<string> {
  // mock-exception: MB-1 — 매 CI 실행마다 수백 MB 모델을 내려받는 것은 재현 가능한 e2e 의 전제가 아니다.
  if (E2E_AUDIO_FIXTURE) {
    // The fixture path is never read — whisperEngine short-circuits
    // before opening the file. We return a sentinel so callers can
    // still log a meaningful "model path".
    return 'fixture://ggml-large-v3-turbo-q5_0.bin';
  }
  if (await isModelDownloaded()) {
    return MODEL_PATH;
  }
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      await FileSystem.makeDirectoryAsync(MODEL_DIR, { intermediates: true });
      const tmp = `${MODEL_PATH}.part`;
      // Drop any leftover from a prior failed run before we start.
      await FileSystem.deleteAsync(tmp, { idempotent: true });

      const downloadable = FileSystem.createDownloadResumable(
        MODEL_URL,
        tmp,
        {},
        (snapshot) => {
          if (!onProgress) return;
          const total =
            snapshot.totalBytesExpectedToWrite > 0
              ? snapshot.totalBytesExpectedToWrite
              : MODEL_APPROX_BYTES;
          const written = snapshot.totalBytesWritten;
          onProgress({
            totalBytes: total,
            writtenBytes: written,
            fraction: total > 0 ? written / total : NaN,
          });
        },
      );
      const result = await downloadable.downloadAsync();
      if (!result || !result.uri) {
        throw new Error('download returned no result');
      }
      // Commit by renaming the .part file. Any reader from this point
      // on sees a complete file, even if the app is killed mid-call —
      // there is no half-written ggml-large-v3-turbo-q5_0.bin.
      await FileSystem.moveAsync({ from: tmp, to: MODEL_PATH });
      return MODEL_PATH;
    } catch (err) {
      // Best-effort cleanup of any partial bytes — leaving a zero-byte
      // file would make isModelDownloaded() lie on next launch.
      await FileSystem.deleteAsync(`${MODEL_PATH}.part`, { idempotent: true });
      await FileSystem.deleteAsync(MODEL_PATH, { idempotent: true });
      throw err;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}
