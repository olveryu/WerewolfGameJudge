import {
  FREE_REWARDS,
  getLevelReward,
  getUnlockedAvatars,
  getUnlockedFrames,
  isFrameUnlocked,
  LEVEL_REWARDS,
} from '../frameUnlock';

describe('levelRewards', () => {
  describe('LEVEL_REWARDS', () => {
    it('has 51 entries (Lv.1–Lv.51)', () => {
      expect(LEVEL_REWARDS).toHaveLength(51);
    });

    it('all levels are unique and sequential', () => {
      LEVEL_REWARDS.forEach((r, i) => {
        expect(r.level).toBe(i + 1);
      });
    });

    it('contains 42 avatars and 9 frames', () => {
      const avatars = LEVEL_REWARDS.filter((r) => r.type === 'avatar');
      const frames = LEVEL_REWARDS.filter((r) => r.type === 'frame');
      expect(avatars).toHaveLength(42);
      expect(frames).toHaveLength(9);
    });

    it('all reward ids are unique', () => {
      const allIds = [...FREE_REWARDS, ...LEVEL_REWARDS].map((r) => `${r.type}:${r.id}`);
      expect(new Set(allIds).size).toBe(allIds.length);
    });
  });

  describe('FREE_REWARDS', () => {
    it('grants villager avatar and ironForge frame at Lv.0', () => {
      expect(FREE_REWARDS).toEqual([
        { level: 0, type: 'avatar', id: 'villager' },
        { level: 0, type: 'frame', id: 'ironForge' },
      ]);
    });
  });

  describe('getLevelReward', () => {
    it('returns reward for valid level', () => {
      expect(getLevelReward(1)).toEqual({ level: 1, type: 'avatar', id: 'seer' });
    });

    it('returns undefined for Lv.0', () => {
      expect(getLevelReward(0)).toBeUndefined();
    });

    it('returns undefined for out-of-range level', () => {
      expect(getLevelReward(99)).toBeUndefined();
    });
  });

  describe('getUnlockedAvatars', () => {
    it('returns only villager at Lv.0', () => {
      expect(getUnlockedAvatars(0)).toEqual(new Set(['villager']));
    });

    it('includes Lv.1 avatar at Lv.1', () => {
      const unlocked = getUnlockedAvatars(1);
      expect(unlocked.has('villager')).toBe(true);
      expect(unlocked.has('seer')).toBe(true);
      expect(unlocked.size).toBe(2);
    });

    it('returns all 43 avatars at Lv.51', () => {
      expect(getUnlockedAvatars(51).size).toBe(43);
    });
  });

  describe('getUnlockedFrames', () => {
    it('returns only ironForge at Lv.0', () => {
      expect(getUnlockedFrames(0)).toEqual(new Set(['ironForge']));
    });

    it('returns all 10 frames at Lv.51', () => {
      expect(getUnlockedFrames(51).size).toBe(10);
    });
  });

  describe('isFrameUnlocked', () => {
    it('ironForge is unlocked at Lv.0', () => {
      expect(isFrameUnlocked('ironForge', 0)).toBe(true);
    });

    it('moonSilver is locked below Lv.5', () => {
      expect(isFrameUnlocked('moonSilver', 4)).toBe(false);
    });

    it('moonSilver is unlocked at Lv.5', () => {
      expect(isFrameUnlocked('moonSilver', 5)).toBe(true);
    });

    it('returns false for unknown frame', () => {
      expect(isFrameUnlocked('nonExistent', 51)).toBe(false);
    });
  });
});
