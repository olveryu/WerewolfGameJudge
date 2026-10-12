/** deriveRemainingRevealCards (AU-22, ruling 5): occupied minus viewed, clamped at zero. */
import { deriveRemainingRevealCards } from '../RevealRoleData';

describe('deriveRemainingRevealCards', () => {
  it('counts unviewed seats', () => {
    expect(deriveRemainingRevealCards(6, 2)).toBe(4);
    expect(deriveRemainingRevealCards(6, 0)).toBe(6);
    expect(deriveRemainingRevealCards(6, 6)).toBe(0);
  });

  it('never goes negative when records outlive seats', () => {
    expect(deriveRemainingRevealCards(4, 5)).toBe(0);
  });
});
