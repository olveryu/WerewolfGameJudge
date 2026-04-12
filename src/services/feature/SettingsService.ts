/**
 * SettingsService - 用户设置持久化服务
 *
 * 使用 AsyncStorage 持久化用户偏好设置（音频/动画等），
 * 所有设置存储在单个 key 下的 JSON 对象中。涵盖 AsyncStorage 读写和默认值合并。
 * 不涉及游戏逻辑或游戏状态存储。
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Sentry from '@sentry/react-native';

import { settingsServiceLog } from '@/utils/logger';

const SETTINGS_KEY = '@werewolf_settings';

import type { RoleRevealAnimation } from '@werewolf/game-engine/types/RoleRevealAnimation';

import type { BgmTrackSetting } from '@/services/infra/audio/audioRegistry';
import { VALID_BGM_TRACK_IDS } from '@/services/infra/audio/audioRegistry';

interface UserSettings {
  /** Whether to play background music during night phase (default: true) */
  bgmEnabled: boolean;
  /** Selected BGM track or 'random' for shuffle playlist (default: 'random') */
  bgmTrack: BgmTrackSetting;
  /** BGM volume 0.0–1.0 (default: 0.1) */
  bgmVolume: number;
  /** Role audio (TTS narration) volume 0.0–1.0 (default: 1.0) */
  roleAudioVolume: number;
  /** Role reveal animation style (default: 'roulette') */
  roleRevealAnimation: RoleRevealAnimation;
}

/** Valid role reveal animation values for runtime validation of persisted data */
const VALID_ROLE_REVEAL_ANIMATIONS: ReadonlySet<string> = new Set<RoleRevealAnimation>([
  'roulette',
  'roleHunt',
  'scratch',
  'tarot',
  'gachaMachine',
  'cardPick',
  'sealBreak',
  'chainShatter',
  'fortuneWheel',
  'meteorStrike',
  'filmRewind',
  'vortexCollapse',
  'none',
  'random',
]);

const DEFAULT_SETTINGS: UserSettings = {
  bgmEnabled: true,
  bgmTrack: 'random',
  bgmVolume: 0.1,
  roleAudioVolume: 1.0,
  roleRevealAnimation: 'random',
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
          if (!VALID_ROLE_REVEAL_ANIMATIONS.has(merged.roleRevealAnimation)) {
            settingsServiceLog.warn(
              'Invalid persisted roleRevealAnimation, resetting to default:',
              merged.roleRevealAnimation,
            );
            merged.roleRevealAnimation = DEFAULT_SETTINGS.roleRevealAnimation;
          }
          // Validate boolean fields (guard against corrupted persisted data)
          if (typeof merged.bgmEnabled !== 'boolean') {
            settingsServiceLog.warn(
              'Invalid persisted bgmEnabled, resetting to default:',
              merged.bgmEnabled,
            );
            merged.bgmEnabled = DEFAULT_SETTINGS.bgmEnabled;
          }
          if (merged.bgmTrack !== 'random' && !VALID_BGM_TRACK_IDS.has(merged.bgmTrack)) {
            settingsServiceLog.warn(
              'Invalid persisted bgmTrack, resetting to default:',
              merged.bgmTrack,
            );
            merged.bgmTrack = DEFAULT_SETTINGS.bgmTrack;
          }
          // Validate + clamp bgmVolume to [0, 1]
          if (typeof merged.bgmVolume !== 'number' || !isFinite(merged.bgmVolume)) {
            settingsServiceLog.warn(
              'Invalid persisted bgmVolume, resetting to default:',
              merged.bgmVolume,
            );
            merged.bgmVolume = DEFAULT_SETTINGS.bgmVolume;
          } else {
            merged.bgmVolume = Math.max(0, Math.min(1, merged.bgmVolume));
          }
          // Validate + clamp roleAudioVolume to [0, 1]
          if (typeof merged.roleAudioVolume !== 'number' || !isFinite(merged.roleAudioVolume)) {
            settingsServiceLog.warn(
              'Invalid persisted roleAudioVolume, resetting to default:',
              merged.roleAudioVolume,
            );
            merged.roleAudioVolume = DEFAULT_SETTINGS.roleAudioVolume;
          } else {
            merged.roleAudioVolume = Math.max(0, Math.min(1, merged.roleAudioVolume));
          }
          this.#settings = merged;
        }
      }

      this.#loaded = true;
    } catch (e) {
      // If load fails, use defaults
      const isExpectedStorage =
        e instanceof Error && (e.name === 'QuotaExceededError' || e.name === 'SecurityError');
      if (isExpectedStorage) {
        settingsServiceLog.warn('Storage access failed while loading settings, using defaults:', e);
      } else {
        settingsServiceLog.error('Failed to load settings, using defaults:', e);
        Sentry.captureException(e);
      }
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
      const isExpectedStorage =
        e instanceof Error && (e.name === 'QuotaExceededError' || e.name === 'SecurityError');
      if (isExpectedStorage) {
        settingsServiceLog.warn('Storage access failed while saving settings:', e);
      } else {
        settingsServiceLog.error('Failed to save settings:', e);
        Sentry.captureException(e);
      }
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

  /**
   * Get selected BGM track setting.
   */
  getBgmTrack(): BgmTrackSetting {
    return this.#settings.bgmTrack;
  }

  /**
   * Set BGM track and persist.
   */
  async setBgmTrack(track: BgmTrackSetting): Promise<void> {
    this.#settings.bgmTrack = track;
    await this.#save();
  }

  /**
   * Get BGM volume (0.0–1.0).
   */
  getBgmVolume(): number {
    return this.#settings.bgmVolume;
  }

  /**
   * Set BGM volume and persist. Clamped to [0, 1].
   */
  async setBgmVolume(volume: number): Promise<void> {
    this.#settings.bgmVolume = Math.max(0, Math.min(1, volume));
    await this.#save();
  }

  // =========================================================================
  // Role Audio Volume Settings
  // =========================================================================

  /**
   * Get role audio (TTS narration) volume (0.0–1.0).
   */
  getRoleAudioVolume(): number {
    return this.#settings.roleAudioVolume;
  }

  /**
   * Set role audio volume and persist. Clamped to [0, 1].
   */
  async setRoleAudioVolume(volume: number): Promise<void> {
    this.#settings.roleAudioVolume = Math.max(0, Math.min(1, volume));
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
