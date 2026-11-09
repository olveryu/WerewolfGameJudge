/**
 * User display preferences, persisted as one JSON object under `@user_settings` (the RN client's
 * key and shape). An external store: components read it with `useSyncExternalStore`; setters
 * write storage first and throw when it fails, leaving the snapshot unchanged.
 */
import { USER_SETTINGS_KEY } from '@/config/storageKeys';
import type { SceneFrameRate } from '@/scene/stage';
import { storage } from '@/services/infra/localStorage';
import { createLogger } from '@/utils/logger';

const settingsLog = createLogger('Settings');

export interface DisplaySettings {
  /** Seat flairs, pets and arrival animations in the room grid; off saves battery. */
  readonly seatDecorationsEnabled: boolean;
  /** Scene-layer frame cap (decision D3). */
  readonly sceneFrameRate: SceneFrameRate;
}

const DEFAULTS: DisplaySettings = { seatDecorationsEnabled: true, sceneFrameRate: 60 };

/** Storage quota or privacy-mode failures: environment limits, not bugs. */
export function isExpectedStorageError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === 'QuotaExceededError' || error.name === 'SecurityError')
  );
}

function readStored(): Record<string, unknown> {
  const raw = storage.getString(USER_SETTINGS_KEY);
  if (raw === undefined) return {};
  const parsed: unknown = JSON.parse(raw);
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    settingsLog.warn('Invalid persisted settings payload, resetting to defaults', parsed);
    return {};
  }
  return { ...parsed };
}

function parseDisplaySettings(stored: Record<string, unknown>): DisplaySettings {
  const decorations = stored['seatDecorationsEnabled'];
  const frameRate = stored['sceneFrameRate'];
  return {
    seatDecorationsEnabled:
      typeof decorations === 'boolean' ? decorations : DEFAULTS.seatDecorationsEnabled,
    sceneFrameRate: frameRate === 30 || frameRate === 60 ? frameRate : DEFAULTS.sceneFrameRate,
  };
}

let snapshot: DisplaySettings = parseDisplaySettings(readStored());
const listeners = new Set<() => void>();

function save(patch: Partial<DisplaySettings>): void {
  const next = { ...snapshot, ...patch };
  storage.set(USER_SETTINGS_KEY, JSON.stringify({ ...readStored(), ...next }));
  snapshot = next;
  for (const listener of listeners) listener();
}

/** Display settings store. */
export const displaySettings = {
  subscribe: (listener: () => void): (() => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot: (): DisplaySettings => snapshot,
  setSeatDecorationsEnabled: (enabled: boolean): void => save({ seatDecorationsEnabled: enabled }),
  setSceneFrameRate: (frameRate: SceneFrameRate): void => save({ sceneFrameRate: frameRate }),
};
