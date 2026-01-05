import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  LAST_ROOM: '@werewolf_last_room',
  ARTWORK_ENABLED: '@werewolf_artwork_enabled',
  USER_ID: '@werewolf_user_id',
  SETTINGS: '@werewolf_settings',
};

export interface Settings {
  artworkEnabled: boolean;
  soundEnabled: boolean;
}

const DEFAULT_SETTINGS: Settings = {
  artworkEnabled: true,
  soundEnabled: true,
};

export class StorageService {
  private static instance: StorageService;

  private constructor() {}

  static getInstance(): StorageService {
    if (!StorageService.instance) {
      StorageService.instance = new StorageService();
    }
    return StorageService.instance;
  }

  // Last room
  async saveLastRoom(roomNumber: string): Promise<void> {
    try {
      await AsyncStorage.setItem(KEYS.LAST_ROOM, roomNumber);
    } catch (error) {
      console.error('Error saving last room:', error);
    }
  }

  async getLastRoom(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(KEYS.LAST_ROOM);
    } catch (error) {
      console.error('Error getting last room:', error);
      return null;
    }
  }

  async clearLastRoom(): Promise<void> {
    try {
      await AsyncStorage.removeItem(KEYS.LAST_ROOM);
    } catch (error) {
      console.error('Error clearing last room:', error);
    }
  }

  // Settings
  async saveSettings(settings: Settings): Promise<void> {
    try {
      await AsyncStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  }

  async getSettings(): Promise<Settings> {
    try {
      const settingsStr = await AsyncStorage.getItem(KEYS.SETTINGS);
      if (settingsStr) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(settingsStr) };
      }
      return DEFAULT_SETTINGS;
    } catch (error) {
      console.error('Error getting settings:', error);
      return DEFAULT_SETTINGS;
    }
  }

  // Artwork enabled
  async setArtworkEnabled(enabled: boolean): Promise<void> {
    try {
      await AsyncStorage.setItem(KEYS.ARTWORK_ENABLED, JSON.stringify(enabled));
    } catch (error) {
      console.error('Error saving artwork enabled:', error);
    }
  }

  async getArtworkEnabled(): Promise<boolean> {
    try {
      const value = await AsyncStorage.getItem(KEYS.ARTWORK_ENABLED);
      return value ? JSON.parse(value) : true;
    } catch (error) {
      console.error('Error getting artwork enabled:', error);
      return true;
    }
  }

  // User ID (for anonymous auth persistence)
  async saveUserId(userId: string): Promise<void> {
    try {
      await AsyncStorage.setItem(KEYS.USER_ID, userId);
    } catch (error) {
      console.error('Error saving user ID:', error);
    }
  }

  async getUserId(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(KEYS.USER_ID);
    } catch (error) {
      console.error('Error getting user ID:', error);
      return null;
    }
  }

  // Clear all data
  async clearAll(): Promise<void> {
    try {
      const keys = Object.values(KEYS);
      await AsyncStorage.multiRemove(keys);
    } catch (error) {
      console.error('Error clearing all data:', error);
    }
  }
}

export default StorageService;
