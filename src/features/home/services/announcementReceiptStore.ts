/** Local receipt for the product announcement shown at a given app version. */

import { LAST_SEEN_ANNOUNCEMENT_VERSION_KEY } from '@/config/storageKeys';
import { storage } from '@/services/infra/localStorage';

function requireVersion(version: string): string {
  if (version.length === 0) throw new Error('[FAIL-FAST] Announcement version must not be empty');
  return version;
}

export function hasSeenAnnouncement(version: string): boolean {
  const seenVersion = storage.getString(LAST_SEEN_ANNOUNCEMENT_VERSION_KEY);
  return seenVersion === undefined
    ? false
    : requireVersion(seenVersion) === requireVersion(version);
}

export function markAnnouncementSeen(version: string): void {
  storage.set(LAST_SEEN_ANNOUNCEMENT_VERSION_KEY, requireVersion(version));
}
