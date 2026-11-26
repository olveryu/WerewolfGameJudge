/** Counts above this read as `99+` on every unused-ticket badge. */
export const TICKET_BADGE_MAX = 99;

/** The text of an unused-ticket badge: the count, capped at `99+`. */
export function formatTicketBadgeCount(count: number): string {
  return count > TICKET_BADGE_MAX ? `${TICKET_BADGE_MAX}+` : String(count);
}
