/**
 * User audio preferences, fields of the persisted `@user_settings` object (same keys as the RN
 * client, so saved choices carry over). An external store: components read it with
 * `useSyncExternalStore`; setters write storage first and throw when it fails, leaving the
 * snapshot unchanged.
 */
import type { BgmTrackSetting } from '@/features/product/model/BgmCatalog';
import { BGM_VOLUME, isBgmTrackSetting } from '@/features/product/model/BgmCatalog';
import { createLogger } from '@/utils/logger';

import { readUserSettings, writeUserSettings } from './services/userSettingsStorage';

const settingsLog = createLogger('Settings');

export interface AudioSettings {
  /** Whether background music plays during the night. */
  readonly bgmEnabled: boolean;
  /** Selected BGM track, or `'random'` for the shuffled playlist. */
  readonly bgmTrack: BgmTrackSetting;
  /** BGM volume 0.0–1.0. */
  readonly bgmVolume: number;
  /** Foreground game audio volume 0.0–1.0. */
  readonly gameAudioVolume: number;
}

const DEFAULTS: AudioSettings = {
  bgmEnabled: true,
  bgmTrack: 'random',
  bgmVolume: BGM_VOLUME,
  gameAudioVolume: 1,
};

function clampVolume(volume: number): number {
  return Math.max(0, Math.min(1, volume));
}

function readBoolean(value: unknown, name: string, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  if (typeof value === 'boolean') return value;
  settingsLog.warn(`Invalid persisted ${name}, resetting to default`, value);
  return fallback;
}

function readVolume(value: unknown, name: string, fallback: number): number {
  if (value === undefined) return fallback;
  if (typeof value === 'number' && Number.isFinite(value)) return clampVolume(value);
  settingsLog.warn(`Invalid persisted ${name}, resetting to default`, value);
  return fallback;
}

function readBgmTrack(value: unknown): BgmTrackSetting {
  if (value === undefined) return DEFAULTS.bgmTrack;
  if (isBgmTrackSetting(value)) return value;
  settingsLog.warn('Invalid persisted bgmTrack, resetting to default', value);
  return DEFAULTS.bgmTrack;
}

function parseAudioSettings(stored: Readonly<Record<string, unknown>>): AudioSettings {
  return {
    bgmEnabled: readBoolean(stored['bgmEnabled'], 'bgmEnabled', DEFAULTS.bgmEnabled),
    bgmTrack: readBgmTrack(stored['bgmTrack']),
    bgmVolume: readVolume(stored['bgmVolume'], 'bgmVolume', DEFAULTS.bgmVolume),
    gameAudioVolume: readVolume(
      stored['gameAudioVolume'],
      'gameAudioVolume',
      DEFAULTS.gameAudioVolume,
    ),
  };
}

function requireFiniteVolume(volume: number, name: string): number {
  if (!Number.isFinite(volume)) {
    throw new TypeError(`[FAIL-FAST] ${name} must be a finite number`);
  }
  return clampVolume(volume);
}

let snapshot: AudioSettings = parseAudioSettings(readUserSettings());
const listeners = new Set<() => void>();

function save(patch: Partial<AudioSettings>): void {
  const next = { ...snapshot, ...patch };
  writeUserSettings(next);
  snapshot = next;
  for (const listener of listeners) listener();
}

/** Audio settings store. */
export const audioSettings = {
  subscribe: (listener: () => void): (() => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot: (): AudioSettings => snapshot,
  setBgmEnabled: (enabled: boolean): void => save({ bgmEnabled: enabled }),
  /** Flips `bgmEnabled` and returns the new value. */
  toggleBgm: (): boolean => {
    const enabled = !snapshot.bgmEnabled;
    save({ bgmEnabled: enabled });
    return enabled;
  },
  setBgmTrack: (track: BgmTrackSetting): void => save({ bgmTrack: track }),
  setBgmVolume: (volume: number): void =>
    save({ bgmVolume: requireFiniteVolume(volume, 'bgmVolume') }),
  setGameAudioVolume: (volume: number): void =>
    save({ gameAudioVolume: requireFiniteVolume(volume, 'gameAudioVolume') }),
};
