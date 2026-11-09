/**
 * The persisted `@user_settings` JSON object (the RN client's key and shape). Each settings
 * module owns its own fields and merges them into the stored object on write, so modules never
 * overwrite one another.
 */
import { USER_SETTINGS_KEY } from '@/config/storageKeys';
import { storage } from '@/services/infra/localStorage';
import { createLogger } from '@/utils/logger';

const settingsLog = createLogger('Settings');

/** Storage quota or privacy-mode failures: environment limits, not bugs. */
export function isExpectedStorageError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === 'QuotaExceededError' || error.name === 'SecurityError')
  );
}

export function isPlainRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The stored settings object; an unreadable payload reads as empty. */
export function readUserSettings(): Readonly<Record<string, unknown>> {
  const raw = storage.getString(USER_SETTINGS_KEY);
  if (raw === undefined) return {};
  const parsed: unknown = JSON.parse(raw);
  if (!isPlainRecord(parsed)) {
    settingsLog.warn('Invalid persisted settings payload, resetting to defaults', parsed);
    return {};
  }
  return parsed;
}

/** Merges `patch` into the stored object; throws when storage rejects the write. */
export function writeUserSettings(patch: Readonly<Record<string, unknown>>): void {
  storage.set(USER_SETTINGS_KEY, JSON.stringify({ ...readUserSettings(), ...patch }));
}
