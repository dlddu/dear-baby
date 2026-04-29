// Tests for the WAV header guard. The interesting cases are the
// ones we hit in the wild:
//
//   - A real WAV produced by an iOS LINEARPCM recorder (passes).
//   - An m4a / AAC file produced by expo-audio's HIGH_QUALITY
//     preset (fails — this is the bug that swallowed transcripts).
//   - An empty / truncated file (fails fast before whisper runs).
//
// Construction note: we hand-assemble a 44-byte canonical WAV
// header rather than reading a fixture file. That keeps the test
// pure and avoids smuggling a binary blob into the repo.

import {
  WAVE_HEADER_BYTES,
  checkWaveHeader,
  describeWaveProblem,
} from '../audioFormat';

// Builds a canonical 44-byte WAV header for the given format
// parameters. Mirrors the layout whisper.rn's decoder assumes.
function buildWaveHeader(opts: {
  audioFormat?: number; // 1 = PCM
  numChannels?: number;
  sampleRate?: number;
  bitsPerSample?: number;
  dataSize?: number;
} = {}): Uint8Array {
  const audioFormat = opts.audioFormat ?? 1;
  const numChannels = opts.numChannels ?? 1;
  const sampleRate = opts.sampleRate ?? 16000;
  const bitsPerSample = opts.bitsPerSample ?? 16;
  const dataSize = opts.dataSize ?? 0;

  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;

  const bytes = new Uint8Array(WAVE_HEADER_BYTES);
  const dv = new DataView(bytes.buffer);

  // RIFF chunk header
  writeAscii(bytes, 0, 'RIFF');
  dv.setUint32(4, 36 + dataSize, true);
  writeAscii(bytes, 8, 'WAVE');

  // fmt sub-chunk
  writeAscii(bytes, 12, 'fmt ');
  dv.setUint32(16, 16, true); // sub-chunk size for PCM
  dv.setUint16(20, audioFormat, true);
  dv.setUint16(22, numChannels, true);
  dv.setUint32(24, sampleRate, true);
  dv.setUint32(28, byteRate, true);
  dv.setUint16(32, blockAlign, true);
  dv.setUint16(34, bitsPerSample, true);

  // data sub-chunk header
  writeAscii(bytes, 36, 'data');
  dv.setUint32(40, dataSize, true);

  return bytes;
}

function writeAscii(bytes: Uint8Array, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) bytes[offset + i] = str.charCodeAt(i);
}

describe('checkWaveHeader — canonical accept', () => {
  it('accepts a 16 kHz mono 16-bit PCM WAV header (whisper.rn baseline)', () => {
    const header = buildWaveHeader();
    expect(checkWaveHeader(header)).toEqual({ ok: true });
  });

  it('accepts stereo 44.1 kHz 16-bit PCM (the iOS LINEARPCM default)', () => {
    const header = buildWaveHeader({
      numChannels: 2,
      sampleRate: 44100,
    });
    // whisper.rn's decoder tolerates either; the engine's downstream
    // resampler handles rate conversion. The format guard only cares
    // about PCM-16.
    expect(checkWaveHeader(header)).toEqual({ ok: true });
  });
});

describe('checkWaveHeader — rejects non-WAV inputs', () => {
  it('rejects a buffer too short to even hold a header', () => {
    const tiny = new Uint8Array(20);
    const result = checkWaveHeader(tiny);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('too_short');
      expect(result.detail).toContain('20');
    }
  });

  it('rejects an empty buffer (zero-byte file from a failed recorder)', () => {
    const empty = new Uint8Array(0);
    const result = checkWaveHeader(empty);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('too_short');
  });

  // m4a / AAC files start with an `ftyp` box at offset 4. Bytes 0-3
  // hold the box size (a big-endian u32). The first 12 bytes for an
  // ISO-base-media-format file therefore look like:
  //   00 00 00 20 66 74 79 70 4d 34 41 20 ...
  //                    f  t  y  p  M  4  A
  // Whisper.rn's decoder will skip 44 bytes blindly and try to read
  // the AAC payload as PCM samples. The guard must catch this.
  it('rejects an m4a file (this is the bug whisper.rn used to swallow)', () => {
    const m4a = new Uint8Array(WAVE_HEADER_BYTES + 8);
    // box size
    m4a[3] = 0x20;
    // 'ftyp'
    writeAscii(m4a, 4, 'ftyp');
    // major brand 'M4A '
    writeAscii(m4a, 8, 'M4A ');

    const result = checkWaveHeader(m4a);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('missing_riff');
      // The detail must include the offending prefix so a dev
      // tailing logs sees "this looks like an mp4-family file" at a
      // glance — the size box at offset 0 ends with the ASCII space
      // (0x20) that precedes "ftyp", which is the giveaway.
      expect(result.detail).toContain('expected "RIFF" at offset 0');
      expect(result.detail).toContain('\\x00');
    }
  });

  it('rejects a RIFF wrapper that isn\'t a WAVE (e.g. AVI / WEBP)', () => {
    const header = buildWaveHeader();
    writeAscii(header, 8, 'AVI ');
    const result = checkWaveHeader(header);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('missing_wave');
  });

  it('rejects a WAV whose first sub-chunk is not "fmt "', () => {
    const header = buildWaveHeader();
    // Some encoders interleave a JUNK / LIST chunk before fmt; we
    // refuse those too because the downstream cuts at byte 44.
    writeAscii(header, 12, 'LIST');
    const result = checkWaveHeader(header);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('missing_fmt');
  });

  it('rejects a non-PCM WAV (e.g. ADPCM, IEEE float, A-law)', () => {
    // Format code 3 = IEEE float, 6 = A-law, 17 = IMA ADPCM.
    const header = buildWaveHeader({ audioFormat: 3 });
    const result = checkWaveHeader(header);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('not_pcm');
      expect(result.detail).toContain('3');
    }
  });

  it('rejects an 8-bit PCM WAV — whisper.rn assumes 16-bit', () => {
    const header = buildWaveHeader({ bitsPerSample: 8 });
    const result = checkWaveHeader(header);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('not_16_bit');
      expect(result.detail).toContain('8');
    }
  });

  it('rejects a 32-bit float WAV (rare but possible from expo-audio with linearPCMIsFloat)', () => {
    const header = buildWaveHeader({ bitsPerSample: 32 });
    const result = checkWaveHeader(header);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('not_16_bit');
  });
});

describe('describeWaveProblem', () => {
  it('returns null for a valid header so callers can short-circuit', () => {
    const header = buildWaveHeader();
    expect(describeWaveProblem(checkWaveHeader(header))).toBeNull();
  });

  it('returns a single-line "<reason>: <detail>" message for failures', () => {
    const m4a = new Uint8Array(WAVE_HEADER_BYTES);
    writeAscii(m4a, 4, 'ftyp');
    const msg = describeWaveProblem(checkWaveHeader(m4a));
    expect(msg).toMatch(/^missing_riff:/);
    expect(msg).not.toContain('\n');
  });
});
