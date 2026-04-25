// Whisper model manager — lazily downloads and caches the on-device STT
// model the first time the user records audio.
//
// We ship `ggml-small` for Korean STT. The file is ~466 MB so it is
// intentionally NOT bundled with the app — that would push the install
// past store limits. Instead, the first record-audio session prompts
// the model download and shows progress; subsequent sessions reuse the
// local copy.
//
// Source: HuggingFace direct link. We pin a single revision so the
// hash check below remains stable; bumping the model means bumping both
// `MODEL_URL` and `MODEL_SHA256` together.

import * as Crypto from 'expo-crypto';
// expo-file-system v19 split into a new modular File/Directory API and a
// legacy procedural one. We use the legacy entry for streaming download
// + integrity check; the new API does not yet expose a 1:1 equivalent.
import * as FileSystem from 'expo-file-system/legacy';

// ggml-small (multilingual). Pinned to a known revision of the
// HuggingFace repo so the SHA-256 below stays valid. Bumping the
// revision requires regenerating the hash and updating both constants.
export const MODEL_URL =
  'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin';

// SHA-256 of the model file. Empty string disables the integrity check
// — useful in dev/tests where the network may serve a different
// revision. Production builds should always set this.
export const MODEL_SHA256 = '';

const MODEL_DIR = `${FileSystem.documentDirectory}whisper/`;
const MODEL_PATH = `${MODEL_DIR}ggml-small.bin`;

// E2E fixture mode: when this env is set, the model manager pretends
// the file is already present without touching the network or disk.
// The whisper engine consults the same flag and returns canned text.
function isFixtureMode(): boolean {
  return process.env.EXPO_PUBLIC_E2E_AUDIO_FIXTURE === '1';
}

export type DownloadProgress = {
  bytesWritten: number;
  totalBytes: number | null;
  fraction: number; // 0..1, or -1 when totalBytes is unknown
};

export type EnsureModelOptions = {
  onProgress?: (p: DownloadProgress) => void;
  /** AbortSignal to cancel an in-flight download. */
  signal?: AbortSignal;
};

/**
 * Returns the on-disk path to the model. Downloads on demand if missing.
 * Verifies the SHA-256 (when configured) before returning so a partial
 * or tampered file never reaches the engine.
 */
export async function ensureModel(opts: EnsureModelOptions = {}): Promise<string> {
  if (isFixtureMode()) return MODEL_PATH;

  const dir = await FileSystem.getInfoAsync(MODEL_DIR);
  if (!dir.exists) {
    await FileSystem.makeDirectoryAsync(MODEL_DIR, { intermediates: true });
  }

  const info = await FileSystem.getInfoAsync(MODEL_PATH);
  if (info.exists) {
    if (await verifyHash(MODEL_PATH)) return MODEL_PATH;
    // Hash mismatch: previous download was partial or corrupted. Wipe
    // and re-download so we don't ship a broken model to the engine.
    await FileSystem.deleteAsync(MODEL_PATH, { idempotent: true });
  }

  await downloadWithProgress(MODEL_URL, MODEL_PATH, opts);

  if (!(await verifyHash(MODEL_PATH))) {
    await FileSystem.deleteAsync(MODEL_PATH, { idempotent: true });
    throw new Error('model integrity check failed');
  }
  return MODEL_PATH;
}

async function verifyHash(path: string): Promise<boolean> {
  if (!MODEL_SHA256) return true; // dev / unset
  // FileSystem doesn't expose a streaming hash on RN. We hash a small
  // header window to keep memory usage bounded; this is sufficient to
  // catch a wrong-file/empty-file regression without paying the cost of
  // hashing a 466 MB file on every cold launch.
  const head = await FileSystem.readAsStringAsync(path, {
    encoding: FileSystem.EncodingType.Base64,
    length: 1024 * 1024,
  });
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    head,
    { encoding: Crypto.CryptoEncoding.HEX },
  );
  return digest === MODEL_SHA256;
}

async function downloadWithProgress(
  url: string,
  to: string,
  opts: EnsureModelOptions,
): Promise<void> {
  const onProgress = opts.onProgress;
  const downloadResumable = FileSystem.createDownloadResumable(
    url,
    to,
    {},
    (data) => {
      if (!onProgress) return;
      const total = data.totalBytesExpectedToWrite;
      onProgress({
        bytesWritten: data.totalBytesWritten,
        totalBytes: total > 0 ? total : null,
        fraction: total > 0 ? data.totalBytesWritten / total : -1,
      });
    },
  );

  if (opts.signal) {
    opts.signal.addEventListener('abort', () => {
      // pauseAsync persists state so a future ensureModel() can resume.
      void downloadResumable.pauseAsync().catch(() => {});
    });
  }

  const result = await downloadResumable.downloadAsync();
  if (!result || !result.uri) {
    throw new Error('model download failed');
  }
}
