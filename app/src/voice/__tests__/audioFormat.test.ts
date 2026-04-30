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
  findWaveDataChunk,
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

// Builds a small WAV file in memory: canonical header, optional
// extra chunks before `data`, and `dataBytes` worth of PCM.
function buildWaveFile(opts: {
  sampleRate?: number;
  numChannels?: number;
  bitsPerSample?: number;
  pcm?: Uint8Array;
  // Extra chunks to insert between fmt and data, in order. Used to
  // simulate AVAudioRecorder's JUNK / FLLR padding.
  extraChunks?: Array<{ id: string; payload: Uint8Array }>;
} = {}): Uint8Array {
  const sampleRate = opts.sampleRate ?? 16000;
  const numChannels = opts.numChannels ?? 1;
  const bitsPerSample = opts.bitsPerSample ?? 16;
  const pcm = opts.pcm ?? new Uint8Array(0);
  const extraChunks = opts.extraChunks ?? [];

  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;

  const fmtBody = 16;
  let extraSize = 0;
  for (const c of extraChunks) {
    extraSize += 8 + c.payload.length + (c.payload.length & 1);
  }
  const dataSize = pcm.length;
  const totalDataChunkSize = 8 + dataSize;
  const riffPayloadSize = 4 /* WAVE */ + 8 + fmtBody + extraSize + totalDataChunkSize;

  const total = 8 /* RIFF + size */ + riffPayloadSize;
  const buf = new Uint8Array(total);
  const dv = new DataView(buf.buffer);

  let off = 0;
  // RIFF header
  buf.set([0x52, 0x49, 0x46, 0x46], off); off += 4; // 'RIFF'
  dv.setUint32(off, riffPayloadSize, true); off += 4;
  buf.set([0x57, 0x41, 0x56, 0x45], off); off += 4; // 'WAVE'

  // fmt chunk
  buf.set([0x66, 0x6d, 0x74, 0x20], off); off += 4; // 'fmt '
  dv.setUint32(off, fmtBody, true); off += 4;
  dv.setUint16(off, 1, true); off += 2; // PCM
  dv.setUint16(off, numChannels, true); off += 2;
  dv.setUint32(off, sampleRate, true); off += 4;
  dv.setUint32(off, byteRate, true); off += 4;
  dv.setUint16(off, blockAlign, true); off += 2;
  dv.setUint16(off, bitsPerSample, true); off += 2;

  for (const chunk of extraChunks) {
    for (let i = 0; i < chunk.id.length; i++) {
      buf[off + i] = chunk.id.charCodeAt(i);
    }
    off += 4;
    dv.setUint32(off, chunk.payload.length, true); off += 4;
    buf.set(chunk.payload, off);
    off += chunk.payload.length + (chunk.payload.length & 1);
  }

  // data chunk
  buf.set([0x64, 0x61, 0x74, 0x61], off); off += 4; // 'data'
  dv.setUint32(off, dataSize, true); off += 4;
  buf.set(pcm, off);

  return buf;
}

describe('findWaveDataChunk — canonical layout', () => {
  it('reports a 44-byte data offset for a textbook PCM WAV', () => {
    const pcm = new Uint8Array(64);
    for (let i = 0; i < pcm.length; i++) pcm[i] = i & 0xff;
    const wav = buildWaveFile({ pcm });
    const result = findWaveDataChunk(wav);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.dataOffset).toBe(44);
      expect(result.dataSize).toBe(64);
      expect(result.sampleRate).toBe(16000);
      expect(result.numChannels).toBe(1);
      expect(result.bitsPerSample).toBe(16);
    }
  });
});

describe('findWaveDataChunk — AVAudioRecorder-style variants', () => {
  // The bug we're protecting against: AVAudioRecorder on iOS
  // sometimes inserts a JUNK / FLLR padding chunk between `fmt` and
  // `data`, pushing the PCM offset well past 44. whisper.rn's hard
  // 44-byte cut then reads into the JUNK payload, shifting every
  // subsequent 16-bit sample by half a byte and producing the
  // `[한국어의 한국어]` hallucination. The locator must find the
  // real `data` chunk regardless.
  it('skips a JUNK pad chunk and reports the correct PCM offset', () => {
    const junk = new Uint8Array(28); // arbitrary, even-aligned
    const pcm = new Uint8Array(32);
    pcm.fill(0xab);
    const wav = buildWaveFile({
      pcm,
      extraChunks: [{ id: 'JUNK', payload: junk }],
    });
    const result = findWaveDataChunk(wav);
    expect(result.ok).toBe(true);
    if (result.ok) {
      // Header (12) + fmt header (8) + fmt body (16) + JUNK header
      // (8) + JUNK payload (28) + data header (8) = 80 bytes before
      // PCM samples.
      expect(result.dataOffset).toBe(80);
      expect(result.dataSize).toBe(32);
    }
  });

  it('handles an odd-sized chunk + RIFF pad byte without misaligning the data offset', () => {
    // RIFF requires chunks to be word-aligned: a chunk with an odd
    // payload has a single pad byte appended before the next chunk
    // header. Off-by-one here is exactly what produces the
    // half-sample shift that whispers [한국어의 한국어].
    const oddJunk = new Uint8Array(7);
    const pcm = new Uint8Array(16);
    const wav = buildWaveFile({
      pcm,
      extraChunks: [{ id: 'FLLR', payload: oddJunk }],
    });
    const result = findWaveDataChunk(wav);
    expect(result.ok).toBe(true);
    if (result.ok) {
      // 12 + 8 + 16 + 8 + 7 + 1 (pad) + 8 = 60.
      expect(result.dataOffset).toBe(60);
    }
  });

  it('walks past multiple non-data chunks (LIST + JUNK)', () => {
    const wav = buildWaveFile({
      pcm: new Uint8Array(8),
      extraChunks: [
        { id: 'LIST', payload: new Uint8Array(20) },
        { id: 'JUNK', payload: new Uint8Array(12) },
      ],
    });
    const result = findWaveDataChunk(wav);
    expect(result.ok).toBe(true);
    if (result.ok) {
      // 12 + 8 + 16 + 8 + 20 + 8 + 12 + 8 = 92.
      expect(result.dataOffset).toBe(92);
      expect(result.dataSize).toBe(8);
    }
  });
});

describe('findWaveDataChunk — failure modes', () => {
  it('reports no_data_chunk when fmt is present but data is missing', () => {
    // RIFF + WAVE + fmt + a JUNK chunk that fills the remaining
    // space, with no data chunk anywhere. checkWaveHeader needs at
    // least 44 bytes to pass its initial sanity check, so we leave
    // enough room.
    const buf = new Uint8Array(60);
    const dv = new DataView(buf.buffer);
    buf.set([0x52, 0x49, 0x46, 0x46], 0); // RIFF
    dv.setUint32(4, 52, true);
    buf.set([0x57, 0x41, 0x56, 0x45], 8); // WAVE
    buf.set([0x66, 0x6d, 0x74, 0x20], 12); // fmt
    dv.setUint32(16, 16, true);
    dv.setUint16(20, 1, true); // PCM
    dv.setUint16(22, 1, true);
    dv.setUint32(24, 16000, true);
    dv.setUint32(28, 32000, true);
    dv.setUint16(32, 2, true);
    dv.setUint16(34, 16, true);
    // JUNK chunk filling the rest — no `data` chunk present.
    buf.set([0x4a, 0x55, 0x4e, 0x4b], 36);
    dv.setUint32(40, 16, true);
    const result = findWaveDataChunk(buf);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('no_data_chunk');
    }
  });

  it('reports truncated_chunk when data length lies about its size', () => {
    const wav = buildWaveFile({ pcm: new Uint8Array(8) });
    // Tamper with the data chunk size field (offset 40 in canonical
    // layout) so it claims more bytes than the file actually has.
    const dv = new DataView(wav.buffer);
    dv.setUint32(40, 9999, true);
    const result = findWaveDataChunk(wav);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('truncated_chunk');
    }
  });

  it('inherits the canonical header errors so callers see one consistent reason', () => {
    const m4a = new Uint8Array(WAVE_HEADER_BYTES);
    for (let i = 0; i < 4; i++) m4a[i + 4] = 'ftyp'.charCodeAt(i);
    const result = findWaveDataChunk(m4a);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('missing_riff');
    }
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
