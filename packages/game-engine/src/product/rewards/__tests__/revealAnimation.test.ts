import {
  parseResolvedRoleRevealAnimation,
  RANDOMIZABLE_ANIMATIONS,
  type ResolvedRoleRevealAnimation,
  resolveRandomAnimation,
  type RoleRevealAnimation,
} from '@game-judge/game-engine/product/rewards';

describe('reveal animation policy', () => {
  it('derives the twelve randomizable effects from the reward catalog', () => {
    expect(RANDOMIZABLE_ANIMATIONS).toHaveLength(12);
    expect(RANDOMIZABLE_ANIMATIONS).toEqual(
      expect.arrayContaining([
        'roulette',
        'roleHunt',
        'scratch',
        'tarot',
        'gachaMachine',
        'cardPick',
        'sealBreak',
        'chainShatter',
        'fortuneWheel',
        'meteorStrike',
        'filmRewind',
        'vortexCollapse',
      ]),
    );
    expect(RANDOMIZABLE_ANIMATIONS).not.toContain('none');
    expect(RANDOMIZABLE_ANIMATIONS).not.toContain('random');
  });

  it('keeps fixed seed mappings stable', () => {
    expect(resolveRandomAnimation('room-1234')).toBe('vortexCollapse');
    expect(resolveRandomAnimation('a')).toBe('vortexCollapse');
    expect(resolveRandomAnimation('1234u1')).toBe('meteorStrike');

    for (const seed of ['a', 'b', 'c', '123', 'room1']) {
      expect(RANDOMIZABLE_ANIMATIONS).toContain(resolveRandomAnimation(seed));
    }
  });

  it('deterministically avoids the previous effect', () => {
    for (let index = 0; index < 1_000; index += 1) {
      const seed = `anti-repeat-${index}`;
      const previous = resolveRandomAnimation(seed);
      const next = resolveRandomAnimation(seed, previous);
      expect(next).not.toBe(previous);
      expect(next).toBe(resolveRandomAnimation(seed, previous));
    }
  });

  it('keeps public configured and resolved effect types distinct', () => {
    const configured: RoleRevealAnimation = 'random';
    const resolved: ResolvedRoleRevealAnimation = 'roulette';
    expect(configured).toBe('random');
    expect(resolved).toBe('roulette');
  });

  it('parses resolved effects and rejects unresolved or stale values', () => {
    expect(parseResolvedRoleRevealAnimation('roulette')).toBe('roulette');
    expect(parseResolvedRoleRevealAnimation('none')).toBe('none');
    expect(() => parseResolvedRoleRevealAnimation('random')).toThrow('[FAIL-FAST]');
    expect(() => parseResolvedRoleRevealAnimation('retiredEffect')).toThrow('[FAIL-FAST]');
  });
});
