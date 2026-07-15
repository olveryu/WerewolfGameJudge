import {
  AVATAR_IDS,
  FRAME_IDS,
  FREE_AVATAR_IDS,
  FREE_FLAIR_IDS,
  FREE_FRAME_IDS,
  FREE_NAME_STYLE_IDS,
  FREE_ROLE_REVEAL_EFFECT_IDS,
  FREE_SEAT_ANIMATION_IDS,
  getItemRarity,
  NAME_STYLE_IDS,
  REWARD_POOL,
  ROLE_REVEAL_EFFECT_IDS,
  SEAT_ANIMATION_IDS,
  SEAT_FLAIR_IDS,
} from '../catalog';
import {
  getUnlockedAvatars,
  getUnlockedFlairs,
  getUnlockedFrames,
  getUnlockedNameStyles,
  getUnlockedSeatAnimations,
  isFlairUnlocked,
  isFrameUnlocked,
  isNameStyleUnlocked,
  isRoleRevealEffectUnlocked,
  isSeatAnimationUnlocked,
  parseUnlockedRewardIds,
} from '../unlocks';

describe('rewardCatalog', () => {
  it('returns common for a registered item without an explicit rarity override', () => {
    expect(getItemRarity('genC001')).toBe('common');
  });

  it('fails fast for an item outside the catalog', () => {
    expect(() => getItemRarity('nonExistent')).toThrow(
      '[FAIL-FAST] Unknown reward item ID: nonExistent',
    );
  });

  it('REWARD_POOL has correct total items (avatars + frames + flairs + nameStyles + roleRevealEffects + seatAnimations - free)', () => {
    expect(REWARD_POOL).toHaveLength(
      AVATAR_IDS.length +
        FRAME_IDS.length +
        SEAT_FLAIR_IDS.length +
        NAME_STYLE_IDS.length +
        ROLE_REVEAL_EFFECT_IDS.length +
        SEAT_ANIMATION_IDS.length -
        FREE_AVATAR_IDS.size -
        FREE_FRAME_IDS.size -
        FREE_FLAIR_IDS.size -
        FREE_NAME_STYLE_IDS.size -
        FREE_ROLE_REVEAL_EFFECT_IDS.size -
        FREE_SEAT_ANIMATION_IDS.size,
    );
  });

  it('REWARD_POOL excludes free items', () => {
    const poolIds = new Set(REWARD_POOL.map((r) => r.id));
    for (const id of FREE_AVATAR_IDS) expect(poolIds.has(id)).toBe(false);
    for (const id of FREE_FRAME_IDS) expect(poolIds.has(id)).toBe(false);
    for (const id of FREE_FLAIR_IDS) expect(poolIds.has(id)).toBe(false);
    for (const id of FREE_NAME_STYLE_IDS) expect(poolIds.has(id)).toBe(false);
  });

  it('all REWARD_POOL ids are unique', () => {
    const ids = REWARD_POOL.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('contains correct avatar/frame/flair/nameStyle counts', () => {
    const avatars = REWARD_POOL.filter((r) => r.type === 'avatar');
    const frames = REWARD_POOL.filter((r) => r.type === 'frame');
    const flairs = REWARD_POOL.filter((r) => r.type === 'seatFlair');
    const nameStyles = REWARD_POOL.filter((r) => r.type === 'nameStyle');
    expect(avatars).toHaveLength(AVATAR_IDS.length - FREE_AVATAR_IDS.size);
    expect(frames).toHaveLength(200);
    expect(flairs).toHaveLength(210);
    expect(nameStyles).toHaveLength(200);
    const seatAnimations = REWARD_POOL.filter((r) => r.type === 'seatAnimation');
    expect(seatAnimations).toHaveLength(200);
  });
});

describe('parseUnlockedRewardIds', () => {
  it('parses unique catalog IDs', () => {
    expect(parseUnlockedRewardIds('["seer","moonSilver"]')).toEqual(['seer', 'moonSilver']);
  });

  it.each([
    ['invalid JSON', '{'],
    ['non-array JSON', '{}'],
    ['non-string item', '[1]'],
    ['unknown item', '["nonExistent"]'],
    ['duplicate item', '["seer","seer"]'],
  ])('fails fast for %s', (_caseName, serialized) => {
    expect(() => parseUnlockedRewardIds(serialized)).toThrow('[FAIL-FAST]');
  });
});

describe('getUnlockedAvatars', () => {
  it('returns only free avatars with empty unlocked list', () => {
    expect(getUnlockedAvatars([])).toEqual(FREE_AVATAR_IDS);
  });

  it('includes unlocked avatar ids', () => {
    const unlocked = getUnlockedAvatars(['seer', 'wolf']);
    expect(unlocked.has('seer')).toBe(true);
    expect(unlocked.has('wolf')).toBe(true);
    expect(unlocked.size).toBe(2);
  });

  it('ignores frame ids in unlock list', () => {
    const unlocked = getUnlockedAvatars(['moonSilver']);
    expect(unlocked.has('moonSilver')).toBe(false);
    expect(unlocked.size).toBe(FREE_AVATAR_IDS.size);
  });

  it('fails fast for an unknown unlock ID', () => {
    expect(() => getUnlockedAvatars(['nonExistent'])).toThrow('[FAIL-FAST]');
  });
});

describe('getUnlockedFrames', () => {
  it('returns only free frames with empty unlocked list', () => {
    expect(getUnlockedFrames([])).toEqual(FREE_FRAME_IDS);
  });

  it('includes unlocked frame ids', () => {
    const unlocked = getUnlockedFrames(['moonSilver', 'darkVine']);
    expect(unlocked.has('ironForge')).toBe(false);
    expect(unlocked.has('moonSilver')).toBe(true);
    expect(unlocked.has('darkVine')).toBe(true);
    expect(unlocked.size).toBe(2);
  });
});

describe('isFrameUnlocked', () => {
  it('ironForge is locked without explicit unlock', () => {
    expect(isFrameUnlocked('ironForge', [])).toBe(false);
  });

  it('ironForge is unlocked when in list', () => {
    expect(isFrameUnlocked('ironForge', ['ironForge'])).toBe(true);
  });

  it('non-free frame is locked without unlock', () => {
    expect(isFrameUnlocked('moonSilver', [])).toBe(false);
  });

  it('non-free frame is unlocked when in list', () => {
    expect(isFrameUnlocked('moonSilver', ['moonSilver'])).toBe(true);
  });
});

describe('getUnlockedFlairs', () => {
  it('returns only free flairs with empty unlocked list', () => {
    expect(getUnlockedFlairs([])).toEqual(FREE_FLAIR_IDS);
  });

  it('includes unlocked flair ids', () => {
    const unlocked = getUnlockedFlairs(['frostAura', 'sakura']);
    expect(unlocked.has('emberGlow')).toBe(false);
    expect(unlocked.has('frostAura')).toBe(true);
    expect(unlocked.has('sakura')).toBe(true);
    expect(unlocked.size).toBe(2);
  });

  it('ignores avatar ids in unlock list', () => {
    const unlocked = getUnlockedFlairs(['seer']);
    expect(unlocked.has('seer')).toBe(false);
    expect(unlocked.size).toBe(0);
  });
});

describe('isFlairUnlocked', () => {
  it('emberGlow is locked without explicit unlock', () => {
    expect(isFlairUnlocked('emberGlow', [])).toBe(false);
  });

  it('emberGlow is unlocked when in list', () => {
    expect(isFlairUnlocked('emberGlow', ['emberGlow'])).toBe(true);
  });

  it('non-free flair is locked without unlock', () => {
    expect(isFlairUnlocked('frostAura', [])).toBe(false);
  });

  it('non-free flair is unlocked when in list', () => {
    expect(isFlairUnlocked('frostAura', ['frostAura'])).toBe(true);
  });
});

describe('getUnlockedNameStyles', () => {
  it('returns empty set with empty unlocked list (no free nameStyles)', () => {
    expect(getUnlockedNameStyles([])).toEqual(FREE_NAME_STYLE_IDS);
  });

  it('includes unlocked nameStyle ids', () => {
    const unlocked = getUnlockedNameStyles(['silverGleam', 'phoenixRebirth']);
    expect(unlocked.has('silverGleam')).toBe(true);
    expect(unlocked.has('phoenixRebirth')).toBe(true);
    expect(unlocked.size).toBe(2);
  });

  it('ignores avatar ids in unlock list', () => {
    const unlocked = getUnlockedNameStyles(['seer']);
    expect(unlocked.has('seer')).toBe(false);
    expect(unlocked.size).toBe(0);
  });
});

describe('isNameStyleUnlocked', () => {
  it('silverGleam is locked without explicit unlock', () => {
    expect(isNameStyleUnlocked('silverGleam', [])).toBe(false);
  });

  it('silverGleam is unlocked when in list', () => {
    expect(isNameStyleUnlocked('silverGleam', ['silverGleam'])).toBe(true);
  });
});

describe('getUnlockedSeatAnimations', () => {
  it('returns only free seatAnimations with empty unlocked list', () => {
    expect(getUnlockedSeatAnimations([])).toEqual(FREE_SEAT_ANIMATION_IDS);
  });

  it('includes unlocked seatAnimation ids', () => {
    const unlocked = getUnlockedSeatAnimations(['wolfKingEntry', 'witchBrew']);
    expect(unlocked.has('wolfKingEntry')).toBe(true);
    expect(unlocked.has('witchBrew')).toBe(true);
    expect(unlocked.size).toBe(2);
  });

  it('ignores avatar ids in unlock list', () => {
    const unlocked = getUnlockedSeatAnimations(['seer']);
    expect(unlocked.has('seer')).toBe(false);
    expect(unlocked.size).toBe(0);
  });
});

describe('isSeatAnimationUnlocked', () => {
  it('wolfKingEntry is locked without explicit unlock', () => {
    expect(isSeatAnimationUnlocked('wolfKingEntry', [])).toBe(false);
  });

  it('wolfKingEntry is unlocked when in list', () => {
    expect(isSeatAnimationUnlocked('wolfKingEntry', ['wolfKingEntry'])).toBe(true);
  });
});

describe('unlock target contracts', () => {
  const checks = [
    ['frame', isFrameUnlocked],
    ['seat flair', isFlairUnlocked],
    ['name style', isNameStyleUnlocked],
    ['role reveal effect', isRoleRevealEffectUnlocked],
    ['seat animation', isSeatAnimationUnlocked],
  ] as const;

  it.each(checks)('fails fast for an unknown %s ID', (_label, isUnlocked) => {
    expect(() => isUnlocked('nonExistent', [])).toThrow('[FAIL-FAST]');
  });

  it.each(checks)(
    'fails fast when a %s query receives another reward type',
    (_label, isUnlocked) => {
      expect(() => isUnlocked('seer', ['seer'])).toThrow('[FAIL-FAST]');
    },
  );
});
