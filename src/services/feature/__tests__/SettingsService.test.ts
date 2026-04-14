/**
 * SettingsService.test.ts - Tests for the settings service
 */
import { storage } from '@/lib/storage';
import { SettingsService } from '@/services/feature/SettingsService';

jest.mock('@/lib/storage', () => {
  const store: Record<string, string> = {};
  return {
    storage: {
      getString: jest.fn((key: string) => store[key] as string | undefined),
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
    service = new SettingsService();
  });

  describe('load', () => {
    it('loads settings from MMKV storage', async () => {
      const storedSettings = {
        bgmEnabled: false,
        roleRevealAnimation: 'roleHunt',
      };
      (storage.getString as jest.Mock).mockReturnValue(JSON.stringify(storedSettings));

      await service.load();

      expect(storage.getString).toHaveBeenCalledWith('@werewolf_settings');
    });
  });

  describe('roleRevealAnimation', () => {
    it('can get and set animation to roleHunt', async () => {
      await service.setRoleRevealAnimation('roleHunt');
      expect(service.getRoleRevealAnimation()).toBe('roleHunt');
    });

    it('sets and persists animation', async () => {
      await service.setRoleRevealAnimation('roleHunt');

      expect(storage.set).toHaveBeenCalledWith(
        '@werewolf_settings',
        expect.stringContaining('"roleRevealAnimation":"roleHunt"'),
      );
    });

    it('can set to none', async () => {
      await service.setRoleRevealAnimation('none');
      expect(service.getRoleRevealAnimation()).toBe('none');
    });

    it('can set to roulette', async () => {
      await service.setRoleRevealAnimation('roulette');
      expect(service.getRoleRevealAnimation()).toBe('roulette');
    });

    it('cycles through all animation types', async () => {
      await service.setRoleRevealAnimation('roulette');
      expect(service.getRoleRevealAnimation()).toBe('roulette');

      await service.setRoleRevealAnimation('roleHunt');
      expect(service.getRoleRevealAnimation()).toBe('roleHunt');

      await service.setRoleRevealAnimation('none');
      expect(service.getRoleRevealAnimation()).toBe('none');
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
      expect(settings).toHaveProperty('roleRevealAnimation');
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

      await service.setRoleRevealAnimation('roleHunt');

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ roleRevealAnimation: 'roleHunt' }),
      );
    });

    it('returns unsubscribe function', async () => {
      const listener = jest.fn();
      const unsubscribe = service.addListener(listener);

      unsubscribe();
      listener.mockClear(); // Clear any previous calls

      await service.setRoleRevealAnimation('none');

      expect(listener).not.toHaveBeenCalled();
    });
  });
});
