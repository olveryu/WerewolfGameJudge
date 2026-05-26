/**
 * recentRooms — recent room code management (MMKV local storage)
 *
 * Maintains at most MAX_RECENT_ROOMS room codes, newest first, deduplicated.
 */

import { RECENT_ROOM_CODES_KEY } from '@/config/storageKeys';
import { storage } from '@/lib/storage';

const MAX_RECENT_ROOMS = 5;

/** Read recent room code list from local storage (newest first). */
export function getRecentRooms(): string[] {
  const raw = storage.getString(RECENT_ROOM_CODES_KEY);
  if (!raw) return [];
  return JSON.parse(raw) as string[];
}

/**
 * Add room code to head of recent list, deduplicate, and truncate to MAX_RECENT_ROOMS.
 *
 * @param roomCode - room code
 */
export function addRecentRoom(roomCode: string): void {
  const list = getRecentRooms().filter((c) => c !== roomCode);
  list.unshift(roomCode);
  if (list.length > MAX_RECENT_ROOMS) list.length = MAX_RECENT_ROOMS;
  storage.set(RECENT_ROOM_CODES_KEY, JSON.stringify(list));
}

/**
 * Remove specified room code from recent list.
 *
 * @param roomCode - room code to remove
 */
export function removeRecentRoom(roomCode: string): void {
  const list = getRecentRooms().filter((c) => c !== roomCode);
  storage.set(RECENT_ROOM_CODES_KEY, JSON.stringify(list));
}

/** Clear all recent room records. */
export function clearRecentRooms(): void {
  storage.remove(RECENT_ROOM_CODES_KEY);
}
