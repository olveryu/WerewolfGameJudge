/**
 * SettingsService - 用户设置持久化服务
 *
 * 使用 AsyncStorage 持久化用户偏好设置（主题/昵称/语言等），
 * 所有设置存储在单个 key 下的 JSON 对象中。涵盖 AsyncStorage 读写和默认值合并。
 * 不涉及游戏逻辑或游戏状态存储。
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Sentry from '@sentry/react-native';

import { settingsServiceLog } from '@/utils/logger';

const SETTINGS_KEY = '@werewolf_settings';

/** Valid theme keys (must match themes.ts ThemeKey) */
type ThemeKey = 'light' | 'dark' | 'amoled' | 'sand' | 'midnight' | 'blood' | 'forest' | 'snow';

import type { RoleRevealAnimation } from '@werewolf/game-engine/types/RoleRevealAnimation';

interface UserSettings {
  /** Whether to play background music during night phase (default: true) */
  bgmEnabled: boolean;
  /** Selected theme (default: 'dark') */
  themeKey: ThemeKey;
  /** Role reveal animation style (default: 'roulette') */
  roleRevealAnimation: RoleRevealAnimation;
  /** Whether the user has seen the AI assistant hint toast (default: false) */
  hasSeenAssistantHint: boolean;
}

/** Valid theme keys for runtime validation of persisted data */
const VALID_THEME_KEYS: ReadonlySet<string> = new Set<ThemeKey>([
  'light',
  'dark',
  'amoled',
  'sand',
  'midnight',
  'blood',
  'forest',
  'snow',
]);

/** Valid role reveal animation values for runtime validation of persisted data */
const VALID_ROLE_REVEAL_ANIMATIONS: ReadonlySet<string> = new Set<RoleRevealAnimation>([
  'roulette',
  'roleHunt',
  'scratch',
  'tarot',
  'gachaMachine',
  'cardPick',
  'constellation',
  'none',
  'random',
]);

const DEFAULT_SETTINGS: UserSettings = {
  bgmEnabled: true,
  themeKey: 'light',
  roleRevealAnimation: 'random',
  hasSeenAssistantHint: false,
};

export class SettingsService {
  #settings: UserSettings = { ...DEFAULT_SETTINGS };
  #loaded = false;

  constructor() {}

  /**
   * Load settings from storage. Call this on app startup.
   */
  async load(): Promise<void> {
    if (this.#loaded) return;

    try {
      const raw = await AsyncStorage.getItem(SETTINGS_KEY);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (typeof parsed === 'object' && parsed !== null) {
          // Merge with defaults to handle new settings added in future versions
          const merged = { ...DEFAULT_SETTINGS, ...(parsed as Partial<UserSettings>) };
          // Validate + clamp persisted values to current valid ranges
          if (!VALID_THEME_KEYS.has(merged.themeKey)) {
            settingsServiceLog.warn(
              'Invalid persisted themeKey, resetting to default:',
              merged.themeKey,
            );
            merged.themeKey = DEFAULT_SETTINGS.themeKey;
          }
          if (!VALID_ROLE_REVEAL_ANIMATIONS.has(merged.roleRevealAnimation)) {
            settingsServiceLog.warn(
              'Invalid persisted roleRevealAnimation, resetting to default:',
              merged.roleRevealAnimation,
            );
            merged.roleRevealAnimation = DEFAULT_SETTINGS.roleRevealAnimation;
          }
          this.#settings = merged;
        }
      }

      this.#loaded = true;
    } catch (e) {
      // If load fails, use defaults
      settingsServiceLog.error('Failed to load settings, using defaults:', e);
      Sentry.captureException(e);
      this.#settings = { ...DEFAULT_SETTINGS };
      this.#loaded = true;
    }
  }

  /**
   * Save current settings to storage.
   */
  async #save(): Promise<void> {
    try {
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(this.#settings));
      this.#notifyListeners();
    } catch (e) {
      settingsServiceLog.error('Failed to save settings:', e);
      Sentry.captureException(e);
    }
  }

  /**
   * Get whether BGM is enabled.
   */
  isBgmEnabled(): boolean {
    return this.#settings.bgmEnabled;
  }

  /**
   * Set BGM enabled/disabled and persist.
   */
  async setBgmEnabled(enabled: boolean): Promise<void> {
    this.#settings.bgmEnabled = enabled;
    await this.#save();
  }

  /**
   * Toggle BGM setting and persist. Returns new value.
   */
  async toggleBgm(): Promise<boolean> {
    this.#settings.bgmEnabled = !this.#settings.bgmEnabled;
    await this.#save();
    return this.#settings.bgmEnabled;
  }

  // =========================================================================
  // Theme Settings
  // =========================================================================

  /**
   * Get current theme key.
   */
  getThemeKey(): ThemeKey {
    return this.#settings.themeKey;
  }

  /**
   * Set theme and persist.
   */
  async setThemeKey(key: ThemeKey): Promise<void> {
    this.#settings.themeKey = key;
    await this.#save();
  }

  // =========================================================================
  // Role Reveal Animation Settings
  // =========================================================================

  /**
   * Get current role reveal animation.
   */
  getRoleRevealAnimation(): RoleRevealAnimation {
    return this.#settings.roleRevealAnimation;
  }

  /**
   * Set role reveal animation and persist.
   */
  async setRoleRevealAnimation(anim: RoleRevealAnimation): Promise<void> {
    this.#settings.roleRevealAnimation = anim;
    await this.#save();
  }

  // =========================================================================
  // Assistant Hint Settings
  // =========================================================================

  /**
   * Get whether the user has seen the AI assistant hint toast.
   */
  hasSeenAssistantHint(): boolean {
    return this.#settings.hasSeenAssistantHint;
  }

  /**
   * Mark the AI assistant hint as seen and persist.
   */
  async setHasSeenAssistantHint(seen: boolean): Promise<void> {
    this.#settings.hasSeenAssistantHint = seen;
    await this.#save();
  }

  /**
   * Get all settings (for debugging/display).
   */
  getAll(): UserSettings {
    return { ...this.#settings };
  }

  /**
   * Add a listener for settings changes.
   * Returns unsubscribe function.
   */
  readonly #listeners: Set<(settings: UserSettings) => void> = new Set();

  addListener(listener: (settings: UserSettings) => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  /**
   * Notify all listeners of settings change.
   */
  #notifyListeners(): void {
    const snapshot = { ...this.#settings };
    this.#listeners.forEach((listener) => listener(snapshot));
  }
}
