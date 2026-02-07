/**
 * SettingsService - 用户设置持久化服务
 *
 * 职责：
 * - 使用 AsyncStorage 持久化用户偏好设置（主题/昵称/语言等）
 * - 所有设置存储在单个 key 下的 JSON 对象中
 *
 * ✅ 允许：AsyncStorage 读写 + 默认值合并
 * ❌ 禁止：游戏逻辑 / 游戏状态存储
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const SETTINGS_KEY = '@werewolf_settings';

/** Valid theme keys (must match themes.ts ThemeKey) */
export type ThemeKey =
  | 'light'
  | 'minimal'
  | 'dark'
  | 'midnight'
  | 'blood'
  | 'discord'
  | 'forest'
  | 'snow';

/** Role reveal animation type - re-export from pure types */
export type { RoleRevealAnimation } from '../types/RoleRevealAnimation';
import type { RoleRevealAnimation } from '../types/RoleRevealAnimation';

export interface UserSettings {
  /** Whether to play background music during night phase (default: true) */
  bgmEnabled: boolean;
  /** Selected theme (default: 'dark') */
  themeKey: ThemeKey;
  /** Role reveal animation style (default: 'roulette') */
  roleRevealAnimation: RoleRevealAnimation;
}

const DEFAULT_SETTINGS: UserSettings = {
  bgmEnabled: true,
  themeKey: 'dark',
  roleRevealAnimation: 'random',
};

class SettingsService {
  private static instance: SettingsService;
  private settings: UserSettings = { ...DEFAULT_SETTINGS };
  private loaded = false;

  private constructor() {}

  static getInstance(): SettingsService {
    if (!SettingsService.instance) {
      SettingsService.instance = new SettingsService();
    }
    return SettingsService.instance;
  }

  /**
   * Load settings from storage. Call this on app startup.
   */
  async load(): Promise<void> {
    if (this.loaded) return;

    try {
      const raw = await AsyncStorage.getItem(SETTINGS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<UserSettings>;
        // Merge with defaults to handle new settings added in future versions
        this.settings = { ...DEFAULT_SETTINGS, ...parsed };
      }

      this.loaded = true;
    } catch {
      // If load fails, use defaults
      this.settings = { ...DEFAULT_SETTINGS };
      this.loaded = true;
    }
  }

  /**
   * Save current settings to storage.
   */
  private async save(): Promise<void> {
    try {
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings));
      this.notifyListeners();
    } catch {
      // Ignore save errors
    }
  }

  /**
   * Get whether BGM is enabled.
   */
  isBgmEnabled(): boolean {
    return this.settings.bgmEnabled;
  }

  /**
   * Set BGM enabled/disabled and persist.
   */
  async setBgmEnabled(enabled: boolean): Promise<void> {
    this.settings.bgmEnabled = enabled;
    await this.save();
  }

  /**
   * Toggle BGM setting and persist. Returns new value.
   */
  async toggleBgm(): Promise<boolean> {
    this.settings.bgmEnabled = !this.settings.bgmEnabled;
    await this.save();
    return this.settings.bgmEnabled;
  }

  // =========================================================================
  // Theme Settings
  // =========================================================================

  /**
   * Get current theme key.
   */
  getThemeKey(): ThemeKey {
    return this.settings.themeKey;
  }

  /**
   * Set theme and persist.
   */
  async setThemeKey(key: ThemeKey): Promise<void> {
    this.settings.themeKey = key;
    await this.save();
  }

  // =========================================================================
  // Role Reveal Animation Settings
  // =========================================================================

  /**
   * Get current role reveal animation.
   */
  getRoleRevealAnimation(): RoleRevealAnimation {
    return this.settings.roleRevealAnimation;
  }

  /**
   * Set role reveal animation and persist.
   */
  async setRoleRevealAnimation(anim: RoleRevealAnimation): Promise<void> {
    this.settings.roleRevealAnimation = anim;
    await this.save();
  }

  /**
   * Get all settings (for debugging/display).
   */
  getAll(): UserSettings {
    return { ...this.settings };
  }

  /**
   * Add a listener for settings changes.
   * Returns unsubscribe function.
   */
  private readonly listeners: Set<(settings: UserSettings) => void> = new Set();

  addListener(listener: (settings: UserSettings) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Notify all listeners of settings change.
   */
  private notifyListeners(): void {
    const snapshot = { ...this.settings };
    this.listeners.forEach((listener) => listener(snapshot));
  }
}

export default SettingsService;
