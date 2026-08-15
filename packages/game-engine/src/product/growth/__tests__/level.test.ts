import {
  getLevel,
  getLevelProgress,
  getLevelThreshold,
  getLevelTitle,
  LEVEL_PROGRESSION_SEGMENTS,
  rollXp,
  XP_BASE,
  XP_RANDOM_BASE,
} from '../level';

describe('level', () => {
  describe('LEVEL_PROGRESSION_SEGMENTS', () => {
    it('defines an unbounded final progression segment', () => {
      expect(LEVEL_PROGRESSION_SEGMENTS).toEqual([
        { startingLevel: 0, startingXp: 0, xpPerLevel: 60 },
        { startingLevel: 20, startingXp: 1_200, xpPerLevel: 90 },
        { startingLevel: 40, startingXp: 3_000, xpPerLevel: 120 },
      ]);
    });
  });

  describe('getLevelThreshold', () => {
    it.each([
      [0, 0],
      [1, 60],
      [20, 1_200],
      [21, 1_290],
      [40, 3_000],
      [41, 3_120],
      [51, 4_320],
      [52, 4_440],
      [1_000, 118_200],
    ])('returns %i XP for level %i', (level, expectedThreshold) => {
      expect(getLevelThreshold(level)).toBe(expectedThreshold);
    });

    it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER])(
      'fails fast for a level without a safe threshold: %s',
      (level) => {
        expect(() => getLevelThreshold(level)).toThrow('[FAIL-FAST]');
      },
    );
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

    it.each([20, 21, 40, 41, 51, 52, 1_000])('returns level %i at its exact threshold', (level) => {
      expect(getLevel(getLevelThreshold(level))).toBe(level);
    });

    it('continues above the former level cap', () => {
      expect(getLevel(4_439)).toBe(51);
      expect(getLevel(4_440)).toBe(52);
      expect(getLevel(999_999)).toBe(8_348);
    });

    it('returns correct level between thresholds', () => {
      expect(getLevel(90)).toBe(1); // between 60 and 120
    });

    it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1])(
      'fails fast for invalid XP %s',
      (xp) => {
        expect(() => getLevel(xp)).toThrow('[FAIL-FAST]');
      },
    );
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

    it('returns progress above the former level cap', () => {
      expect(getLevelProgress(4_440)).toBe(0);
      expect(getLevelProgress(4_500)).toBe(0.5);
      expect(getLevelProgress(999_999)).toBeCloseTo(39 / 120);
    });

    it('fails fast instead of projecting invalid XP', () => {
      expect(() => getLevelProgress(-1)).toThrow('[FAIL-FAST]');
    });
  });

  describe('getLevelTitle', () => {
    it.each([
      [0, '新手'],
      [6, '入门'],
      [11, '常客'],
      [21, '老手'],
      [31, '元老'],
      [41, '传奇'],
      [51, '传奇'],
      [52, '神话'],
      [76, '超凡'],
      [101, '不朽'],
      [151, '永恒'],
      [201, '无尽'],
      [10_000, '无尽'],
    ])('returns the expected title at level %i', (level, expectedTitle) => {
      expect(getLevelTitle(level)).toBe(expectedTitle);
    });

    it.each([-1, 1.5, Number.NaN])('fails fast for invalid level %s', (level) => {
      expect(() => getLevelTitle(level)).toThrow('[FAIL-FAST]');
    });
  });

  describe('rollXp', () => {
    it('returns a value in [XP_BASE, XP_BASE + XP_RANDOM_BASE + level] for level 0', () => {
      for (let i = 0; i < 100; i++) {
        const xp = rollXp(0);
        expect(xp).toBeGreaterThanOrEqual(XP_BASE);
        expect(xp).toBeLessThanOrEqual(XP_BASE + XP_RANDOM_BASE);
      }
    });

    it('scales random range with level', () => {
      const level = 52;
      for (let i = 0; i < 100; i++) {
        const xp = rollXp(level);
        expect(xp).toBeGreaterThanOrEqual(XP_BASE);
        expect(xp).toBeLessThanOrEqual(XP_BASE + XP_RANDOM_BASE + level);
      }
    });

    it('uses the supplied RNG deterministically', () => {
      expect(rollXp(0, () => 0)).toBe(XP_BASE);
      expect(rollXp(0, () => 0.999_999)).toBe(XP_BASE + XP_RANDOM_BASE);
      expect(rollXp(30, () => 0.5)).toBe(75);
    });

    it.each([-1, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER])(
      'fails fast for invalid level %s',
      (level) => {
        expect(() => rollXp(level, () => 0)).toThrow('[FAIL-FAST]');
      },
    );
  });
});
