import { BgmPlayer } from '../audio/BgmPlayer';
import { WebAudioStrategy } from '../audio/WebAudioStrategy';
import { setupWebAudioUnlock } from '../audio/webAudioUnlock';
import { AudioPreviewUnavailableError, AudioService } from '../AudioService';

vi.mock('@/utils/logger', () => ({
  audioLog: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('../audio/webAudioUnlock', () => ({ setupWebAudioUnlock: vi.fn() }));
vi.mock('../audio/BgmPlayer', () => ({
  BgmPlayer: vi.fn(
    class {
      start = vi.fn();
      stop = vi.fn();
      pause = vi.fn();
      resume = vi.fn();
      setVolume = vi.fn();
      isPlaying = vi.fn(() => false);
      subscribe = vi.fn(() => () => undefined);
    },
  ),
}));
vi.mock('../audio/WebAudioStrategy', () => ({
  WebAudioStrategy: vi.fn(
    class {
      play = vi.fn(async () => undefined);
      stop = vi.fn();
      pause = vi.fn();
      resume = vi.fn();
      preloadFile = vi.fn();
      clearPreloaded = vi.fn();
      setVolume = vi.fn();
    },
  ),
}));

function latestStrategy() {
  const strategy = vi.mocked(WebAudioStrategy).mock.instances.at(-1);
  if (strategy === undefined) throw new Error('no strategy was created');
  return vi.mocked(strategy);
}

function latestBgm() {
  const bgm = vi.mocked(BgmPlayer).mock.instances.at(-1);
  if (bgm === undefined) throw new Error('no BGM player was created');
  return vi.mocked(bgm);
}

function setHidden(hidden: boolean): void {
  Object.defineProperty(document, 'hidden', { configurable: true, value: hidden });
  document.dispatchEvent(new Event('visibilitychange'));
}

afterEach(() => {
  vi.clearAllMocks();
  Reflect.deleteProperty(document, 'hidden');
});

it('registers the gesture unlock synchronously during construction', () => {
  new AudioService();

  expect(setupWebAudioUnlock).toHaveBeenCalledTimes(1);
});

it('plays and preloads clips by url under their keys', async () => {
  const audioService = new AudioService();
  const strategy = latestStrategy();

  await audioService.playClip({ key: 'night', url: '/night.mp3' });
  audioService.preloadClips([
    { key: 'night', url: '/night.mp3' },
    { key: 'night_end', url: '/night_end.mp3' },
  ]);

  expect(strategy.play).toHaveBeenCalledWith('/night.mp3', 'night');
  expect(strategy.preloadFile.mock.calls).toEqual([
    ['night', '/night.mp3'],
    ['night_end', '/night_end.mp3'],
  ]);
});

it('pauses while the page is hidden and resumes when it is visible again', () => {
  new AudioService();
  const strategy = latestStrategy();
  const bgm = latestBgm();

  setHidden(true);
  expect(strategy.pause).toHaveBeenCalledTimes(1);
  expect(bgm.pause).toHaveBeenCalledTimes(1);

  setHidden(false);
  expect(strategy.resume).toHaveBeenCalledTimes(1);
  expect(bgm.resume).toHaveBeenCalledTimes(1);
});

it('delegates background music and volumes', () => {
  const audioService = new AudioService();
  const strategy = latestStrategy();
  const bgm = latestBgm();

  audioService.startBgm(['/a.m4a', '/b.m4a']);
  audioService.setBgmVolume(0.2);
  audioService.setGameAudioVolume(0.7);
  audioService.stopBgm();

  expect(bgm.start).toHaveBeenCalledWith(['/a.m4a', '/b.m4a']);
  expect(bgm.setVolume).toHaveBeenCalledWith(0.2);
  expect(strategy.setVolume).toHaveBeenCalledWith(0.7);
  expect(bgm.stop).toHaveBeenCalledTimes(1);
});

it('does not let closing a preempted preview stop game narration', async () => {
  const service = new AudioService();
  const strategy = latestStrategy();
  const preview = service.createPreviewPlayback();
  const pending = new Promise<void>(() => undefined);
  strategy.play.mockReturnValue(pending);
  void preview.playClip({ key: 'preview', url: '/preview.mp3' });
  void service.playClip({ key: 'game', url: '/game.mp3' });

  preview.stop();

  expect(strategy.stop).not.toHaveBeenCalled();
  await expect(preview.playClip({ key: 'preview', url: '/preview.mp3' })).rejects.toBeInstanceOf(
    AudioPreviewUnavailableError,
  );
  expect(() => preview.startBgm(['/preview.m4a'])).toThrow(AudioPreviewUnavailableError);
});

it('hands preview BGM to the game without letting the preview stop it afterwards', () => {
  const service = new AudioService();
  const bgm = latestBgm();
  const preview = service.createPreviewPlayback();
  preview.startBgm(['/preview.m4a']);
  bgm.isPlaying.mockReturnValue(true);
  expect(preview.isBgmPlaying()).toBe(true);
  expect(service.isBgmPlaying()).toBe(false);

  service.startBgm(['/game.m4a']);
  preview.stopBgm();

  expect(bgm.stop).toHaveBeenCalledTimes(1);
  expect(bgm.start).toHaveBeenLastCalledWith(['/game.m4a']);
  expect(preview.isBgmPlaying()).toBe(false);
  expect(service.isBgmPlaying()).toBe(true);
  expect(() => preview.startBgm(['/preview.m4a'])).toThrow(AudioPreviewUnavailableError);
});

it('stops preview BGM when game narration begins', async () => {
  const service = new AudioService();
  const bgm = latestBgm();
  const preview = service.createPreviewPlayback();
  preview.startBgm(['/preview.m4a']);

  await service.playClip({ key: 'game', url: '/game.mp3' });

  expect(bgm.stop).toHaveBeenCalledOnce();
  expect(latestStrategy().play).toHaveBeenCalledWith('/game.mp3', 'game');
});
