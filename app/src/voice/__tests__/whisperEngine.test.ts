// Integration tests for whisperEngine. The native whisper.rn module
// can't be loaded in node, so we mock it at the require boundary the
// way the production code consumes it (dynamic require). Each test
// re-imports the module via jest.isolateModules so the
// module-level `ctx` / `loading` singletons start clean.
//
// What we're protecting against — chronologically, in order of how
// these bugs surfaced in the wild:
//
//   1. The wrapper accidentally returns the `{result, segments,
//      isAborted}` envelope instead of the transcript string. (The
//      review screen would then render "[object Object]".)
//   2. Multiple transcribes re-init the model each call. (466 MB
//      ggml-small.bin → re-load on every record was a 3-5s stall.)
//   3. Two screens transcribing concurrently double-init. (We had a
//      crash from two whisper contexts holding the same backend.)
//   4. The fixture flag accidentally falls through to whisper.rn.
//      (The Maestro voice flow would deadlock waiting for a model
//      that isn't on the CI emulator.)
//   5. release() leaves the singleton populated, so the next
//      transcribe uses a freed context and segfaults.
//   6. Empty / null whisper output crashes the trim() chain.

// `jest` is provided as a global by jest-expo; using the global lets
// us interop with the test-renderer mocks the preset registers
// without import-cycle headaches. The mock typings vary across jest
// versions so we keep the test-side mock types deliberately loose —
// the assertions below check shape at runtime.

type LoadedModule = typeof import('../whisperEngine');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyMock = jest.Mock<any, any>;

type WhisperRnMock = {
  initWhisper: AnyMock;
};

type ModelManagerMock = {
  ensureModel: AnyMock;
};

type EnvMock = {
  E2E_AUDIO_FIXTURE: boolean;
};

beforeEach(() => {
  // Drop the module registry between tests so the singletons inside
  // whisperEngine (ctx, loading) and the doMock factories don't leak
  // across cases. isolateModules() is per-block; resetModules() is
  // per-test, and we need both for tight isolation.
  jest.resetModules();
});

// Builds a fresh module graph with the stated mocks. Returns the
// imported whisperEngine plus handles to the mocks so each test can
// drive them. Using isolateModules keeps the module-level
// singletons (ctx / loading) scoped to a single test.
function loadWhisperEngine(opts: {
  fixture?: boolean;
  initWhisper?: WhisperRnMock['initWhisper'];
  ensureModel?: ModelManagerMock['ensureModel'];
} = {}): {
  whisperEngine: LoadedModule;
  whisperRn: WhisperRnMock;
  modelManager: ModelManagerMock;
  env: EnvMock;
} {
  const env: EnvMock = { E2E_AUDIO_FIXTURE: opts.fixture ?? false };
  const whisperRn: WhisperRnMock = {
    initWhisper: opts.initWhisper ?? jest.fn(),
  };
  const modelManager: ModelManagerMock = {
    ensureModel: opts.ensureModel ?? jest.fn(),
  };

  let whisperEngine!: LoadedModule;
  jest.isolateModules(() => {
    jest.doMock('../../config/env', () => env);
    jest.doMock('../modelManager', () => modelManager);
    // whisper.rn is a native-only RN package and can't be resolved
    // under Jest's node environment, so we register it as a virtual
    // module — the engine consumes it via `require('whisper.rn')`.
    jest.doMock('whisper.rn', () => whisperRn, { virtual: true });
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    whisperEngine = require('../whisperEngine');
  });
  return { whisperEngine, whisperRn, modelManager, env };
}

type FakeContext = {
  transcribe: AnyMock;
  release: AnyMock;
};

// Builds a stub WhisperContext that records its calls and resolves
// with `{ result }`. Optional `result` lets tests vary the output.
function makeContext(result = 'hello world'): FakeContext {
  const transcribe = jest.fn(() => ({
    promise: Promise.resolve({ result, segments: [], isAborted: false }),
  }));
  const release = jest.fn(async () => undefined);
  return { transcribe, release };
}

describe('whisperEngine.transcribe — fixture short-circuit', () => {
  it('returns the canned transcript without loading the model or whisper.rn', async () => {
    const ensureModel = jest.fn();
    const initWhisper = jest.fn();
    const { whisperEngine } = loadWhisperEngine({
      fixture: true,
      initWhisper,
      ensureModel,
    });

    const text = await whisperEngine.transcribe('/tmp/anything.m4a');

    // Maestro asserts the same exact substring; if this drifts the
    // E2E flow's "extendedWaitUntil: visible" times out.
    expect(text).toContain('오늘 아기가 처음으로');
    expect(ensureModel).not.toHaveBeenCalled();
    expect(initWhisper).not.toHaveBeenCalled();
  });
});

describe('whisperEngine.transcribe — happy path contract with whisper.rn', () => {
  it('initialises whisper with the model path returned by ensureModel', async () => {
    const ensureModel = jest.fn(async () => '/var/whisper/ggml-small.bin');
    const ctx = makeContext('머쓱이가 발로 찼어요');
    const initWhisper = jest.fn(async () => ctx);

    const { whisperEngine } = loadWhisperEngine({
      ensureModel,
      initWhisper,
    });

    await whisperEngine.transcribe('/cache/voice/rec.wav');

    expect(ensureModel).toHaveBeenCalledTimes(1);
    expect(initWhisper).toHaveBeenCalledTimes(1);
    expect(initWhisper).toHaveBeenCalledWith({
      filePath: '/var/whisper/ggml-small.bin',
    });
  });

  it('passes the audio path through to whisper.transcribe verbatim', async () => {
    const ctx = makeContext('hi');
    const { whisperEngine } = loadWhisperEngine({
      initWhisper: jest.fn(async () => ctx),
      ensureModel: jest.fn(async () => '/m.bin'),
    });

    await whisperEngine.transcribe('/cache/voice/rec.wav');
    expect(ctx.transcribe).toHaveBeenCalledTimes(1);
    expect(ctx.transcribe.mock.calls[0][0]).toBe('/cache/voice/rec.wav');
  });

  it('defaults language to "ko" and disables tokenTimestamps', async () => {
    const ctx = makeContext('안녕');
    const { whisperEngine } = loadWhisperEngine({
      initWhisper: jest.fn(async () => ctx),
      ensureModel: jest.fn(async () => '/m.bin'),
    });

    await whisperEngine.transcribe('/cache/voice/rec.wav');

    const opts = ctx.transcribe.mock.calls[0][1] as Record<string, unknown>;
    expect(opts.language).toBe('ko');
    expect(opts.tokenTimestamps).toBe(false);
  });

  it('does NOT pass maxLen — that field caps segments by character count and cut Korean output mid-sentence', async () => {
    // Regression guard. The previous implementation passed
    // `maxLen: 60` thinking it was a wallclock cap. whisper.rn's
    // `maxLen` is the *maximum segment text length in characters*
    // (see node_modules/whisper.rn/src/NativeRNWhisper.ts:17), so
    // 60 silently truncated Korean transcripts at 60 chars. The
    // recorder bounds wall-time to 60s upstream, so no field is
    // needed here.
    const ctx = makeContext('hi');
    const { whisperEngine } = loadWhisperEngine({
      initWhisper: jest.fn(async () => ctx),
      ensureModel: jest.fn(async () => '/m.bin'),
    });

    await whisperEngine.transcribe('/cache/voice/rec.wav');

    const opts = ctx.transcribe.mock.calls[0][1] as Record<string, unknown>;
    expect(opts).not.toHaveProperty('maxLen');
    expect(opts).not.toHaveProperty('maxLenSeconds');
  });

  it('honours an explicit language override', async () => {
    const ctx = makeContext('hi');
    const { whisperEngine } = loadWhisperEngine({
      initWhisper: jest.fn(async () => ctx),
      ensureModel: jest.fn(async () => '/m.bin'),
    });

    await whisperEngine.transcribe('/cache/voice/rec.wav', { language: 'en' });
    expect(
      (ctx.transcribe.mock.calls[0][1] as Record<string, unknown>).language,
    ).toBe('en');
  });

  it('returns the trimmed transcript text from result.result', async () => {
    // whisper.rn returns { result, segments, isAborted }. We must
    // unwrap to .result and trim leading/trailing whitespace whisper
    // sometimes prepends to Korean segments.
    const ctx = makeContext('  오늘 아기가 처음 발길질을 했어요  ');
    const { whisperEngine } = loadWhisperEngine({
      initWhisper: jest.fn(async () => ctx),
      ensureModel: jest.fn(async () => '/m.bin'),
    });

    const text = await whisperEngine.transcribe('/cache/rec.wav');
    expect(text).toBe('오늘 아기가 처음 발길질을 했어요');
  });

  it('returns an empty string when whisper produces no result text', async () => {
    // Silence / sub-VAD audio yields { result: '' }. The screen treats
    // an empty string as "let the user type"; a thrown error would
    // surface a confusing alert instead.
    const transcribe = jest.fn(() => ({
      promise: Promise.resolve({ result: '', segments: [], isAborted: false }),
    }));
    const ctx = { transcribe, release: jest.fn(async () => undefined) };
    const { whisperEngine } = loadWhisperEngine({
      initWhisper: jest.fn(async () => ctx),
      ensureModel: jest.fn(async () => '/m.bin'),
    });

    const text = await whisperEngine.transcribe('/cache/rec.wav');
    expect(text).toBe('');
  });

  it('tolerates a malformed whisper result without throwing', async () => {
    // Defensive: some early whisper.rn versions resolved with `null`
    // when the model rejected the audio. The wrapper must not blow
    // up the trim() chain.
    const transcribe = jest.fn(() => ({
      promise: Promise.resolve(null as unknown as { result: string }),
    }));
    const ctx = { transcribe, release: jest.fn(async () => undefined) };
    const { whisperEngine } = loadWhisperEngine({
      initWhisper: jest.fn(async () => ctx),
      ensureModel: jest.fn(async () => '/m.bin'),
    });

    await expect(whisperEngine.transcribe('/cache/rec.wav')).resolves.toBe('');
  });
});

describe('whisperEngine.transcribe — context lifecycle', () => {
  it('initialises whisper at most once across multiple transcribes', async () => {
    const ctx = makeContext('first');
    const initWhisper = jest.fn(async () => ctx);
    const ensureModel = jest.fn(async () => '/m.bin');
    const { whisperEngine } = loadWhisperEngine({
      initWhisper,
      ensureModel,
    });

    await whisperEngine.transcribe('/a.wav');
    await whisperEngine.transcribe('/b.wav');
    await whisperEngine.transcribe('/c.wav');

    expect(initWhisper).toHaveBeenCalledTimes(1);
    expect(ensureModel).toHaveBeenCalledTimes(1);
    expect(ctx.transcribe).toHaveBeenCalledTimes(3);
  });

  it('coalesces concurrent first-time loads into a single init', async () => {
    // Two screens calling transcribe() before the model has finished
    // loading must share the same in-flight promise — the alternative
    // is two whisper contexts holding the same model file.
    let resolveInit!: (ctx: ReturnType<typeof makeContext>) => void;
    const ctx = makeContext('hi');
    const initWhisper = jest.fn(
      () =>
        new Promise<typeof ctx>((resolve) => {
          resolveInit = resolve;
        }),
    );
    const { whisperEngine } = loadWhisperEngine({
      initWhisper,
      ensureModel: jest.fn(async () => '/m.bin'),
    });

    const a = whisperEngine.transcribe('/a.wav');
    const b = whisperEngine.transcribe('/b.wav');

    // getContext awaits ensureModel before calling initWhisper, so
    // we need to let the microtask queue drain past those awaits
    // before asserting. Two macroticks via setImmediate is enough
    // for ensureModel's resolved promise to settle and initWhisper
    // to be invoked exactly once.
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setImmediate(r));

    // Both calls are pending; init has not resolved yet, so it
    // should still have been invoked exactly once.
    expect(initWhisper).toHaveBeenCalledTimes(1);

    resolveInit(ctx);
    await Promise.all([a, b]);

    expect(initWhisper).toHaveBeenCalledTimes(1);
    expect(ctx.transcribe).toHaveBeenCalledTimes(2);
  });

  it('re-initialises after release() so the next transcribe loads a fresh context', async () => {
    const ctx1 = makeContext('first');
    const ctx2 = makeContext('second');
    const initWhisper = jest
      .fn()
      .mockResolvedValueOnce(ctx1)
      .mockResolvedValueOnce(ctx2);
    const { whisperEngine } = loadWhisperEngine({
      initWhisper,
      ensureModel: jest.fn(async () => '/m.bin'),
    });

    const first = await whisperEngine.transcribe('/a.wav');
    expect(first).toBe('first');
    expect(ctx1.release).not.toHaveBeenCalled();

    await whisperEngine.release();
    expect(ctx1.release).toHaveBeenCalledTimes(1);

    const second = await whisperEngine.transcribe('/b.wav');
    expect(second).toBe('second');
    expect(initWhisper).toHaveBeenCalledTimes(2);
  });

  it('release() is a no-op when no context has been created', async () => {
    const ctx = makeContext('x');
    const { whisperEngine } = loadWhisperEngine({
      initWhisper: jest.fn(async () => ctx),
      ensureModel: jest.fn(async () => '/m.bin'),
    });
    // Never called transcribe → release should not touch any context.
    await expect(whisperEngine.release()).resolves.toBeUndefined();
    expect(ctx.release).not.toHaveBeenCalled();
  });
});

describe('whisperEngine.transcribe — error paths', () => {
  it('propagates init errors so the screen can show "STT failed" UX', async () => {
    const initWhisper = jest.fn(async () => {
      throw new Error('model corrupt');
    });
    const { whisperEngine } = loadWhisperEngine({
      initWhisper,
      ensureModel: jest.fn(async () => '/m.bin'),
    });

    await expect(whisperEngine.transcribe('/a.wav')).rejects.toThrow(
      'model corrupt',
    );
  });

  it('does not cache a rejected init — the next call retries', async () => {
    // The screen-level retry path depends on this: if the first init
    // throws (e.g. model file missing on disk), the user re-records
    // and we need to give whisper a clean shot.
    const ctx = makeContext('ok');
    const initWhisper = jest
      .fn()
      .mockRejectedValueOnce(new Error('flaky'))
      .mockResolvedValueOnce(ctx);
    const { whisperEngine } = loadWhisperEngine({
      initWhisper,
      ensureModel: jest.fn(async () => '/m.bin'),
    });

    await expect(whisperEngine.transcribe('/a.wav')).rejects.toThrow('flaky');
    const second = await whisperEngine.transcribe('/b.wav');
    expect(second).toBe('ok');
    expect(initWhisper).toHaveBeenCalledTimes(2);
  });

  it('throws a useful error when whisper.rn is loaded but exports nothing', async () => {
    // Simulates a fast-refresh / managed-Expo-Go session where the
    // module loads but the native binding is absent. The error
    // message is what the UI surfaces, so it must be specific.
    let whisperEngine!: LoadedModule;
    jest.isolateModules(() => {
      jest.doMock('../../config/env', () => ({ E2E_AUDIO_FIXTURE: false }));
      jest.doMock('../modelManager', () => ({
        ensureModel: jest.fn(async () => '/m.bin'),
      }));
      jest.doMock('whisper.rn', () => ({}), { virtual: true });
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      whisperEngine = require('../whisperEngine');
    });

    await expect(whisperEngine.transcribe('/a.wav')).rejects.toThrow(
      /not linked/,
    );
  });

  it('propagates errors thrown by ctx.transcribe', async () => {
    const transcribe = jest.fn(() => ({
      promise: Promise.reject(new Error('audio decode failed')),
    }));
    const ctx = { transcribe, release: jest.fn(async () => undefined) };
    const { whisperEngine } = loadWhisperEngine({
      initWhisper: jest.fn(async () => ctx),
      ensureModel: jest.fn(async () => '/m.bin'),
    });

    await expect(whisperEngine.transcribe('/a.wav')).rejects.toThrow(
      'audio decode failed',
    );
  });
});
