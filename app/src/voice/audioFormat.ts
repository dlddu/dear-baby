// Audio format guard for the whisper STT pipeline.
//
// whisper.rn does NOT decode compressed audio — both the iOS and
// Android sides hand the file straight to a `decodeWaveFile` helper
// that strips a fixed 44-byte WAV header and reads the rest as
// little-endian 16-bit PCM samples. Feed it an m4a / AAC / mp3 and
// you don't get an error: you get garbage samples that look like
// silence to the model, and the transcript comes back empty (or
// nonsensical).
//
// That mismatch was the root cause of the "결과가 안나와요" bug.
// This module exists so:
//
//   1. The recorder side has a single source of truth for the
//      "what whisper.rn will actually accept" requirement.
//   2. transcribe() can fail loudly with a clear message instead of
//      handing a doomed file to whisper and watching it return "".
//   3. Tests can surface a regression the moment the recorder
//      configuration drifts back to a compressed format.

// Minimum bytes we need to inspect: 12 (RIFF/WAVE) + 24 (fmt chunk
// header + minimum body) = 36, plus 8 for the data chunk header
// brings us to whisper.rn's hardcoded 44-byte cut.
export const WAVE_HEADER_BYTES = 44;

export type WaveHeaderProblem =
  | 'too_short'
  | 'missing_riff'
  | 'missing_wave'
  | 'missing_fmt'
  | 'not_pcm'
  | 'not_16_bit';

export type WaveHeaderCheck =
  | { ok: true }
  | { ok: false; reason: WaveHeaderProblem; detail: string };

// checkWaveHeader inspects the first 44 bytes of an audio file and
// reports whether whisper.rn's naive decoder will be able to read
// it. We don't try to validate the data chunk size — whisper.rn
// doesn't either (it consumes "the rest of the file" past 44 bytes).
export function checkWaveHeader(bytes: Uint8Array): WaveHeaderCheck {
  if (bytes.length < WAVE_HEADER_BYTES) {
    return {
      ok: false,
      reason: 'too_short',
      detail: `expected at least ${WAVE_HEADER_BYTES} bytes, got ${bytes.length}`,
    };
  }
  // RIFF marker — first 4 bytes.
  if (!hasAscii(bytes, 0, 'RIFF')) {
    return {
      ok: false,
      reason: 'missing_riff',
      detail: `expected "RIFF" at offset 0, got ${asciiAt(bytes, 0, 4)}`,
    };
  }
  // WAVE marker — bytes 8..12. (Bytes 4..8 are the chunk size,
  // which we ignore.)
  if (!hasAscii(bytes, 8, 'WAVE')) {
    return {
      ok: false,
      reason: 'missing_wave',
      detail: `expected "WAVE" at offset 8, got ${asciiAt(bytes, 8, 4)}`,
    };
  }
  // Most encoders place the fmt chunk immediately after the WAVE
  // marker. We don't walk the chunk list — whisper.rn doesn't
  // either. If you've got a non-canonical layout you're already in
  // garbage-sample territory.
  if (!hasAscii(bytes, 12, 'fmt ')) {
    return {
      ok: false,
      reason: 'missing_fmt',
      detail: `expected "fmt " chunk at offset 12, got ${asciiAt(bytes, 12, 4)}`,
    };
  }
  // Audio format code at offset 20 (LE u16). PCM = 1.
  const audioFormat = readUint16LE(bytes, 20);
  if (audioFormat !== 1) {
    return {
      ok: false,
      reason: 'not_pcm',
      detail: `audio format code at offset 20 is ${audioFormat}, expected 1 (PCM)`,
    };
  }
  // Bits per sample at offset 34 (LE u16).
  const bitsPerSample = readUint16LE(bytes, 34);
  if (bitsPerSample !== 16) {
    return {
      ok: false,
      reason: 'not_16_bit',
      detail: `bitsPerSample at offset 34 is ${bitsPerSample}, expected 16`,
    };
  }
  return { ok: true };
}

// describeWaveProblem turns a check failure into a single-line
// message suitable for logging or wrapping in a thrown Error.
export function describeWaveProblem(check: WaveHeaderCheck): string | null {
  if (check.ok) return null;
  return `${check.reason}: ${check.detail}`;
}

function hasAscii(bytes: Uint8Array, offset: number, expected: string): boolean {
  if (offset + expected.length > bytes.length) return false;
  for (let i = 0; i < expected.length; i++) {
    if (bytes[offset + i] !== expected.charCodeAt(i)) return false;
  }
  return true;
}

function asciiAt(bytes: Uint8Array, offset: number, len: number): string {
  const end = Math.min(offset + len, bytes.length);
  let out = '';
  for (let i = offset; i < end; i++) {
    const b = bytes[i] ?? 0;
    out += b >= 32 && b < 127 ? String.fromCharCode(b) : `\\x${b.toString(16).padStart(2, '0')}`;
  }
  return JSON.stringify(out);
}

function readUint16LE(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] ?? 0) | ((bytes[offset + 1] ?? 0) << 8);
}
