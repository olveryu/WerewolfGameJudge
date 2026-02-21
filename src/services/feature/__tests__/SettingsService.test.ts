/**
 * SettingsService.test.ts - Tests for the settings service
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { SettingsService } from '@/services/feature/SettingsService';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

describe('SettingsService', () => {
  let service: SettingsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SettingsService();
  });

  describe('load', () => {
    it('loads settings from AsyncStorage', async () => {
      const storedSettings = {
        bgmEnabled: false,
        themeKey: 'midnight',
        roleRevealAnimation: 'flip',
      };
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(storedSettings));

      await service.load();

      expect(AsyncStorage.getItem).toHaveBeenCalledWith('@werewolf_settings');
    });
  });

  describe('roleRevealAnimation', () => {
    it('can get and set animation to flip', async () => {
      await service.setRoleRevealAnimation('flip');
      expect(service.getRoleRevealAnimation()).toBe('flip');
    });

    it('sets and persists animation', async () => {
      await service.setRoleRevealAnimation('flip');

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        '@werewolf_settings',
        expect.stringContaining('"roleRevealAnimation":"flip"'),
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

      await service.setRoleRevealAnimation('flip');
      expect(service.getRoleRevealAnimation()).toBe('flip');

      await service.setRoleRevealAnimation('none');
      expect(service.getRoleRevealAnimation()).toBe('none');
    });
  });

  describe('themeKey', () => {
    it('can get and set theme', async () => {
      await service.setThemeKey('midnight');
      expect(service.getThemeKey()).toBe('midnight');
    });

    it('sets and persists theme', async () => {
      await service.setThemeKey('blood');

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        '@werewolf_settings',
        expect.stringContaining('"themeKey":"blood"'),
      );
      expect(service.getThemeKey()).toBe('blood');
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

  describe('hasSeenAssistantHint', () => {
    it('defaults to false', () => {
      expect(service.hasSeenAssistantHint()).toBe(false);
    });

    it('can set to true and persist', async () => {
      await service.setHasSeenAssistantHint(true);
      expect(service.hasSeenAssistantHint()).toBe(true);

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        '@werewolf_settings',
        expect.stringContaining('"hasSeenAssistantHint":true'),
      );
    });
  });

  describe('getAll', () => {
    it('returns all settings', () => {
      const settings = service.getAll();

      expect(settings).toHaveProperty('bgmEnabled');
      expect(settings).toHaveProperty('themeKey');
      expect(settings).toHaveProperty('roleRevealAnimation');
      expect(settings).toHaveProperty('hasSeenAssistantHint');
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

      await service.setRoleRevealAnimation('flip');

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ roleRevealAnimation: 'flip' }),
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
