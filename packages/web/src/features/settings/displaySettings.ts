/**
 * User display preferences, fields of the persisted `@user_settings` object. An external store: components read it with `useSyncExternalStore`; setters
 * write storage first and throw when it fails, leaving the snapshot unchanged.
 */
import type { SceneFrameRate } from '@/scene/stage';

import { readUserSettings, writeUserSettings } from './userSettingsStorage';

export interface DisplaySettings {
  /** Seat flairs, pets and arrival animations in the room grid; off saves battery. */
  readonly seatDecorationsEnabled: boolean;
  /** Scene-layer frame cap (decision D3). */
  readonly sceneFrameRate: SceneFrameRate;
}

const DEFAULTS: DisplaySettings = { seatDecorationsEnabled: true, sceneFrameRate: 60 };

function parseDisplaySettings(stored: Readonly<Record<string, unknown>>): DisplaySettings {
  const decorations = stored['seatDecorationsEnabled'];
  const frameRate = stored['sceneFrameRate'];
  return {
    seatDecorationsEnabled:
      typeof decorations === 'boolean' ? decorations : DEFAULTS.seatDecorationsEnabled,
    sceneFrameRate: frameRate === 30 || frameRate === 60 ? frameRate : DEFAULTS.sceneFrameRate,
  };
}

let snapshot: DisplaySettings = parseDisplaySettings(readUserSettings());
const listeners = new Set<() => void>();

function save(patch: Partial<DisplaySettings>): void {
  const next = { ...snapshot, ...patch };
  writeUserSettings(next);
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
