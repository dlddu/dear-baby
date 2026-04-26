// modelManager handles the lazy-download of the Whisper ggml-small model
// the on-device STT relies on. The model is intentionally NOT bundled
// with the app (it's ~466 MB — every install would balloon, and most
// users may never record voice). It is fetched on first use and kept
// on disk forever after.
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

// MODEL_URL points at the ggml-small Whisper weights. Self-hosting the
// asset (CloudFront or similar) lets us pin a specific build and avoid
// HuggingFace rate limiting; the URL is a single source of truth so a
// migration is one edit, no scattered constants.
//
// Defaulted to the public HuggingFace mirror so dev builds without
// EXPO_PUBLIC_WHISPER_MODEL_URL still function. Production builds must
// set the var to the team-controlled CDN.
const DEFAULT_MODEL_URL =
  'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin';

export const MODEL_URL: string =
  process.env.EXPO_PUBLIC_WHISPER_MODEL_URL ?? DEFAULT_MODEL_URL;

// Approximate size in bytes (used for UI progress only — the response
// itself is the source of truth when streaming).
export const MODEL_APPROX_BYTES = 466 * 1024 * 1024;

const MODEL_DIR = `${FileSystem.documentDirectory ?? ''}whisper/`;
const MODEL_PATH = `${MODEL_DIR}ggml-small.bin`;

export type DownloadProgress = {
  totalBytes: number;
  writtenBytes: number;
  fraction: number; // 0..1, may be NaN until first chunk arrives
};

let inflight: Promise<string> | null = null;

export async function isModelDownloaded(): Promise<boolean> {
  if (E2E_AUDIO_FIXTURE) return true;
  const info = await FileSystem.getInfoAsync(MODEL_PATH);
  return info.exists && !info.isDirectory && (info.size ?? 0) > 0;
}

export async function deleteModel(): Promise<void> {
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
  if (E2E_AUDIO_FIXTURE) {
    // The fixture path is never read — whisperEngine short-circuits
    // before opening the file. We return a sentinel so callers can
    // still log a meaningful "model path".
    return 'fixture://ggml-small.bin';
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
      // there is no half-written ggml-small.bin.
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
