/**
 * @jest-environment jsdom
 *
 * BgmPlayer.web.test — locks the Web (browser / WeChat web-view) BGM path.
 *
 * This is the app's primary platform (web-first + WeChat mini-program web-view),
 * so the AudioContext wiring, element reuse, and WeChat ArkWeb `timeupdate`
 * fallback are covered here with jsdom + fakes — no real device needed.
 *
 * Out of scope (real device only): whether WebKit actually routes audio and
 * whether `interrupted` recovery is audible.
 */

// Force the Web backend: BgmPlayer evaluates `Platform.OS === 'web'` at module load.
jest.mock('react-native', () => ({ Platform: { OS: 'web' } }));

// Avoid loading audio asset requires (audioRegistry pulls in every .mp3).
jest.mock('../audioRegistry', () => ({ BGM_VOLUME: 0.3 }));

// Factories must be self-contained (jest hoists them above const declarations);
// grab handles by re-importing the mocked modules.
jest.mock('@/utils/logger', () => ({
  audioLog: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock('../AudioContextOwner', () => ({
  getAudioContext: jest.fn(),
  ensureAudioContextRunning: jest.fn(),
  createAudioContext: jest.fn(),
}));
jest.mock('../webAudioUnlock', () => ({ getUnlockedBgmElement: jest.fn() }));

import { audioLog } from '@/utils/logger';

import { ensureAudioContextRunning, getAudioContext } from '../AudioContextOwner';
import { BgmPlayer } from '../BgmPlayer';
import { getUnlockedBgmElement } from '../webAudioUnlock';

const mockLog = audioLog as unknown as {
  debug: jest.Mock;
  info: jest.Mock;
  warn: jest.Mock;
  error: jest.Mock;
};
const mockGetAudioContext = getAudioContext as jest.Mock;
const mockEnsureRunning = ensureAudioContextRunning as jest.Mock;
const mockGetUnlockedBgmElement = getUnlockedBgmElement as jest.Mock;

const BGM_VOLUME = 0.3;

interface FakeGain {
  gain: { value: number };
  connect: jest.Mock;
}
interface FakeSource {
  connect: jest.Mock;
}
interface FakeCtx {
  state: string;
  destination: unknown;
  createGain: jest.Mock<FakeGain, []>;
  createMediaElementSource: jest.Mock<FakeSource, [unknown]>;
  close: jest.Mock;
  __gain: FakeGain;
}

interface FakeElement {
  src: string;
  loop: boolean;
  currentTime: number;
  duration: number;
  play: jest.Mock<Promise<void>, []>;
  pause: jest.Mock;
  load: jest.Mock;
  removeAttribute: jest.Mock;
  addEventListener: jest.Mock;
  removeEventListener: jest.Mock;
  emit: (event: string) => void;
}

function makeFakeCtx(state = 'running'): FakeCtx {
  const gain: FakeGain = { gain: { value: -1 }, connect: jest.fn() };
  return {
    state,
    destination: {},
    createGain: jest.fn(() => gain),
    createMediaElementSource: jest.fn((_audio: unknown) => ({ connect: jest.fn() })),
    close: jest.fn(),
    __gain: gain,
  };
}

function makeFakeElement(): FakeElement {
  const listeners: Record<string, Array<() => void>> = {};
  return {
    src: '',
    loop: false,
    currentTime: 0,
    duration: 100,
    play: jest.fn(() => Promise.resolve()),
    pause: jest.fn(),
    load: jest.fn(),
    removeAttribute: jest.fn(),
    addEventListener: jest.fn((event: string, handler: () => void) => {
      (listeners[event] ??= []).push(handler);
    }),
    removeEventListener: jest.fn((event: string, handler: () => void) => {
      listeners[event] = (listeners[event] ?? []).filter((h) => h !== handler);
    }),
    emit: (event: string) => {
      for (const handler of listeners[event] ?? []) handler();
    },
  };
}

let ctx: FakeCtx;
let element: FakeElement;

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  ctx = makeFakeCtx();
  element = makeFakeElement();
  mockGetAudioContext.mockReturnValue(ctx);
  mockEnsureRunning.mockResolvedValue(true);
  mockGetUnlockedBgmElement.mockReturnValue(element);
});

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

describe('BgmPlayer web — start()', () => {
  it('fails fast (logs error, does not play) when no shared AudioContext exists', async () => {
    mockGetAudioContext.mockReturnValue(null);
    const bgm = new BgmPlayer();

    await bgm.start(['track-a']);

    expect(mockLog.error).toHaveBeenCalled();
    expect(element.play).not.toHaveBeenCalled();
    expect(ctx.createMediaElementSource).not.toHaveBeenCalled();
  });

  it('wires GainNode + MediaElementSource and plays on first track', async () => {
    const bgm = new BgmPlayer();

    await bgm.start(['track-a']);

    expect(ctx.createGain).toHaveBeenCalledTimes(1);
    expect(ctx.__gain.connect).toHaveBeenCalledWith(ctx.destination);
    expect(ctx.createMediaElementSource).toHaveBeenCalledTimes(1);
    expect(ctx.createMediaElementSource).toHaveBeenCalledWith(element);
    expect(ctx.__gain.gain.value).toBe(BGM_VOLUME);
    expect(element.src).toBe('track-a');
    expect(element.play).toHaveBeenCalledTimes(1);
    expect(mockEnsureRunning).toHaveBeenCalled();
  });
});

describe('BgmPlayer web — track reuse (playlist)', () => {
  it('reuses the element across tracks instead of re-binding createMediaElementSource', async () => {
    const bgm = new BgmPlayer();
    await bgm.start(['track-a', 'track-b']);

    // First track bound the element↔source once.
    expect(ctx.createMediaElementSource).toHaveBeenCalledTimes(1);
    expect(element.play).toHaveBeenCalledTimes(1);

    // End the first track (playlist → `ended` advances to next).
    element.emit('ended');
    jest.advanceTimersByTime(2000); // inter-track gap timer

    // Second track must REUSE the element (swap src), not re-bind the source,
    // because createMediaElementSource() throws InvalidStateError on a re-bind.
    expect(ctx.createMediaElementSource).toHaveBeenCalledTimes(1);
    expect(element.play).toHaveBeenCalledTimes(2);
  });
});

describe('BgmPlayer web — resume()', () => {
  it('ensures the context is running and replays the element', async () => {
    const bgm = new BgmPlayer();
    await bgm.start(['track-a']);
    mockEnsureRunning.mockClear();
    element.play.mockClear();

    bgm.resume();

    expect(mockEnsureRunning).toHaveBeenCalledTimes(1);
    expect(element.play).toHaveBeenCalledTimes(1);
  });
});

describe('BgmPlayer web — stop()', () => {
  it('does not close the shared AudioContext (singleton must survive)', async () => {
    const bgm = new BgmPlayer();
    await bgm.start(['track-a']);

    bgm.stop();

    expect(ctx.close).not.toHaveBeenCalled();
    expect(element.pause).toHaveBeenCalled();
  });
});

describe('BgmPlayer web — WeChat ArkWeb timeupdate fallback', () => {
  it('loops a single track by seeking to 0 and replaying when `ended` is swallowed', async () => {
    const bgm = new BgmPlayer();
    await bgm.start(['track-a']); // single asset → loop mode

    // Simulate ArkWeb: `ended` never fires; currentTime reaches end via timeupdate.
    element.currentTime = element.duration - 0.1;
    element.emit('timeupdate');

    expect(element.currentTime).toBe(0);
    expect(element.play).toHaveBeenCalledTimes(2); // initial + loop replay
  });
});
