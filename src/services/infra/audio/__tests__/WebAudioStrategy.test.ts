/**
 * @jest-environment jsdom
 *
 * WebAudioStrategy Promise-settlement and bounded-retry tests.
 */

jest.mock('@/utils/logger', () => ({
  audioLog: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock('../webAudioUnlock', () => ({ getUnlockedAudioElement: jest.fn() }));

import { WEB_AUDIO_LOAD_TIMEOUT_MS } from '../types';
import { WebAudioStrategy } from '../WebAudioStrategy';
import { getUnlockedAudioElement } from '../webAudioUnlock';

interface FakeAudioElement {
  readyState: number;
  volume: number;
  src: string;
  error: MediaError | null;
  oncanplaythrough: (() => void) | null;
  onended: (() => void) | null;
  onerror: (() => void) | null;
  load: jest.Mock;
  pause: jest.Mock;
  play: jest.Mock<Promise<void>, []>;
  removeAttribute: jest.Mock;
}

function createFakeAudioElement(): FakeAudioElement {
  return {
    readyState: 0,
    volume: 1,
    src: '',
    error: null,
    oncanplaythrough: null,
    onended: null,
    onerror: null,
    load: jest.fn(),
    pause: jest.fn(),
    play: jest.fn(() => Promise.resolve()),
    removeAttribute: jest.fn(),
  };
}

const mockGetUnlockedAudioElement = jest.mocked(getUnlockedAudioElement);

beforeEach(() => {
  jest.useFakeTimers();
  mockGetUnlockedAudioElement.mockReset();
});

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

it('rejects after the bounded deadline when loading never recovers', async () => {
  const audio = createFakeAudioElement();
  mockGetUnlockedAudioElement.mockReturnValue(audio as unknown as HTMLAudioElement);
  const strategy = new WebAudioStrategy();

  const playPromise = strategy.play('/night.mp3', 'night');
  const rejection = expect(playPromise).rejects.toThrow(
    `WEB audio load timed out after ${WEB_AUDIO_LOAD_TIMEOUT_MS}ms: night`,
  );
  audio.onerror?.();
  await jest.advanceTimersByTimeAsync(WEB_AUDIO_LOAD_TIMEOUT_MS);

  await rejection;
  const loadCallsAfterTimeout = audio.load.mock.calls.length;
  await jest.advanceTimersByTimeAsync(WEB_AUDIO_LOAD_TIMEOUT_MS);

  expect(audio.load).toHaveBeenCalledTimes(loadCallsAfterTimeout);
  expect(audio.removeAttribute).toHaveBeenCalledWith('src');
  expect(strategy.getIsPlaying()).toBe(false);
});

it('settles loading when stop is called', async () => {
  const audio = createFakeAudioElement();
  mockGetUnlockedAudioElement.mockReturnValue(audio as unknown as HTMLAudioElement);
  const strategy = new WebAudioStrategy();

  const playPromise = strategy.play('/night.mp3', 'night');
  strategy.stop();

  await expect(playPromise).resolves.toBeUndefined();
  expect(audio.removeAttribute).toHaveBeenCalledWith('src');
  expect(strategy.getIsPlaying()).toBe(false);
});

it('settles the previous load when a new playback starts', async () => {
  const audio = createFakeAudioElement();
  mockGetUnlockedAudioElement.mockReturnValue(audio as unknown as HTMLAudioElement);
  const strategy = new WebAudioStrategy();

  const firstPlay = strategy.play('/first.mp3', 'first');
  const secondPlay = strategy.play('/second.mp3', 'second');

  await expect(firstPlay).resolves.toBeUndefined();
  expect(audio.src).toBe('/second.mp3');

  audio.oncanplaythrough?.();
  await Promise.resolve();
  audio.onended?.();

  await expect(secondPlay).resolves.toBeUndefined();
  expect(audio.play).toHaveBeenCalledTimes(1);
  expect(strategy.getIsPlaying()).toBe(false);
});

it('rejects when the gesture-authorized element cannot start playback', async () => {
  const audio = createFakeAudioElement();
  audio.readyState = HTMLMediaElement.HAVE_ENOUGH_DATA;
  audio.play.mockRejectedValue(new Error('autoplay blocked'));
  mockGetUnlockedAudioElement.mockReturnValue(audio as unknown as HTMLAudioElement);
  const strategy = new WebAudioStrategy();

  await expect(strategy.play('/night.mp3', 'night')).rejects.toThrow(
    'WEB play() rejected (webAudioUnlock broken): autoplay blocked',
  );
  expect(strategy.getIsPlaying()).toBe(false);
});
