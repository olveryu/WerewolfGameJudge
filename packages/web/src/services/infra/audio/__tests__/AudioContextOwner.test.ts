/**
 * Locks the shared AudioContext state machine: creation, idempotency and creation failure,
 * plus running / suspended→resume / rejected-resume / closed handling. WebKit `interrupted`
 * transitions need a real device.
 */
import type { Mock } from 'vitest';

// Hoisted so every module instance loaded after `vi.resetModules()` logs to the same spies.
const audioLog = vi.hoisted(() => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));
vi.mock('@/utils/logger', () => ({ audioLog }));

interface FakeAudioContext {
  state: string;
  resume: Mock<() => Promise<void>>;
  createBuffer: Mock;
  createBufferSource: Mock;
  destination: unknown;
}

function makeContext(initialState = 'running'): FakeAudioContext {
  const source = { buffer: null, connect: vi.fn(), start: vi.fn(), onended: null };
  return {
    state: initialState,
    resume: vi.fn(async () => undefined),
    createBuffer: vi.fn(() => ({})),
    createBufferSource: vi.fn(() => source),
    destination: {},
  };
}

/** Installs a constructible AudioContext fake; `vi.fn` with a class body is `new`-able. */
function installAudioContext(make: () => FakeAudioContext) {
  const ctor = vi.fn(
    class {
      constructor() {
        return make();
      }
    },
  );
  vi.stubGlobal('AudioContext', ctor);
  return ctor;
}

/** Fresh module instance so its module-level singleton resets between tests. */
async function loadOwner() {
  vi.resetModules();
  return import('../AudioContextOwner');
}

async function createFakeContext(initialState: string) {
  installAudioContext(() => makeContext(initialState));
  const owner = await loadOwner();
  const ctx = owner.createAudioContext() as unknown as FakeAudioContext;
  ctx.resume.mockClear();
  return { owner, ctx };
}

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe('createAudioContext', () => {
  it('creates the context once and reuses it on later calls', async () => {
    const ctor = installAudioContext(() => makeContext());
    const owner = await loadOwner();

    const first = owner.createAudioContext();
    const second = owner.createAudioContext();

    expect(ctor).toHaveBeenCalledTimes(1);
    expect(first).not.toBeNull();
    expect(second).toBe(first);
    expect(owner.getAudioContext()).toBe(first);
  });

  it('returns null and warns when AudioContext construction throws', async () => {
    installAudioContext(() => {
      throw new Error('not allowed outside gesture');
    });
    const owner = await loadOwner();

    expect(owner.createAudioContext()).toBeNull();
    expect(owner.getAudioContext()).toBeNull();
    expect(audioLog.warn).toHaveBeenCalled();
  });

  it('warns but does not throw when the initial resume() rejects', async () => {
    installAudioContext(() => {
      const ctx = makeContext();
      ctx.resume = vi.fn(async () => {
        throw new Error('Failed to start the audio device');
      });
      return ctx;
    });
    const owner = await loadOwner();

    expect(() => owner.createAudioContext()).not.toThrow();
    await Promise.resolve();
    expect(audioLog.warn).toHaveBeenCalled();
  });
});

describe('ensureAudioContextRunning', () => {
  it('returns false when no context exists yet', async () => {
    const owner = await loadOwner();
    await expect(owner.ensureAudioContextRunning()).resolves.toBe(false);
  });

  it('returns true without calling resume() when already running', async () => {
    const { owner, ctx } = await createFakeContext('running');

    await expect(owner.ensureAudioContextRunning()).resolves.toBe(true);
    expect(ctx.resume).not.toHaveBeenCalled();
  });

  it('resumes a suspended context and returns true when it reaches running', async () => {
    const { owner, ctx } = await createFakeContext('suspended');
    ctx.resume.mockImplementation(async () => {
      ctx.state = 'running';
    });

    await expect(owner.ensureAudioContextRunning()).resolves.toBe(true);
    expect(ctx.resume).toHaveBeenCalledTimes(1);
  });

  it('returns false when resume() leaves the context not running', async () => {
    const { owner } = await createFakeContext('suspended');

    await expect(owner.ensureAudioContextRunning()).resolves.toBe(false);
  });

  it('returns false and warns when resume() rejects (iOS interruption)', async () => {
    const { owner, ctx } = await createFakeContext('suspended');
    ctx.resume.mockImplementation(async () => {
      throw new Error('Failed to start the audio device');
    });

    await expect(owner.ensureAudioContextRunning()).resolves.toBe(false);
    expect(audioLog.warn).toHaveBeenCalled();
  });

  it('returns false when the context is closed', async () => {
    const { owner } = await createFakeContext('closed');

    await expect(owner.ensureAudioContextRunning()).resolves.toBe(false);
  });
});
