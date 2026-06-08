/**
 * SettingsService — user settings persistence service.
 *
 * Responsibilities:
 * - Persist user preferences (audio / animation, etc.) using MMKV
 * - All settings stored as a JSON object under a single key
 * - Provide default-value merging and type-safe read/write
 *
 * Not responsible for:
 * - Game logic or game state storage
 * - UI-layer settings panel rendering
 *
 * Boundary constraints:
 * - load() must be called once at app startup; subsequent reads are synchronous
 * - Silently degrades to in-memory defaults when MMKV is unavailable
 */
import { storage } from '@/lib/storage';
import { handleError } from '@/utils/errorPipeline';
import { settingsServiceLog } from '@/utils/logger';

const SETTINGS_KEY = '@werewolf_settings';

/**
 * MMKV access can throw `QuotaExceededError` / `SecurityError` (e.g. private mode,
 * storage disabled). These are environment limits, not bugs — expected, no Sentry.
 */
const isExpectedStorageError = (err: unknown): boolean =>
  err instanceof Error && (err.name === 'QuotaExceededError' || err.name === 'SecurityError');

import type { BgmTrackSetting } from '@/services/infra/audio/audioRegistry';
import { BGM_VOLUME, VALID_BGM_TRACK_IDS } from '@/services/infra/audio/audioRegistry';

interface UserSettings {
  /** Whether to play background music during night phase (default: true) */
  bgmEnabled: boolean;
  /** Selected BGM track or 'random' for shuffle playlist (default: 'random') */
  bgmTrack: BgmTrackSetting;
  /** BGM volume 0.0–1.0 (default: BGM_VOLUME) */
  bgmVolume: number;
  /** Role audio (TTS narration) volume 0.0–1.0 (default: 1.0) */
  roleAudioVolume: number;
}

const DEFAULT_SETTINGS: UserSettings = {
  bgmEnabled: true,
  bgmTrack: 'random',
  bgmVolume: BGM_VOLUME,
  roleAudioVolume: 1.0,
};

/**
 * SettingsService — user settings management (BGM / volume / track).
 *
 * Responsibilities: MMKV read/write + in-memory cache + server sync.
 */
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
      const raw = storage.getString(SETTINGS_KEY);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (typeof parsed === 'object' && parsed !== null) {
          // Merge with defaults to handle new settings added in future versions
          const merged = { ...DEFAULT_SETTINGS, ...(parsed as Partial<UserSettings>) };

          // Validate + clamp persisted values to current valid ranges
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
      handleError(e, {
        label: '加载设置',
        logger: settingsServiceLog,
        feedback: false,
        isExpected: isExpectedStorageError,
      });
      this.#settings = { ...DEFAULT_SETTINGS };
      this.#loaded = true;
    }
  }

  /**
   * Save current settings to storage.
   */
  async #save(): Promise<void> {
    try {
      storage.set(SETTINGS_KEY, JSON.stringify(this.#settings));
      this.#notifyListeners();
    } catch (e) {
      handleError(e, {
        label: '保存设置',
        logger: settingsServiceLog,
        feedback: false,
        isExpected: isExpectedStorageError,
      });
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
  // All Settings
  // =========================================================================

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
