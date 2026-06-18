/**
 * @jest-environment jsdom
 *
 * AudioContextOwner.test — locks the AudioContext state machine.
 *
 * Covers the pure, unit-testable logic of the shared-context authority:
 * - createAudioContext: creation + idempotency + creation-failure handling
 * - ensureAudioContextRunning: running short-circuit, suspended→resume,
 *   resume rejection (iOS interruption), no-context, closed-context
 *
 * Out of scope (requires a real device): WebKit `interrupted` transitions and
 * actual audio-session recovery — exercised on-device, not here.
 */

import { audioLog } from '@/utils/logger';

jest.mock('@/utils/logger', () => ({
  audioLog: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

/** Minimal AudioContext fake whose `state` and `resume()` behaviour each test controls. */
interface FakeAudioContext {
  state: string;
  resume: jest.Mock<Promise<void>, []>;
  createBuffer: jest.Mock;
  createBufferSource: jest.Mock;
  destination: unknown;
}

function installAudioContext(make: () => FakeAudioContext): jest.Mock {
  const ctor = jest.fn(make);
  (globalThis as unknown as { AudioContext: unknown }).AudioContext = ctor;
  return ctor;
}

function makeRunnableContext(initialState = 'running'): FakeAudioContext {
  const source = { buffer: null, connect: jest.fn(), start: jest.fn(), onended: null };
  return {
    state: initialState,
    resume: jest.fn(async () => undefined),
    createBuffer: jest.fn(() => ({})),
    createBufferSource: jest.fn(() => source),
    destination: {},
  };
}

/** Re-import the module fresh so its module-level singleton resets between tests. */
function loadOwner(): typeof import('../AudioContextOwner') {
  let mod!: typeof import('../AudioContextOwner');
  jest.isolateModules(() => {
    mod = require('../AudioContextOwner') as typeof import('../AudioContextOwner');
  });
  return mod;
}

afterEach(() => {
  jest.clearAllMocks();
  delete (globalThis as unknown as { AudioContext?: unknown }).AudioContext;
});

describe('createAudioContext', () => {
  it('creates and returns the AudioContext on first call', () => {
    const ctor = installAudioContext(() => makeRunnableContext());
    const owner = loadOwner();

    const ctx = owner.createAudioContext();

    expect(ctor).toHaveBeenCalledTimes(1);
    expect(ctx).not.toBeNull();
    expect(owner.getAudioContext()).toBe(ctx);
  });

  it('is idempotent: reuses the existing context on subsequent calls', () => {
    const ctor = installAudioContext(() => makeRunnableContext());
    const owner = loadOwner();

    const first = owner.createAudioContext();
    const second = owner.createAudioContext();

    expect(ctor).toHaveBeenCalledTimes(1);
    expect(second).toBe(first);
  });

  it('returns null and warns when AudioContext construction throws', () => {
    installAudioContext(() => {
      throw new Error('not allowed outside gesture');
    });
    const owner = loadOwner();

    expect(owner.createAudioContext()).toBeNull();
    expect(owner.getAudioContext()).toBeNull();
    expect(audioLog.warn).toHaveBeenCalled();
  });

  it('warns but does not throw when the initial resume() rejects', async () => {
    installAudioContext(() => {
      const c = makeRunnableContext();
      c.resume = jest.fn(async () => {
        throw new Error('Failed to start the audio device');
      });
      return c;
    });
    const owner = loadOwner();

    expect(() => owner.createAudioContext()).not.toThrow();
    await Promise.resolve();
    expect(audioLog.warn).toHaveBeenCalled();
  });
});

describe('ensureAudioContextRunning', () => {
  it('returns false when no context exists yet', async () => {
    const owner = loadOwner();
    await expect(owner.ensureAudioContextRunning()).resolves.toBe(false);
  });

  it('returns true without calling resume() when already running', async () => {
    installAudioContext(() => makeRunnableContext('running'));
    const owner = loadOwner();
    const ctx = owner.createAudioContext() as unknown as FakeAudioContext;
    ctx.resume.mockClear();

    await expect(owner.ensureAudioContextRunning()).resolves.toBe(true);
    expect(ctx.resume).not.toHaveBeenCalled();
  });

  it('resumes a suspended context and returns true when it reaches running', async () => {
    installAudioContext(() => makeRunnableContext('suspended'));
    const owner = loadOwner();
    const ctx = owner.createAudioContext() as unknown as FakeAudioContext;
    ctx.resume.mockClear();
    ctx.resume.mockImplementation(async () => {
      ctx.state = 'running';
    });

    await expect(owner.ensureAudioContextRunning()).resolves.toBe(true);
    expect(ctx.resume).toHaveBeenCalledTimes(1);
  });

  it('returns false when resume() leaves the context not running', async () => {
    installAudioContext(() => makeRunnableContext('suspended'));
    const owner = loadOwner();
    const ctx = owner.createAudioContext() as unknown as FakeAudioContext;
    ctx.resume.mockClear();
    // resume resolves but state stays suspended (e.g. lingering interruption)
    ctx.resume.mockImplementation(async () => undefined);

    await expect(owner.ensureAudioContextRunning()).resolves.toBe(false);
  });

  it('returns false and warns when resume() rejects (iOS interruption)', async () => {
    installAudioContext(() => makeRunnableContext('suspended'));
    const owner = loadOwner();
    const ctx = owner.createAudioContext() as unknown as FakeAudioContext;
    ctx.resume.mockClear();
    ctx.resume.mockImplementation(async () => {
      throw new Error('Failed to start the audio device');
    });

    await expect(owner.ensureAudioContextRunning()).resolves.toBe(false);
    expect(audioLog.warn).toHaveBeenCalled();
  });

  it('returns false when the context is closed', async () => {
    installAudioContext(() => makeRunnableContext('closed'));
    const owner = loadOwner();
    owner.createAudioContext();

    await expect(owner.ensureAudioContextRunning()).resolves.toBe(false);
  });
});
