/**
 * storageKeys - MMKV key constants
 *
 * All cross-file MMKV keys are defined here. No magic string literals allowed.
 * Pure constants module — no business logic or side effects.
 */

/** Recent room code list JSON (string[], most recent first, max 5 items) */
export const RECENT_ROOM_CODES_KEY = 'recentRoomCodes';

/** Unacknowledged room creation intents used for exact retry after restart. */
export const ROOM_CREATION_INTENTS_KEY = '@room_creation_intents';

/** Persisted product-level user settings JSON. */
export const USER_SETTINGS_KEY = '@user_settings';

/** Latest announcement version the user has seen (What's New dialog) */
export const LAST_SEEN_ANNOUNCEMENT_VERSION_KEY = '@last_seen_announcement_version';

/** Admin portal password cache */
export const ADMIN_PASSWORD_KEY = 'admin_password';
