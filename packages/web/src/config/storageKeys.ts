/**
 * Storage key constants shared across files. Pure constants; no magic string keys elsewhere.
 */

/** Durable room commands awaiting one authoritative decision (RoomLink CommandOutbox v2). */
export const ROOM_COMMAND_OUTBOX_KEY = '@room_command_outbox_v2';

/** Persisted user settings JSON (display, audio, remembered room configs). */
export const USER_SETTINGS_KEY = '@user_settings';
