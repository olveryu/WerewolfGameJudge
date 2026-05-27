/**
 * storageKeys - MMKV key constants
 *
 * All cross-file MMKV keys are defined here. No magic string literals allowed.
 * Pure constants module — no business logic or side effects.
 */

/** Recent room code list JSON (string[], most recent first, max 5 items) */
export const RECENT_ROOM_CODES_KEY = 'recentRoomCodes';

/** Latest announcement version the user has seen (What's New dialog) */
export const LAST_SEEN_VERSION_KEY = '@werewolf_last_seen_version';

/** Admin portal password cache */
export const ADMIN_PASSWORD_KEY = 'admin_password';
