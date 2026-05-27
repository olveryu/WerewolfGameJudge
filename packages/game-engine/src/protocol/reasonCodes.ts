/**
 * Reason Codes - Seat operation rejection reason constants
 *
 * Two categories:
 * 1. Business Reason - business logic rejection (from handler)
 * 2. Transport Reason - transport layer reason (from Facade transport)
 */

// ============================================================
// Business Reason Codes (from handler)
// ============================================================

/** Not authenticated */
export const REASON_NOT_AUTHENTICATED = 'not_authenticated' as const;

/** No game state (store not initialized) */
export const REASON_NO_STATE = 'no_state' as const;

/** Invalid seat number */
export const REASON_INVALID_SEAT = 'invalid_seat' as const;

/** Seat already taken */
export const REASON_SEAT_TAKEN = 'seat_taken' as const;

/** Game in progress; action not allowed */
export const REASON_GAME_IN_PROGRESS = 'game_in_progress' as const;

/** Player not seated */
export const REASON_NOT_SEATED = 'not_seated' as const;

/** Non-host action not allowed */
export const REASON_NOT_HOST = 'not_host' as const;

/** Target seat is empty */
export const REASON_SEAT_EMPTY = 'seat_empty' as const;

// ============================================================
// Type Union
// ============================================================
