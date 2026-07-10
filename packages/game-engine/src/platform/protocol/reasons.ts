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
