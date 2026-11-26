/** Counts above this read as `99+` on every unused-ticket badge. */
export const TICKET_BADGE_MAX = 99;

/**
 * The text of an unused-ticket badge, or `null` when there is no ticket and no badge shows: the
 * one rule every ticket badge follows (shown above zero, capped at `99+`).
 */
export function ticketBadgeText(count: number): string | null {
  if (count <= 0) return null;
  return count > TICKET_BADGE_MAX ? `${TICKET_BADGE_MAX}+` : String(count);
}
