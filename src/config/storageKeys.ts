/**
 * storageKeys - MMKV key constants
 *
 * All cross-file MMKV keys are defined here. No magic string literals allowed.
 * Pure constants module — no business logic or side effects.
 */

/** Unacknowledged room creation intents used for exact retry after restart. */
export const ROOM_CREATION_INTENTS_KEY = '@room_creation_intents';

/** Confirmed room commands awaiting one authoritative decision. */
export const ROOM_COMMAND_RECOVERY_KEY = '@room_command_recovery';

/** Persisted product-level user settings JSON. */
export const USER_SETTINGS_KEY = '@user_settings';

/** Latest announcement version the user has seen (What's New dialog) */
export const LAST_SEEN_ANNOUNCEMENT_VERSION_KEY = '@last_seen_announcement_version';

/** Admin portal password cache */
export const ADMIN_PASSWORD_KEY = 'admin_password';
