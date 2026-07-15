/**
 * formatSeat — 0-based seat index → user-readable 1-based display label
 *
 * Single global entry point for seat number formatting. All user-facing text (UI, alerts, logs,
 * error messages) must use this function; ad-hoc `seat + 1` conversions are forbidden.
 * Engine-internal logic stays 0-based and does not call this function.
 */

/** 0-based seat index → "N号" display string (1-indexed). */
export function formatSeat(seat: number): string {
  return `${seat + 1}号`;
}
