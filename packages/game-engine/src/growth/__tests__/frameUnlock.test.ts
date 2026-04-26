import {
  getUnlockedAvatars,
  getUnlockedFlairs,
  getUnlockedFrames,
  getUnlockedNameStyles,
  getUnlockedSeatAnimations,
  isFlairUnlocked,
  isFrameUnlocked,
  isNameStyleUnlocked,
  isSeatAnimationUnlocked,
  pickRandomReward,
} from '../frameUnlock';
import {
  AVATAR_IDS,
  FRAME_IDS,
  FREE_AVATAR_IDS,
  FREE_FLAIR_IDS,
  FREE_FRAME_IDS,
  FREE_NAME_STYLE_IDS,
  FREE_ROLE_REVEAL_EFFECT_IDS,
  FREE_SEAT_ANIMATION_IDS,
  NAME_STYLE_IDS,
  REWARD_POOL,
  ROLE_REVEAL_EFFECT_IDS,
  SEAT_ANIMATION_IDS,
  SEAT_FLAIR_IDS,
} from '../rewardCatalog';

describe('rewardCatalog', () => {
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

describe('pickRandomReward', () => {
  it('returns an avatar at non-3x level', () => {
    const unlocked = new Set<string>();
    const result = pickRandomReward(unlocked, () => 0, 1);
    expect(result).toBeDefined();
    expect(result!.type).toBe('avatar');
  });

  it('returns a frame at 5x level', () => {
    const unlocked = new Set<string>();
    const result = pickRandomReward(unlocked, () => 0, 5);
    expect(result).toBeDefined();
    expect(result!.type).toBe('frame');
  });

  it('returns a seatFlair at 3x level', () => {
    const unlocked = new Set<string>();
    const result = pickRandomReward(unlocked, () => 0, 3);
    expect(result).toBeDefined();
    expect(result!.type).toBe('seatFlair');
  });

  it('returns a nameStyle at 7x level', () => {
    const unlocked = new Set<string>();
    const result = pickRandomReward(unlocked, () => 0, 7);
    expect(result).toBeDefined();
    expect(result!.type).toBe('nameStyle');
  });

  it('returns a seatAnimation at 13x level', () => {
    const unlocked = new Set<string>();
    const result = pickRandomReward(unlocked, () => 0, 13);
    expect(result).toBeDefined();
    expect(result!.type).toBe('seatAnimation');
  });

  it('returns a seatFlair at level 6', () => {
    const unlocked = new Set<string>();
    const result = pickRandomReward(unlocked, () => 0, 6);
    expect(result).toBeDefined();
    expect(result!.type).toBe('seatFlair');
  });

  it('falls back to avatar when all frames are unlocked', () => {
    const allFrameIds = new Set(REWARD_POOL.filter((r) => r.type === 'frame').map((r) => r.id));
    const result = pickRandomReward(allFrameIds, () => 0, 5);
    expect(result).toBeDefined();
    expect(result!.type).toBe('avatar');
  });

  it('falls back when all avatars are unlocked', () => {
    const allAvatarIds = new Set(REWARD_POOL.filter((r) => r.type === 'avatar').map((r) => r.id));
    const result = pickRandomReward(allAvatarIds, () => 0, 1);
    expect(result).toBeDefined();
    expect(result!.type === 'frame' || result!.type === 'seatFlair').toBe(true);
  });

  it('returns undefined when pool is exhausted', () => {
    const allIds = new Set(REWARD_POOL.map((r) => r.id));
    expect(pickRandomReward(allIds, () => 0, 1)).toBeUndefined();
  });

  it('does not return already unlocked items', () => {
    const unlocked = new Set(['seer', 'wolf']);
    const result = pickRandomReward(unlocked, () => 0, 1);
    expect(result).toBeDefined();
    expect(unlocked.has(result!.id)).toBe(false);
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

  it('unknown frame returns false', () => {
    expect(isFrameUnlocked('nonExistent', ['seer', 'moonSilver'])).toBe(false);
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

  it('unknown nameStyle returns false', () => {
    expect(isNameStyleUnlocked('nonExistent', ['silverGleam'])).toBe(false);
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

  it('unknown seatAnimation returns false', () => {
    expect(isSeatAnimationUnlocked('nonExistent', ['wolfKingEntry'])).toBe(false);
  });
});
