import {
  getLevel,
  getLevelProgress,
  LEVEL_THRESHOLDS,
  rollXp,
  XP_BASE,
  XP_RANDOM_MAX,
} from '../level';

describe('level', () => {
  describe('LEVEL_THRESHOLDS', () => {
    it('has 52 entries (Lv.0–Lv.51)', () => {
      expect(LEVEL_THRESHOLDS).toHaveLength(52);
    });

    it('starts at 0', () => {
      expect(LEVEL_THRESHOLDS[0]).toBe(0);
    });

    it('is strictly increasing', () => {
      for (let i = 1; i < LEVEL_THRESHOLDS.length; i++) {
        expect(LEVEL_THRESHOLDS[i]!).toBeGreaterThan(LEVEL_THRESHOLDS[i - 1]!);
      }
    });

    it('Lv.1–20 each +60', () => {
      for (let i = 1; i <= 20; i++) {
        expect(LEVEL_THRESHOLDS[i]! - LEVEL_THRESHOLDS[i - 1]!).toBe(60);
      }
    });

    it('Lv.21–40 each +90', () => {
      for (let i = 21; i <= 40; i++) {
        expect(LEVEL_THRESHOLDS[i]! - LEVEL_THRESHOLDS[i - 1]!).toBe(90);
      }
    });

    it('Lv.41–51 each +120', () => {
      for (let i = 41; i <= 51; i++) {
        expect(LEVEL_THRESHOLDS[i]! - LEVEL_THRESHOLDS[i - 1]!).toBe(120);
      }
    });
  });

  describe('getLevel', () => {
    it('returns 0 for 0 xp', () => {
      expect(getLevel(0)).toBe(0);
    });

    it('returns 0 for xp below level 1 threshold', () => {
      expect(getLevel(59)).toBe(0);
    });

    it('returns 1 at exactly level 1 threshold', () => {
      expect(getLevel(60)).toBe(1);
    });

    it('returns correct level at each threshold', () => {
      LEVEL_THRESHOLDS.forEach((threshold, level) => {
        expect(getLevel(threshold)).toBe(level);
      });
    });

    it('returns max level (51) for very high xp', () => {
      expect(getLevel(999999)).toBe(51);
    });

    it('returns correct level between thresholds', () => {
      expect(getLevel(90)).toBe(1); // between 60 and 120
    });
  });

  describe('getLevelProgress', () => {
    it('returns 0 at start of level', () => {
      expect(getLevelProgress(0)).toBe(0);
      expect(getLevelProgress(60)).toBe(0);
    });

    it('returns fraction between levels', () => {
      // Level 1: 60–120, midpoint = 90 → 0.5
      expect(getLevelProgress(90)).toBe(0.5);
    });

    it('returns 1 at max level', () => {
      expect(getLevelProgress(LEVEL_THRESHOLDS[51]!)).toBe(1);
      expect(getLevelProgress(999999)).toBe(1);
    });
  });

  describe('rollXp', () => {
    it('returns a value in [50, 70]', () => {
      for (let i = 0; i < 100; i++) {
        const xp = rollXp();
        expect(xp).toBeGreaterThanOrEqual(XP_BASE);
        expect(xp).toBeLessThanOrEqual(XP_BASE + XP_RANDOM_MAX);
      }
    });
  });
});
