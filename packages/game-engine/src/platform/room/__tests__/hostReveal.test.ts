import { describe, expect, it } from 'vitest';

import { appendRevelation, hasBeenRevealed, type HostRevelation } from '../hostReveal';

describe('hostReveal record helpers', () => {
  it('starts empty: nothing has been revealed', () => {
    expect(hasBeenRevealed([], 3)).toBe(false);
  });

  it('appends reveals immutably and detects them by seat', () => {
    const empty: readonly HostRevelation<string>[] = [];
    const once = appendRevelation(empty, 3, 'honest', 100);
    expect(empty).toEqual([]);
    expect(once).toEqual([{ seat: 3, role: 'honest', revealedAt: 100 }]);
    expect(hasBeenRevealed(once, 3)).toBe(true);
    expect(hasBeenRevealed(once, 4)).toBe(false);

    const twice = appendRevelation(once, 5, 'fibber', 200);
    expect(twice.map((revelation) => revelation.seat)).toEqual([3, 5]);
    expect(once).toHaveLength(1);
  });
});
