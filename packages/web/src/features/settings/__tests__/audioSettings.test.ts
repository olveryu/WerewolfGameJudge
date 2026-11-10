import { USER_SETTINGS_KEY } from '@/config/storageKeys';
import { storage } from '@/services/infra/localStorage';

async function loadFreshStore() {
  vi.resetModules();
  const module = await import('@/features/settings/audioSettings');
  return module.audioSettings;
}

function storedSettings(): unknown {
  return JSON.parse(storage.getString(USER_SETTINGS_KEY) ?? '{}');
}

describe('audioSettings', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('defaults to music on, shuffled, at the catalog volume', async () => {
    const store = await loadFreshStore();
    expect(store.getSnapshot()).toEqual({
      bgmEnabled: true,
      bgmTrack: 'random',
      bgmVolume: 0.5,
      gameAudioVolume: 1,
    });
  });

  it('reads the persisted RN-client fields and resets invalid ones', async () => {
    storage.set(
      USER_SETTINGS_KEY,
      JSON.stringify({ bgmEnabled: false, bgmTrack: 'gone', bgmVolume: 3, gameAudioVolume: 0.4 }),
    );
    const store = await loadFreshStore();

    expect(store.getSnapshot()).toEqual({
      bgmEnabled: false,
      bgmTrack: 'random',
      bgmVolume: 1,
      gameAudioVolume: 0.4,
    });
  });

  it('persists changes, notifies subscribers and keeps settings it does not own', async () => {
    storage.set(USER_SETTINGS_KEY, JSON.stringify({ seatDecorationsEnabled: false }));
    const store = await loadFreshStore();
    const listener = vi.fn();
    store.subscribe(listener);

    expect(store.toggleBgm()).toBe(false);
    store.setBgmTrack('finale');
    store.setGameAudioVolume(2);

    expect(listener).toHaveBeenCalledTimes(3);
    expect(storedSettings()).toEqual({
      seatDecorationsEnabled: false,
      bgmEnabled: false,
      bgmTrack: 'finale',
      bgmVolume: 0.5,
      gameAudioVolume: 1,
    });
    expect((await loadFreshStore()).getSnapshot().bgmTrack).toBe('finale');
  });

  it('fails fast on a non-finite volume without changing state', async () => {
    const store = await loadFreshStore();

    expect(() => store.setBgmVolume(Number.NaN)).toThrow(
      '[FAIL-FAST] bgmVolume must be a finite number',
    );
    expect(store.getSnapshot().bgmVolume).toBe(0.5);
  });
});
