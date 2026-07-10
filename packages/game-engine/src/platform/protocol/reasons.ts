/**
 * Stable room-operation reason codes shared by every game engine.
 *
 * Transport and UI layers may translate these codes, but game modules must not
 * invent game-specific names for equivalent room operations.
 */

export const REASON_NOT_AUTHENTICATED = 'not_authenticated' as const;
export const REASON_NO_STATE = 'no_state' as const;
export const REASON_INVALID_SEAT = 'invalid_seat' as const;
export const REASON_SEAT_TAKEN = 'seat_taken' as const;
export const REASON_GAME_IN_PROGRESS = 'game_in_progress' as const;
export const REASON_NOT_SEATED = 'not_seated' as const;
export const REASON_NOT_HOST = 'not_host' as const;
export const REASON_SEAT_EMPTY = 'seat_empty' as const;
export const REASON_USER_ACTOR_REQUIRED = 'user_actor_required' as const;
export const REASON_SYSTEM_ACTOR_REQUIRED = 'system_actor_required' as const;
export const REASON_CONTROLLED_SEAT_NOT_ALLOWED = 'controlled_seat_not_allowed' as const;
export const REASON_CONTROLLED_SEAT_NOT_BOT = 'controlled_seat_not_bot' as const;
export const REASON_ROOM_CODE_MISMATCH = 'room_code_mismatch' as const;
export const REASON_COMMAND_ID_CONFLICT = 'command_id_conflict' as const;
export const REASON_ROOM_INITIALIZATION_CONFLICT = 'room_initialization_conflict' as const;
export const REASON_ROOM_CODE_CONFLICT = 'room_code_conflict' as const;
