/**
 * App-wide synchronous key-value storage over `localStorage`.
 *
 * Keys keep the `mmkv.default\` prefix the React Native client's MMKV web backend wrote, so
 * sessions and settings already on users' devices stay readable after the switch.
 */
const KEY_PREFIX = 'mmkv.default\\';

/** The `localStorage` item name that backs app storage `key`. */
export function prefixedStorageKey(key: string): string {
  if (key === '' || key.includes('\\')) {
    throw new Error(`Invalid storage key "${key}"`);
  }
  return `${KEY_PREFIX}${key}`;
}

/** Synchronous storage API used across the client. */
export const storage = {
  getString(key: string): string | undefined {
    return window.localStorage.getItem(prefixedStorageKey(key)) ?? undefined;
  },
  getBoolean(key: string): boolean | undefined {
    const value = window.localStorage.getItem(prefixedStorageKey(key));
    return value === null ? undefined : value === 'true';
  },
  set(key: string, value: string | boolean | number): void {
    window.localStorage.setItem(prefixedStorageKey(key), String(value));
  },
  remove(key: string): void {
    window.localStorage.removeItem(prefixedStorageKey(key));
  },
};
