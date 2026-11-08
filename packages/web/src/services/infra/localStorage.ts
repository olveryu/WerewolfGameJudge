/**
 * App-wide synchronous key-value storage over `localStorage`.
 *
 * Keys keep the `mmkv.default\` prefix the React Native client's MMKV web backend wrote, so
 * sessions and settings already on users' devices stay readable after the switch.
 */
const KEY_PREFIX = 'mmkv.default\\';

function prefixed(key: string): string {
  if (key === '' || key.includes('\\')) {
    throw new Error(`Invalid storage key "${key}"`);
  }
  return `${KEY_PREFIX}${key}`;
}

/** Synchronous storage API used across the client. */
export const storage = {
  getString(key: string): string | undefined {
    return window.localStorage.getItem(prefixed(key)) ?? undefined;
  },
  getBoolean(key: string): boolean | undefined {
    const value = window.localStorage.getItem(prefixed(key));
    return value === null ? undefined : value === 'true';
  },
  set(key: string, value: string | boolean | number): void {
    window.localStorage.setItem(prefixed(key), String(value));
  },
  remove(key: string): void {
    window.localStorage.removeItem(prefixed(key));
  },
};
