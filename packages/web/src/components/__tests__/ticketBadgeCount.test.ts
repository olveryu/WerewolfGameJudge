import { describe, expect, it } from 'vitest';

import { TICKET_BADGE_MAX, ticketBadgeText } from '../ticketBadgeCount';

describe('ticketBadgeText', () => {
  it('shows no badge without tickets', () => {
    expect(ticketBadgeText(0)).toBeNull();
    expect(ticketBadgeText(-1)).toBeNull();
  });

  it('shows the count up to the cap, and 99+ above it', () => {
    expect(ticketBadgeText(1)).toBe('1');
    expect(ticketBadgeText(TICKET_BADGE_MAX)).toBe('99');
    expect(ticketBadgeText(TICKET_BADGE_MAX + 1)).toBe('99+');
  });
});
