// Typed access to EXPO_PUBLIC_* environment variables. Only values prefixed
// with EXPO_PUBLIC_ are inlined into the JS bundle at build time — do not
// read anything else from process.env here.

export const API_URL: string =
  process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8080';

export const GOOGLE_IOS_CLIENT_ID: string =
  process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '';

export const GOOGLE_ANDROID_CLIENT_ID: string =
  process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? '';

export const GOOGLE_WEB_CLIENT_ID: string =
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '';

// URL of the Whisper GGML model file. `whisper.rn` expects a GGML-format
// model (`ggml-<size>.bin`) — the same format that the upstream OpenAI
// Whisper weights are distributed in via whisper.cpp. We default to the
// multilingual `tiny` model because it is small enough (~75 MB) to download
// on-demand and still handles Korean adequately. Apps that want higher
// accuracy can override this at build time with
// `EXPO_PUBLIC_WHISPER_MODEL_URL`.
export const WHISPER_MODEL_URL: string =
  process.env.EXPO_PUBLIC_WHISPER_MODEL_URL ??
  'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin';

// Filename used when caching the downloaded model in the document directory.
// Must be stable across launches so the app avoids re-downloading on every
// cold start.
export const WHISPER_MODEL_FILENAME: string =
  process.env.EXPO_PUBLIC_WHISPER_MODEL_FILENAME ?? 'ggml-tiny.bin';
