/**
 * SettingsService.test.ts - Tests for the settings service
 */
import { USER_SETTINGS_KEY } from '@/config/storageKeys';
import { SettingsService } from '@/features/settings/services/SettingsService';
import { storage } from '@/services/infra/localStorage';

jest.mock('@/services/infra/localStorage', () => {
  const store: Record<string, string> = {};
  return {
    storage: {
      getString: jest.fn((key: string) => store[key]),
      set: jest.fn((key: string, value: string) => {
        store[key] = value;
      }),
      remove: jest.fn((key: string) => {
        delete store[key];
      }),
    },
  };
});

describe('SettingsService', () => {
  let service: SettingsService;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(storage.getString).mockReturnValue(undefined);
    service = new SettingsService();
  });

  describe('load', () => {
    it('loads settings from MMKV storage', async () => {
      const storedSettings = {
        bgmEnabled: false,
        gameAudioVolume: 0.4,
      };
      jest.mocked(storage.getString).mockReturnValue(JSON.stringify(storedSettings));

      await service.load();

      expect(storage.getString).toHaveBeenCalledWith(USER_SETTINGS_KEY);
      expect(service.isBgmEnabled()).toBe(false);
      expect(service.getGameAudioVolume()).toBe(0.4);
    });

    it('does not interpret removed game-specific settings fields', async () => {
      jest.mocked(storage.getString).mockReturnValue(JSON.stringify({ roleAudioVolume: 0.2 }));

      await service.load();

      expect(service.getGameAudioVolume()).toBe(1);
    });
  });

  describe('gameAudioVolume', () => {
    it('clamps and persists foreground game audio volume', async () => {
      await service.setGameAudioVolume(2);

      expect(service.getGameAudioVolume()).toBe(1);
      expect(storage.set).toHaveBeenLastCalledWith(
        USER_SETTINGS_KEY,
        expect.stringContaining('"gameAudioVolume":1'),
      );
    });

    it('fails fast for non-finite volume', async () => {
      await expect(service.setGameAudioVolume(Number.NaN)).rejects.toThrow(
        '[FAIL-FAST] gameAudioVolume must be a finite number',
      );
      expect(storage.set).not.toHaveBeenCalled();
    });
  });

  describe('bgmEnabled', () => {
    it('can set BGM enabled/disabled', async () => {
      await service.setBgmEnabled(false);
      expect(service.isBgmEnabled()).toBe(false);

      await service.setBgmEnabled(true);
      expect(service.isBgmEnabled()).toBe(true);
    });

    it('toggles BGM', async () => {
      await service.setBgmEnabled(true);
      const initial = service.isBgmEnabled();
      expect(initial).toBe(true);

      const toggled = await service.toggleBgm();
      expect(toggled).toBe(false);
      expect(service.isBgmEnabled()).toBe(false);

      const toggledAgain = await service.toggleBgm();
      expect(toggledAgain).toBe(true);
      expect(service.isBgmEnabled()).toBe(true);
    });
  });

  describe('getAll', () => {
    it('returns all settings', () => {
      const settings = service.getAll();

      expect(settings).toHaveProperty('bgmEnabled');
    });

    it('returns a copy (not the original object)', () => {
      const settings1 = service.getAll();
      const settings2 = service.getAll();

      expect(settings1).not.toBe(settings2);
      expect(settings1).toEqual(settings2);
    });
  });

  describe('listener', () => {
    it('notifies listeners on settings change', async () => {
      const listener = jest.fn();
      service.addListener(listener);

      await service.setBgmEnabled(false);

      expect(listener).toHaveBeenCalledWith(expect.objectContaining({ bgmEnabled: false }));
    });

    it('returns unsubscribe function', async () => {
      const listener = jest.fn();
      const unsubscribe = service.addListener(listener);

      unsubscribe();
      listener.mockClear(); // Clear any previous calls

      await service.setBgmEnabled(true);

      expect(listener).not.toHaveBeenCalled();
    });
  });
});
