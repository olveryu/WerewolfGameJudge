/** Local credential store for the standalone admin-token flow. */

import { ADMIN_PASSWORD_KEY } from '@/config/storageKeys';
import { storage } from '@/services/infra/localStorage';

function requireAdminCredential(credential: string): string {
  if (credential.length === 0 || credential !== credential.trim()) {
    throw new Error('[FAIL-FAST] Admin credential must be a trimmed non-empty string');
  }
  return credential;
}

export function readAdminCredential(): string | null {
  const credential = storage.getString(ADMIN_PASSWORD_KEY);
  return credential === undefined ? null : requireAdminCredential(credential);
}

export function writeAdminCredential(credential: string): void {
  storage.set(ADMIN_PASSWORD_KEY, requireAdminCredential(credential));
}

export function clearAdminCredential(): void {
  storage.remove(ADMIN_PASSWORD_KEY);
}
