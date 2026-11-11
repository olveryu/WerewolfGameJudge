/** Persist the admin-only color preference through the shared storage boundary. */
import { ADMIN_THEME_KEY } from '@/config/storageKeys';
import { storage } from '@/services/infra/localStorage';

export type AdminTheme = 'light' | 'dark';

/** Default to the operating system until the administrator makes an explicit choice. */
export function readAdminTheme(): AdminTheme {
  const saved = storage.getString(ADMIN_THEME_KEY);
  if (saved === 'light' || saved === 'dark') return saved;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** Persist an explicit preference without changing the game palette. */
export function writeAdminTheme(theme: AdminTheme): void {
  storage.set(ADMIN_THEME_KEY, theme);
}
