/**
 * SettingsService — user settings persistence service.
 *
 * Responsibilities:
 * - Persist user preferences (audio / room creation defaults) using MMKV
 * - All settings stored as a JSON object under a single key
 * - Provide default-value merging and type-safe read/write
 *
 * Not responsible for:
 * - Game logic or game state storage
 * - UI-layer settings panel rendering
 *
 * Boundary constraints:
 * - load() must be called once at app startup; subsequent reads are synchronous
 * - Reads may use defaults when MMKV is unavailable; writes reject without changing state
 */
import {
  type AnyConfigFieldSpec,
  type ConfigFieldValue,
  type GameConfigSchema,
  validateConfigFieldValue,
} from '@game-judge/game-engine/platform/config/configSchema';
import type { GameType } from '@game-judge/game-engine/platform/protocol/gameTypes';

import { USER_SETTINGS_KEY } from '@/config/storageKeys';
import type { BgmTrackSetting } from '@/features/product/model/BgmCatalog';
import { BGM_VOLUME, isBgmTrackSetting } from '@/features/product/model/BgmCatalog';
import { storage } from '@/services/infra/localStorage';
import { handleError } from '@/utils/errorPipeline';
import { settingsServiceLog } from '@/utils/logger';

/**
 * MMKV access can throw `QuotaExceededError` / `SecurityError` (e.g. private mode,
 * storage disabled). These are environment limits, not bugs — expected, no Sentry.
 */
export const isExpectedStorageError = (err: unknown): boolean =>
  err instanceof Error && (err.name === 'QuotaExceededError' || err.name === 'SecurityError');

const MIN_VOLUME = 0;
const MAX_VOLUME = 1;

/** Remembered lobby-config fields per game: `gameType -> fieldKey -> value`. */
type RememberedGameConfigs = Readonly<Record<string, Readonly<Record<string, ConfigFieldValue>>>>;

/**
 * Werewolf house rules were stored as top-level settings before remembered
 * config became schema-driven; they fold into rememberedGameConfigs.werewolf.
 */
const LEGACY_WEREWOLF_RULE_KEYS = ['isSheriffElectionEnabled', 'witchCanSelfHeal'] as const;

interface UserSettings {
  rememberedGameConfigs: RememberedGameConfigs;
  /** Whether to play background music during night phase (default: true) */
  bgmEnabled: boolean;
  /** Selected BGM track or 'random' for shuffle playlist (default: 'random') */
  bgmTrack: BgmTrackSetting;
  /** BGM volume 0.0–1.0 (default: BGM_VOLUME) */
  bgmVolume: number;
  /** Foreground game audio volume 0.0–1.0 (default: 1.0) */
  gameAudioVolume: number;
  /** Seat flairs / pets / arrivals in the room grid. Off saves battery on long sessions. */
  seatDecorationsEnabled: boolean;
}

const DEFAULT_SETTINGS: UserSettings = {
  rememberedGameConfigs: {},
  bgmEnabled: true,
  bgmTrack: 'random',
  bgmVolume: BGM_VOLUME,
  gameAudioVolume: MAX_VOLUME,
  seatDecorationsEnabled: true,
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

function isPlainRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isConfigFieldValue(value: unknown): value is ConfigFieldValue {
  return (
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'string' ||
    value === null
  );
}

/** Keeps only primitive leaves; schema validation happens at read time against the live schema. */
function readPersistedRememberedGameConfigs(value: unknown): RememberedGameConfigs {
  if (value === undefined) return {};
  if (!isPlainRecord(value)) {
    settingsServiceLog.warn('Invalid persisted rememberedGameConfigs, resetting to default', value);
    return {};
  }
  const result: Record<string, Record<string, ConfigFieldValue>> = {};
  for (const [gameType, fields] of Object.entries(value)) {
    if (!isPlainRecord(fields)) continue;
    const entries: Record<string, ConfigFieldValue> = {};
    for (const [key, fieldValue] of Object.entries(fields)) {
      if (isConfigFieldValue(fieldValue)) entries[key] = fieldValue;
    }
    result[gameType] = entries;
  }
  return result;
}

function migrateLegacyWerewolfRules(
  value: object,
  remembered: RememberedGameConfigs,
): RememberedGameConfigs {
  const current = remembered['werewolf'] ?? {};
  const migrated: Record<string, ConfigFieldValue> = { ...current };
  for (const key of LEGACY_WEREWOLF_RULE_KEYS) {
    const legacy: unknown = Reflect.get(value, key);
    if (typeof legacy === 'boolean' && !(key in current)) migrated[key] = legacy;
  }
  return { ...remembered, werewolf: migrated };
}

function parsePersistedSettings(value: unknown): UserSettings {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    settingsServiceLog.warn('Invalid persisted settings payload, resetting to defaults', value);
    return { ...DEFAULT_SETTINGS };
  }

  return {
    rememberedGameConfigs: migrateLegacyWerewolfRules(
      value,
      readPersistedRememberedGameConfigs(Reflect.get(value, 'rememberedGameConfigs')),
    ),
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
    seatDecorationsEnabled: readPersistedBoolean(
      Reflect.get(value, 'seatDecorationsEnabled'),
      'seatDecorationsEnabled',
      DEFAULT_SETTINGS.seatDecorationsEnabled,
    ),
  };
}

/**
 * SettingsService — user preferences for audio and room creation defaults.
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
   * Commit settings only after storage succeeds; propagate write failures to the caller.
   */
  async #save(settings: UserSettings): Promise<void> {
    storage.set(USER_SETTINGS_KEY, JSON.stringify(settings));
    this.#settings = settings;
    this.#notifyListeners();
  }

  /**
   * Remembered values for every `isRemembered` field of a game's schema: the
   * stored value when it still passes the field spec, otherwise the schema
   * default. Fields that are not remembered are absent.
   */
  getRememberedGameConfig<TConfig extends object>(
    gameType: GameType,
    schema: GameConfigSchema<TConfig>,
  ): Partial<TConfig> {
    const stored = this.#settings.rememberedGameConfigs[gameType] ?? {};
    const defaults: Readonly<Record<string, unknown>> = Object.fromEntries(
      Object.entries(schema.defaults),
    );
    let remembered: Partial<TConfig> = {};
    for (const key in schema.fields) {
      const spec: AnyConfigFieldSpec = schema.fields[key];
      if (spec.kind === 'fixed' || spec.isRemembered !== true) continue;
      const candidate = stored[key];
      const value =
        candidate !== undefined && validateConfigFieldValue(spec, candidate) === null
          ? candidate
          : defaults[key];
      remembered = { ...remembered, [key]: value };
    }
    return remembered;
  }

  /** Persist one remembered lobby-config field without changing any room state. */
  async setRememberedGameConfigField(
    gameType: GameType,
    key: string,
    value: ConfigFieldValue,
  ): Promise<void> {
    const current = this.#settings.rememberedGameConfigs[gameType] ?? {};
    await this.#save({
      ...this.#settings,
      rememberedGameConfigs: {
        ...this.#settings.rememberedGameConfigs,
        [gameType]: { ...current, [key]: value },
      },
    });
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
    await this.#save({ ...this.#settings, bgmEnabled: enabled });
  }

  /**
   * Toggle BGM setting and persist. Returns new value.
   */
  async toggleBgm(): Promise<boolean> {
    await this.setBgmEnabled(!this.#settings.bgmEnabled);
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
    await this.#save({ ...this.#settings, bgmTrack: track });
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
    await this.#save({ ...this.#settings, bgmVolume: requireFiniteVolume(volume, 'bgmVolume') });
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
    await this.#save({
      ...this.#settings,
      gameAudioVolume: requireFiniteVolume(volume, 'gameAudioVolume'),
    });
  }

  // =========================================================================
  // Display
  // =========================================================================

  /**
   * Whether seat decorations (flairs / pets / arrival animations) render in the room grid.
   */
  isSeatDecorationsEnabled(): boolean {
    return this.#settings.seatDecorationsEnabled;
  }

  /**
   * Set seat decorations visibility and persist.
   */
  async setSeatDecorationsEnabled(enabled: boolean): Promise<void> {
    await this.#save({ ...this.#settings, seatDecorationsEnabled: enabled });
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
