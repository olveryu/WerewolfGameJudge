/**
 * Synchronous key-value storage for durable settings and tab-scoped state.
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

/** Durable storage API used across the client. */
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

/** Tab-local storage that survives reloads without sharing navigation state across tabs. */
export const tabStorage = {
  getString(key: string): string | undefined {
    return window.sessionStorage.getItem(prefixedStorageKey(key)) ?? undefined;
  },
  set(key: string, value: string): void {
    window.sessionStorage.setItem(prefixedStorageKey(key), value);
  },
  remove(key: string): void {
    window.sessionStorage.removeItem(prefixedStorageKey(key));
  },
};
