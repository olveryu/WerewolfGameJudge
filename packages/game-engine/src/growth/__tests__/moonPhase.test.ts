import { MOON_PHASES, rollMoonPhase } from '../moonPhase';

describe('moonPhase', () => {
  describe('MOON_PHASES', () => {
    it('has 6 phases', () => {
      expect(MOON_PHASES).toHaveLength(6);
    });

    it('weights sum to 100', () => {
      const total = MOON_PHASES.reduce((sum, p) => sum + p.weight, 0);
      expect(total).toBe(100);
    });

    it('xp ranges from 40 to 90', () => {
      const xps = MOON_PHASES.map((p) => p.xp);
      expect(Math.min(...xps)).toBe(40);
      expect(Math.max(...xps)).toBe(90);
    });

    it('all phases have unique ids', () => {
      const ids = MOON_PHASES.map((p) => p.id);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  describe('rollMoonPhase', () => {
    it('returns a valid moon phase', () => {
      const phase = rollMoonPhase();
      const validIds = MOON_PHASES.map((p) => p.id);
      expect(validIds).toContain(phase.id);
      expect(phase.xp).toBeGreaterThanOrEqual(40);
      expect(phase.xp).toBeLessThanOrEqual(90);
    });

    it('returns different phases over many rolls (statistical)', () => {
      const results = new Set<string>();
      for (let i = 0; i < 200; i++) {
        results.add(rollMoonPhase().id);
      }
      // With 200 rolls, we should see at least 3 different phases
      expect(results.size).toBeGreaterThanOrEqual(3);
    });
  });
});
