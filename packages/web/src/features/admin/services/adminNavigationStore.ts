import { ADMIN_RETURN_TO_KEY } from '@/config/storageKeys';
import { tabStorage } from '@/services/infra/localStorage';

/** Read the entry destination retained for this tab's current admin visit. */
export function readAdminReturnTo(): string | null {
  return tabStorage.getString(ADMIN_RETURN_TO_KEY) ?? null;
}

/** Save the entry destination before navigating away from the player page. */
export function rememberAdminReturnTo(returnTo: string): void {
  tabStorage.set(ADMIN_RETURN_TO_KEY, returnTo);
}

/** Discard the destination when leaving the admin workspace. */
export function clearAdminReturnTo(): void {
  tabStorage.remove(ADMIN_RETURN_TO_KEY);
}
