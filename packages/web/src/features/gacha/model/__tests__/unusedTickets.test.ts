import { describe, expect, it } from 'vitest';

import { countUnusedTickets } from '../unusedTickets';

describe('countUnusedTickets', () => {
  it('counts normal and golden draws together', () => {
    expect(countUnusedTickets({ normalDraws: 3, goldenDraws: 2 })).toBe(5);
    expect(countUnusedTickets({ normalDraws: 0, goldenDraws: 0 })).toBe(0);
  });
});
