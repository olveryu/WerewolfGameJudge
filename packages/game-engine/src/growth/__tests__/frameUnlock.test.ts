import {
  getUnlockedAvatars,
  getUnlockedFrames,
  isFrameUnlocked,
  pickRandomReward,
} from '../frameUnlock';
import {
  AVATAR_IDS,
  FRAME_IDS,
  FREE_AVATAR_IDS,
  FREE_FRAME_IDS,
  REWARD_POOL,
} from '../rewardCatalog';

describe('rewardCatalog', () => {
  it('REWARD_POOL has 51 items (43 avatars + 10 frames - 2 free)', () => {
    expect(REWARD_POOL).toHaveLength(AVATAR_IDS.length + FRAME_IDS.length - 2);
  });

  it('REWARD_POOL excludes free items', () => {
    const poolIds = new Set(REWARD_POOL.map((r) => r.id));
    for (const id of FREE_AVATAR_IDS) expect(poolIds.has(id)).toBe(false);
    for (const id of FREE_FRAME_IDS) expect(poolIds.has(id)).toBe(false);
  });

  it('all REWARD_POOL ids are unique', () => {
    const ids = REWARD_POOL.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('contains 42 avatars and 9 frames', () => {
    const avatars = REWARD_POOL.filter((r) => r.type === 'avatar');
    const frames = REWARD_POOL.filter((r) => r.type === 'frame');
    expect(avatars).toHaveLength(42);
    expect(frames).toHaveLength(9);
  });
});

describe('pickRandomReward', () => {
  it('returns an avatar at non-3x level', () => {
    const unlocked = new Set<string>();
    const result = pickRandomReward(unlocked, () => 0, 1);
    expect(result).toBeDefined();
    expect(result!.type).toBe('avatar');
  });

  it('returns a frame at 3x level', () => {
    const unlocked = new Set<string>();
    const result = pickRandomReward(unlocked, () => 0, 3);
    expect(result).toBeDefined();
    expect(result!.type).toBe('frame');
  });

  it('returns a frame at level 6', () => {
    const unlocked = new Set<string>();
    const result = pickRandomReward(unlocked, () => 0, 6);
    expect(result).toBeDefined();
    expect(result!.type).toBe('frame');
  });

  it('falls back to avatar when all frames are unlocked', () => {
    const allFrameIds = new Set(REWARD_POOL.filter((r) => r.type === 'frame').map((r) => r.id));
    const result = pickRandomReward(allFrameIds, () => 0, 3);
    expect(result).toBeDefined();
    expect(result!.type).toBe('avatar');
  });

  it('falls back to frame when all avatars are unlocked', () => {
    const allAvatarIds = new Set(REWARD_POOL.filter((r) => r.type === 'avatar').map((r) => r.id));
    const result = pickRandomReward(allAvatarIds, () => 0, 1);
    expect(result).toBeDefined();
    expect(result!.type).toBe('frame');
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
    expect(unlocked.has('villager')).toBe(true);
    expect(unlocked.has('seer')).toBe(true);
    expect(unlocked.has('wolf')).toBe(true);
    expect(unlocked.size).toBe(3);
  });

  it('ignores frame ids in unlock list', () => {
    const unlocked = getUnlockedAvatars(['moonSilver']);
    expect(unlocked.has('moonSilver')).toBe(false);
    expect(unlocked.size).toBe(1); // only villager
  });
});

describe('getUnlockedFrames', () => {
  it('returns only free frames with empty unlocked list', () => {
    expect(getUnlockedFrames([])).toEqual(FREE_FRAME_IDS);
  });

  it('includes unlocked frame ids', () => {
    const unlocked = getUnlockedFrames(['moonSilver', 'darkVine']);
    expect(unlocked.has('ironForge')).toBe(true);
    expect(unlocked.has('moonSilver')).toBe(true);
    expect(unlocked.has('darkVine')).toBe(true);
    expect(unlocked.size).toBe(3);
  });
});

describe('isFrameUnlocked', () => {
  it('free frame is always unlocked', () => {
    expect(isFrameUnlocked('ironForge', [])).toBe(true);
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
