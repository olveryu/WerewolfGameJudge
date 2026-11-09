import { USER_SETTINGS_KEY } from '@/config/storageKeys';
import { storage } from '@/services/infra/localStorage';

async function loadFreshStore() {
  vi.resetModules();
  const module = await import('@/features/settings/displaySettings');
  return module.displaySettings;
}

describe('displaySettings', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('defaults to decorations on at 60 fps', async () => {
    const store = await loadFreshStore();
    expect(store.getSnapshot()).toEqual({ seatDecorationsEnabled: true, sceneFrameRate: 60 });
  });

  it('persists the frame rate and keeps settings it does not own', async () => {
    storage.set(USER_SETTINGS_KEY, JSON.stringify({ bgmEnabled: false }));
    const store = await loadFreshStore();
    const listener = vi.fn();
    store.subscribe(listener);

    store.setSceneFrameRate(30);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot().sceneFrameRate).toBe(30);
    expect(JSON.parse(storage.getString(USER_SETTINGS_KEY) ?? '{}')).toEqual({
      bgmEnabled: false,
      seatDecorationsEnabled: true,
      sceneFrameRate: 30,
    });
    expect((await loadFreshStore()).getSnapshot().sceneFrameRate).toBe(30);
  });
});
