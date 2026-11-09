/** WebAudioStrategy Promise-settlement and bounded-retry tests. */
import type { Mock } from 'vitest';

import { WEB_AUDIO_LOAD_TIMEOUT_MS, WebAudioStrategy } from '../WebAudioStrategy';
import { getUnlockedAudioElement } from '../webAudioUnlock';

vi.mock('@/utils/logger', () => ({
  audioLog: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('../webAudioUnlock', () => ({ getUnlockedAudioElement: vi.fn() }));

interface FakeAudioElement {
  readyState: number;
  src: string;
  error: MediaError | null;
  oncanplaythrough: (() => void) | null;
  onended: (() => void) | null;
  onerror: (() => void) | null;
  load: Mock<() => void>;
  pause: Mock<() => void>;
  play: Mock<() => Promise<void>>;
  removeAttribute: Mock<(name: string) => void>;
}

function createFakeAudioElement(): FakeAudioElement {
  return {
    readyState: 0,
    src: '',
    error: null,
    oncanplaythrough: null,
    onended: null,
    onerror: null,
    load: vi.fn(),
    pause: vi.fn(),
    play: vi.fn(() => Promise.resolve()),
    removeAttribute: vi.fn(),
  };
}

const mockGetUnlockedAudioElement = vi.mocked(getUnlockedAudioElement);

beforeEach(() => {
  vi.useFakeTimers();
  mockGetUnlockedAudioElement.mockReset();
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
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
  await vi.advanceTimersByTimeAsync(WEB_AUDIO_LOAD_TIMEOUT_MS);

  await rejection;
  const loadCallsAfterTimeout = audio.load.mock.calls.length;
  await vi.advanceTimersByTimeAsync(WEB_AUDIO_LOAD_TIMEOUT_MS);

  expect(audio.load).toHaveBeenCalledTimes(loadCallsAfterTimeout);
  expect(audio.removeAttribute).toHaveBeenCalledWith('src');
});

it('settles loading when stop is called', async () => {
  const audio = createFakeAudioElement();
  mockGetUnlockedAudioElement.mockReturnValue(audio as unknown as HTMLAudioElement);
  const strategy = new WebAudioStrategy();

  const playPromise = strategy.play('/night.mp3', 'night');
  strategy.stop();

  await expect(playPromise).resolves.toBeUndefined();
  expect(audio.removeAttribute).toHaveBeenCalledWith('src');
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
});
