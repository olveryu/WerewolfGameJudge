/**
 * Locks the web BGM path: AudioContext wiring, element reuse across tracks, and the WeChat
 * ArkWeb `timeupdate` fallback, with fakes. Whether WebKit actually routes audio and whether
 * `interrupted` recovery is audible needs a real device.
 */
import type { Mock } from 'vitest';

import { audioLog } from '@/utils/logger';

import { ensureAudioContextRunning, getAudioContext } from '../AudioContextOwner';
import { BgmPlayer } from '../BgmPlayer';
import { getUnlockedBgmElement } from '../webAudioUnlock';

vi.mock('@/features/product/model/BgmCatalog', () => ({ BGM_VOLUME: 0.3 }));
vi.mock('@/utils/logger', () => ({
  audioLog: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('../AudioContextOwner', () => ({
  getAudioContext: vi.fn(),
  ensureAudioContextRunning: vi.fn(),
}));
vi.mock('../webAudioUnlock', () => ({ getUnlockedBgmElement: vi.fn() }));

const BGM_VOLUME = 0.3;

interface FakeGain {
  gain: { value: number };
  connect: Mock;
}

function makeFakeContext() {
  const gain: FakeGain = { gain: { value: -1 }, connect: vi.fn() };
  return {
    state: 'running',
    destination: {},
    createGain: vi.fn(() => gain),
    createMediaElementSource: vi.fn((_audio: unknown) => ({ connect: vi.fn() })),
    close: vi.fn(),
    gainNode: gain,
  };
}

function makeFakeElement() {
  const listeners: Record<string, Array<() => void>> = {};
  return {
    src: '',
    loop: false,
    currentTime: 0,
    duration: 100,
    play: vi.fn(() => Promise.resolve()),
    pause: vi.fn(),
    load: vi.fn(),
    removeAttribute: vi.fn(),
    addEventListener: vi.fn((event: string, handler: () => void) => {
      (listeners[event] ??= []).push(handler);
    }),
    removeEventListener: vi.fn((event: string, handler: () => void) => {
      listeners[event] = (listeners[event] ?? []).filter((h) => h !== handler);
    }),
    emit: (event: string) => {
      for (const handler of listeners[event] ?? []) handler();
    },
  };
}

let ctx: ReturnType<typeof makeFakeContext>;
let element: ReturnType<typeof makeFakeElement>;

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  ctx = makeFakeContext();
  element = makeFakeElement();
  vi.mocked(getAudioContext).mockReturnValue(ctx as unknown as AudioContext);
  vi.mocked(ensureAudioContextRunning).mockResolvedValue(true);
  vi.mocked(getUnlockedBgmElement).mockReturnValue(element as unknown as HTMLAudioElement);
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe('start()', () => {
  it('fails fast (logs error, does not play) when no shared AudioContext exists', () => {
    vi.mocked(getAudioContext).mockReturnValue(null);
    const bgm = new BgmPlayer();

    bgm.start(['track-a']);

    expect(audioLog.error).toHaveBeenCalled();
    expect(element.play).not.toHaveBeenCalled();
    expect(ctx.createMediaElementSource).not.toHaveBeenCalled();
  });

  it('throws when started without tracks', () => {
    expect(() => new BgmPlayer().start([])).toThrow('[FAIL-FAST]');
  });

  it('wires GainNode + MediaElementSource and plays on first track', () => {
    const bgm = new BgmPlayer();

    bgm.start(['track-a']);

    expect(ctx.createGain).toHaveBeenCalledTimes(1);
    expect(ctx.gainNode.connect).toHaveBeenCalledWith(ctx.destination);
    expect(ctx.createMediaElementSource).toHaveBeenCalledExactlyOnceWith(element);
    expect(ctx.gainNode.gain.value).toBe(BGM_VOLUME);
    expect(element.src).toBe('track-a');
    expect(element.loop).toBe(true);
    expect(element.play).toHaveBeenCalledTimes(1);
    expect(ensureAudioContextRunning).toHaveBeenCalled();
  });

  it('applies volume changes to the live GainNode', () => {
    const bgm = new BgmPlayer();
    bgm.start(['track-a']);

    bgm.setVolume(2);

    expect(ctx.gainNode.gain.value).toBe(1);
  });
});

describe('track reuse (playlist)', () => {
  it('reuses the element across tracks instead of re-binding createMediaElementSource', () => {
    const bgm = new BgmPlayer();
    bgm.start(['track-a', 'track-b']);

    expect(ctx.createMediaElementSource).toHaveBeenCalledTimes(1);
    expect(element.play).toHaveBeenCalledTimes(1);

    element.emit('ended');
    vi.advanceTimersByTime(2000);

    // A re-bind would throw InvalidStateError; the second track swaps src instead.
    expect(ctx.createMediaElementSource).toHaveBeenCalledTimes(1);
    expect(element.play).toHaveBeenCalledTimes(2);
  });
});

describe('resume()', () => {
  it('ensures the context is running and replays the element', () => {
    const bgm = new BgmPlayer();
    bgm.start(['track-a']);
    vi.mocked(ensureAudioContextRunning).mockClear();
    element.play.mockClear();

    bgm.resume();

    expect(ensureAudioContextRunning).toHaveBeenCalledTimes(1);
    expect(element.play).toHaveBeenCalledTimes(1);
  });
});

describe('stop()', () => {
  it('does not close the shared AudioContext (singleton must survive)', () => {
    const bgm = new BgmPlayer();
    bgm.start(['track-a']);

    bgm.stop();

    expect(ctx.close).not.toHaveBeenCalled();
    expect(element.pause).toHaveBeenCalled();
    expect(element.removeAttribute).toHaveBeenCalledWith('src');
  });

  it('cancels the pending next track of a playlist', () => {
    const bgm = new BgmPlayer();
    bgm.start(['track-a', 'track-b']);
    element.emit('ended');

    bgm.stop();
    vi.advanceTimersByTime(2000);

    expect(element.play).toHaveBeenCalledTimes(1);
  });
});

describe('WeChat ArkWeb timeupdate fallback', () => {
  it('loops a single track by seeking to 0 and replaying when `ended` is swallowed', () => {
    const bgm = new BgmPlayer();
    bgm.start(['track-a']);

    element.currentTime = element.duration - 0.1;
    element.emit('timeupdate');

    expect(element.currentTime).toBe(0);
    expect(element.play).toHaveBeenCalledTimes(2);
  });
});
