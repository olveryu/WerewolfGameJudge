import { describe, expect, it } from 'vitest';

import { formatTicketBadgeCount, TICKET_BADGE_MAX } from '../ticketBadgeCount';

describe('formatTicketBadgeCount', () => {
  it('shows the count up to the cap, and 99+ above it', () => {
    expect(formatTicketBadgeCount(1)).toBe('1');
    expect(formatTicketBadgeCount(TICKET_BADGE_MAX)).toBe('99');
    expect(formatTicketBadgeCount(TICKET_BADGE_MAX + 1)).toBe('99+');
  });
});
