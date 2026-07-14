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
import { USER_SETTINGS_KEY } from '@/config/storageKeys';
import { storage } from '@/lib/storage';
import type { BgmTrackSetting } from '@/services/infra/audio/bgmCatalog';
import { BGM_VOLUME, isBgmTrackSetting } from '@/services/infra/audio/bgmCatalog';
import { handleError } from '@/utils/errorPipeline';
import { settingsServiceLog } from '@/utils/logger';

/**
 * MMKV access can throw `QuotaExceededError` / `SecurityError` (e.g. private mode,
 * storage disabled). These are environment limits, not bugs — expected, no Sentry.
 */
const isExpectedStorageError = (err: unknown): boolean =>
  err instanceof Error && (err.name === 'QuotaExceededError' || err.name === 'SecurityError');

const MIN_VOLUME = 0;
const MAX_VOLUME = 1;

interface UserSettings {
  /** Whether to play background music during night phase (default: true) */
  bgmEnabled: boolean;
  /** Selected BGM track or 'random' for shuffle playlist (default: 'random') */
  bgmTrack: BgmTrackSetting;
  /** BGM volume 0.0–1.0 (default: BGM_VOLUME) */
  bgmVolume: number;
  /** Foreground game audio volume 0.0–1.0 (default: 1.0) */
  gameAudioVolume: number;
}

const DEFAULT_SETTINGS: UserSettings = {
  bgmEnabled: true,
  bgmTrack: 'random',
  bgmVolume: BGM_VOLUME,
  gameAudioVolume: MAX_VOLUME,
};

function clampVolume(volume: number): number {
  return Math.max(MIN_VOLUME, Math.min(MAX_VOLUME, volume));
}

function requireFiniteVolume(volume: number, settingName: string): number {
  if (!Number.isFinite(volume)) {
    throw new TypeError(`[FAIL-FAST] ${settingName} must be a finite number`);
  }
  return clampVolume(volume);
}

function readPersistedBoolean(value: unknown, settingName: string, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  if (typeof value === 'boolean') return value;

  settingsServiceLog.warn(`Invalid persisted ${settingName}, resetting to default`, value);
  return fallback;
}

function readPersistedVolume(value: unknown, settingName: string, fallback: number): number {
  if (value === undefined) return fallback;
  if (typeof value === 'number' && Number.isFinite(value)) return clampVolume(value);

  settingsServiceLog.warn(`Invalid persisted ${settingName}, resetting to default`, value);
  return fallback;
}

function readPersistedBgmTrack(value: unknown): BgmTrackSetting {
  if (value === undefined) return DEFAULT_SETTINGS.bgmTrack;
  if (isBgmTrackSetting(value)) return value;

  settingsServiceLog.warn('Invalid persisted bgmTrack, resetting to default', value);
  return DEFAULT_SETTINGS.bgmTrack;
}

function parsePersistedSettings(value: unknown): UserSettings {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    settingsServiceLog.warn('Invalid persisted settings payload, resetting to defaults', value);
    return { ...DEFAULT_SETTINGS };
  }

  return {
    bgmEnabled: readPersistedBoolean(
      Reflect.get(value, 'bgmEnabled'),
      'bgmEnabled',
      DEFAULT_SETTINGS.bgmEnabled,
    ),
    bgmTrack: readPersistedBgmTrack(Reflect.get(value, 'bgmTrack')),
    bgmVolume: readPersistedVolume(
      Reflect.get(value, 'bgmVolume'),
      'bgmVolume',
      DEFAULT_SETTINGS.bgmVolume,
    ),
    gameAudioVolume: readPersistedVolume(
      Reflect.get(value, 'gameAudioVolume'),
      'gameAudioVolume',
      DEFAULT_SETTINGS.gameAudioVolume,
    ),
  };
}

/**
 * SettingsService — user settings management (BGM / volume / track).
 *
 * Responsibilities: MMKV read/write + in-memory cache + change listeners.
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
      const raw = storage.getString(USER_SETTINGS_KEY);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        this.#settings = parsePersistedSettings(parsed);
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
      storage.set(USER_SETTINGS_KEY, JSON.stringify(this.#settings));
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
    this.#settings.bgmVolume = requireFiniteVolume(volume, 'bgmVolume');
    await this.#save();
  }

  /**
   * Get foreground game audio volume (0.0–1.0).
   */
  getGameAudioVolume(): number {
    return this.#settings.gameAudioVolume;
  }

  /**
   * Set foreground game audio volume and persist. Clamped to [0, 1].
   */
  async setGameAudioVolume(volume: number): Promise<void> {
    this.#settings.gameAudioVolume = requireFiniteVolume(volume, 'gameAudioVolume');
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
