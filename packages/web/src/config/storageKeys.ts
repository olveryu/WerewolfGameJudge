/**
 * Storage key constants shared across files. Pure constants; no magic string keys elsewhere.
 */

/** Durable room commands awaiting one authoritative decision (RoomLink CommandOutbox v2). */
export const ROOM_COMMAND_OUTBOX_KEY = '@room_command_outbox_v2';

/** Persisted user settings JSON (display, audio, remembered room configs). */
export const USER_SETTINGS_KEY = '@user_settings';
/** Admin portal password cache */
export const ADMIN_PASSWORD_KEY = 'admin_password';
/** Player-page destination retained while the current tab visits the admin workspace. */
export const ADMIN_RETURN_TO_KEY = '@admin_return_to';
/** Unresolved admin ticket grants, partitioned by recipient ID. */
export const ADMIN_REWARD_OPERATION_KEY = '@admin_reward_operation';

/** Unacknowledged room creation intents used for exact retry after restart. */
export const ROOM_CREATION_INTENTS_KEY = '@room_creation_intents';

/** One unresolved gacha draw or shard exchange per account, replayed with its original key. */
export const GACHA_OPERATION_KEY = '@gacha_operation';

/** App version whose release announcement the user last dismissed. */
export const LAST_SEEN_ANNOUNCEMENT_VERSION_KEY = '@last_seen_announcement_version';
