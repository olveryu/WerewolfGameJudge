import { getLevel, getLevelProgress, getLevelTitle, LEVEL_THRESHOLDS } from '../level';

describe('level', () => {
  describe('getLevel', () => {
    it('returns 0 for 0 xp', () => {
      expect(getLevel(0)).toBe(0);
    });

    it('returns 0 for xp below level 1 threshold', () => {
      expect(getLevel(49)).toBe(0);
    });

    it('returns 1 at exactly level 1 threshold', () => {
      expect(getLevel(50)).toBe(1);
    });

    it('returns correct level at each threshold', () => {
      LEVEL_THRESHOLDS.forEach((threshold, level) => {
        expect(getLevel(threshold)).toBe(level);
      });
    });

    it('returns max level for very high xp', () => {
      expect(getLevel(999999)).toBe(20);
    });

    it('returns correct level between thresholds', () => {
      expect(getLevel(100)).toBe(1); // between 50 and 150
      expect(getLevel(400)).toBe(3); // between 300 and 500
      expect(getLevel(24999)).toBe(19); // just below 25000
    });
  });

  describe('getLevelTitle', () => {
    it('returns 新手 for level 0', () => {
      expect(getLevelTitle(0)).toBe('新手');
    });

    it('returns 入门 for level 1', () => {
      expect(getLevelTitle(1)).toBe('入门');
    });

    it('returns inherited title for levels without explicit title', () => {
      expect(getLevelTitle(3)).toBe('入门'); // inherits from level 1
      expect(getLevelTitle(7)).toBe('常客'); // inherits from level 5
      expect(getLevelTitle(12)).toBe('老手'); // inherits from level 10
    });

    it('returns 传奇 for level 20', () => {
      expect(getLevelTitle(20)).toBe('传奇');
    });
  });

  describe('getLevelProgress', () => {
    it('returns 0 at start of level', () => {
      expect(getLevelProgress(0)).toBe(0);
      expect(getLevelProgress(50)).toBe(0);
    });

    it('returns fraction between levels', () => {
      // Level 1: 50–150, midpoint = 100 → 0.5
      expect(getLevelProgress(100)).toBe(0.5);
    });

    it('returns 1 at max level', () => {
      expect(getLevelProgress(25000)).toBe(1);
      expect(getLevelProgress(50000)).toBe(1);
    });
  });
});
