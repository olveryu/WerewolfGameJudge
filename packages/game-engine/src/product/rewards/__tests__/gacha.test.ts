import type { Rarity } from '../catalog';
import { REWARD_POOL, REWARD_TYPES, SHARD_COSTS } from '../catalog';
import { GOLDEN_RATES, NORMAL_RATES, PITY_THRESHOLD, rollRarity, selectReward } from '../gacha';

describe('gachaProbability', () => {
  // ── rollRarity ──────────────────────────────────────────────────────────

  describe('rollRarity', () => {
    it.each(['normal', 'golden'] as const)(
      'resets %s pity on mythic and keeps its boundary exclusive',
      (drawType) => {
        const mythicRate = drawType === 'normal' ? 0.2 : 0.5;
        expect(rollRarity(drawType, 5, 0)).toEqual({ rarity: 'mythic', pityReset: true });
        expect(rollRarity(drawType, 9, mythicRate - 0.001)).toEqual({
          rarity: 'mythic',
          pityReset: true,
        });
        expect(rollRarity(drawType, 0, mythicRate).rarity).toBe('legendary');
      },
    );

    it('should return correct rarity boundaries for normal draw', () => {
      expect(rollRarity('normal', 0, 0).rarity).toBe('mythic');
      expect(rollRarity('normal', 0, 2.6).rarity).toBe('legendary');
      expect(rollRarity('normal', 0, 2.7).rarity).toBe('epic');
      expect(rollRarity('normal', 0, 6.6).rarity).toBe('epic');
      expect(rollRarity('normal', 0, 6.7).rarity).toBe('rare');
      expect(rollRarity('normal', 0, 16.6).rarity).toBe('rare');
      expect(rollRarity('normal', 0, 16.7).rarity).toBe('common');
      expect(rollRarity('normal', 0, 99.9).rarity).toBe('common');
    });

    it('should return correct rarity boundaries for golden draw', () => {
      expect(rollRarity('golden', 0, 0).rarity).toBe('mythic');
      expect(rollRarity('golden', 0, 5.4).rarity).toBe('legendary');
      expect(rollRarity('golden', 0, 5.5).rarity).toBe('epic');
      expect(rollRarity('golden', 0, 13.4).rarity).toBe('epic');
      expect(rollRarity('golden', 0, 13.5).rarity).toBe('rare');
      expect(rollRarity('golden', 0, 33.4).rarity).toBe('rare');
      expect(rollRarity('golden', 0, 33.5).rarity).toBe('common');
    });

    it('normal distribution should match rates within 1% over 100k trials', () => {
      const counts: Record<Rarity, number> = {
        common: 0,
        rare: 0,
        epic: 0,
        legendary: 0,
        mythic: 0,
      };
      const N = 100_000;
      for (let i = 0; i < N; i++) {
        const val = (i / N) * 100; // evenly distributed [0, 100)
        const { rarity } = rollRarity('normal', 0, val);
        counts[rarity]++;
      }
      expect(Math.abs((counts.legendary / N) * 100 - NORMAL_RATES.legendary)).toBeLessThan(1);
      expect(Math.abs((counts.epic / N) * 100 - NORMAL_RATES.epic)).toBeLessThan(1);
      expect(Math.abs((counts.rare / N) * 100 - NORMAL_RATES.rare)).toBeLessThan(1);
      expect(Math.abs((counts.common / N) * 100 - NORMAL_RATES.common)).toBeLessThan(1);
    });

    it('golden distribution should match rates within 1% over 100k trials', () => {
      const counts: Record<Rarity, number> = {
        common: 0,
        rare: 0,
        epic: 0,
        legendary: 0,
        mythic: 0,
      };
      const N = 100_000;
      for (let i = 0; i < N; i++) {
        const val = (i / N) * 100;
        const { rarity } = rollRarity('golden', 0, val);
        counts[rarity]++;
      }
      expect(Math.abs((counts.legendary / N) * 100 - GOLDEN_RATES.legendary)).toBeLessThan(1);
      expect(Math.abs((counts.epic / N) * 100 - GOLDEN_RATES.epic)).toBeLessThan(1);
      expect(Math.abs((counts.rare / N) * 100 - GOLDEN_RATES.rare)).toBeLessThan(1);
      expect(Math.abs((counts.common / N) * 100 - GOLDEN_RATES.common)).toBeLessThan(1);
    });

    it('normal pity at count=9 should never return common', () => {
      for (let i = 0; i < 1000; i++) {
        const val = (i / 1000) * 100;
        const { rarity, pityReset } = rollRarity('normal', PITY_THRESHOLD - 1, val);
        expect(rarity).not.toBe('common');
        expect(pityReset).toBe(true);
      }
    });

    it('normal pity should clamp to rare without inflating legendary rate', () => {
      const counts: Record<Rarity, number> = {
        common: 0,
        rare: 0,
        epic: 0,
        legendary: 0,
        mythic: 0,
      };
      const N = 100_000;
      for (let i = 0; i < N; i++) {
        const val = (i / N) * 100;
        const { rarity } = rollRarity('normal', PITY_THRESHOLD - 1, val);
        counts[rarity]++;
      }
      // legendary/epic keep original probabilities
      expect(Math.abs((counts.legendary / N) * 100 - NORMAL_RATES.legendary)).toBeLessThan(1);
      expect(Math.abs((counts.epic / N) * 100 - NORMAL_RATES.epic)).toBeLessThan(1);
      // rare absorbs the original common share
      expect(
        Math.abs((counts.rare / N) * 100 - (NORMAL_RATES.rare + NORMAL_RATES.common)),
      ).toBeLessThan(1);
      expect(counts.common).toBe(0);
    });

    it('golden pity at count=9 should never return common or rare', () => {
      for (let i = 0; i < 1000; i++) {
        const val = (i / 1000) * 100;
        const { rarity, pityReset } = rollRarity('golden', PITY_THRESHOLD - 1, val);
        expect(['epic', 'legendary', 'mythic']).toContain(rarity);
        expect(pityReset).toBe(true);
      }
    });

    it('golden pity should clamp to epic without inflating legendary rate', () => {
      const counts: Record<Rarity, number> = {
        common: 0,
        rare: 0,
        epic: 0,
        legendary: 0,
        mythic: 0,
      };
      const N = 100_000;
      for (let i = 0; i < N; i++) {
        const val = (i / N) * 100;
        const { rarity } = rollRarity('golden', PITY_THRESHOLD - 1, val);
        counts[rarity]++;
      }
      // legendary keeps original probability
      expect(Math.abs((counts.legendary / N) * 100 - GOLDEN_RATES.legendary)).toBeLessThan(1);
      // epic absorbs the original common+rare share
      expect(
        Math.abs(
          (counts.epic / N) * 100 - (GOLDEN_RATES.epic + GOLDEN_RATES.rare + GOLDEN_RATES.common),
        ),
      ).toBeLessThan(1);
      expect(counts.common).toBe(0);
      expect(counts.rare).toBe(0);
    });

    it('normal: rolling rare resets pity', () => {
      const { pityReset } = rollRarity('normal', 5, 10); // rare range
      expect(pityReset).toBe(true);
    });

    it('normal: rolling common does not reset pity', () => {
      const { pityReset } = rollRarity('normal', 5, 50); // common range
      expect(pityReset).toBe(false);
    });

    it('golden: rolling rare does not reset pity', () => {
      const { pityReset } = rollRarity('golden', 5, 20); // rare range
      expect(pityReset).toBe(false);
    });

    it('golden: rolling epic resets pity', () => {
      const { pityReset } = rollRarity('golden', 5, 6);
      expect(pityReset).toBe(true);
    });

    it('fails fast for invalid pity or random input', () => {
      expect(() => rollRarity('normal', -1, 50)).toThrow('[FAIL-FAST]');
      expect(() => rollRarity('normal', 0.5, 50)).toThrow('[FAIL-FAST]');
      expect(() => rollRarity('normal', 0, 100)).toThrow('[FAIL-FAST]');
      expect(() => rollRarity('normal', 0, Number.NaN)).toThrow('[FAIL-FAST]');
    });
  });

  // ── selectReward ────────────────────────────────────────────────────────

  describe('selectReward', () => {
    it('offers four mythics of each type and compensates duplicates', () => {
      const mythicPool = REWARD_POOL.filter((item) => item.rarity === 'mythic');
      expect(mythicPool.map((item) => item.type).sort()).toEqual(
        REWARD_TYPES.flatMap((type) => [type, type, type, type]).sort(),
      );
      mythicPool.forEach((reward, index) => {
        expect(
          selectReward('mythic', new Set([reward.id]), () => (index + 0.5) / mythicPool.length),
        ).toEqual({
          reward,
          isDuplicate: true,
          shardsAwarded: 600,
        });
      });
      expect(SHARD_COSTS.mythic).toBe(3600);
    });

    const deterministicRandom = () => 0; // always pick first

    it('should return item of target rarity', () => {
      const result = selectReward('epic', new Set(), deterministicRandom);
      expect(result.reward.rarity).toBe('epic');
      expect(result.isDuplicate).toBe(false);
      expect(result.shardsAwarded).toBe(0);
    });

    it('should mark duplicate and award shards for already-owned items', () => {
      const epicItems = REWARD_POOL.filter((i) => i.rarity === 'epic');
      const ownedIds = new Set([epicItems[0]!.id]);
      const result = selectReward('epic', ownedIds, deterministicRandom);
      expect(result.reward.id).toBe(epicItems[0]!.id);
      expect(result.isDuplicate).toBe(true);
      expect(result.shardsAwarded).toBe(50); // SHARD_VALUES.epic
    });

    it('should return item even when pool has owned items (allows duplicates)', () => {
      const epicItems = REWARD_POOL.filter((i) => i.rarity === 'epic');
      const ownedIds = new Set(epicItems.map((i) => i.id));
      const result = selectReward('epic', ownedIds, deterministicRandom);
      expect(result.isDuplicate).toBe(true);
      expect(result.shardsAwarded).toBe(50);
    });

    it('should respect the injected RNG', () => {
      const epicPool = REWARD_POOL.filter((i) => i.rarity === 'epic');
      const result = selectReward('epic', new Set(), () => 1 - Number.EPSILON);
      expect(result.reward.id).toBe(epicPool[epicPool.length - 1]!.id);
    });

    it('fails fast when the RNG violates its unit-interval contract', () => {
      expect(() => selectReward('epic', new Set(), () => -1)).toThrow('[FAIL-FAST]');
      expect(() => selectReward('epic', new Set(), () => 1)).toThrow('[FAIL-FAST]');
      expect(() => selectReward('epic', new Set(), () => Number.NaN)).toThrow('[FAIL-FAST]');
    });
  });

  // ── REWARD_POOL rarity distribution ─────────────────────────────────────

  describe('REWARD_POOL rarity counts', () => {
    it('should have correct total count', () => {
      expect(REWARD_POOL.length).toBe(1043);
    });

    it('should have correct rarity distribution', () => {
      const counts: Record<Rarity, number> = {
        common: 0,
        rare: 0,
        epic: 0,
        legendary: 0,
        mythic: 0,
      };
      for (const item of REWARD_POOL) {
        counts[item.rarity]++;
      }
      expect(counts.legendary).toBe(49);
      expect(counts.mythic).toBe(24);
      expect(counts.epic).toBe(220);
      expect(counts.rare).toBe(250);
      expect(counts.common).toBe(500);
    });

    it('should have correct per-type rarity distribution', () => {
      const byType: Record<string, Record<Rarity, number>> = {};
      for (const item of REWARD_POOL) {
        if (!byType[item.type])
          byType[item.type] = { common: 0, rare: 0, epic: 0, legendary: 0, mythic: 0 };
        byType[item.type]![item.rarity]++;
      }
      for (const counts of Object.values(byType)) expect(counts.mythic).toBe(4);
      // Avatars: L11/E36/R50/C100 = 197
      expect(byType['avatar']!.legendary).toBe(11);
      expect(byType['avatar']!.epic).toBe(36);
      expect(byType['avatar']!.rare).toBe(50);
      expect(byType['avatar']!.common).toBe(100);
      // Frames: L11/E39/R50/C100 = 200
      expect(byType['frame']!.legendary).toBe(11);
      expect(byType['frame']!.epic).toBe(39);
      expect(byType['frame']!.rare).toBe(50);
      expect(byType['frame']!.common).toBe(100);
      // SeatFlairs: L7/E53/R50/C100 = 210
      expect(byType['seatFlair']!.legendary).toBe(7);
      expect(byType['seatFlair']!.epic).toBe(53);
      expect(byType['seatFlair']!.rare).toBe(50);
      expect(byType['seatFlair']!.common).toBe(100);
      // NameStyles: L4/E46/R50/C100 = 200
      expect(byType['nameStyle']!.legendary).toBe(4);
      expect(byType['nameStyle']!.epic).toBe(46);
      expect(byType['nameStyle']!.rare).toBe(50);
      expect(byType['nameStyle']!.common).toBe(100);
      // SeatAnimations: L10/E40/R50/C100 = 200
      expect(byType['seatAnimation']!.legendary).toBe(10);
      expect(byType['seatAnimation']!.epic).toBe(40);
      expect(byType['seatAnimation']!.rare).toBe(50);
      expect(byType['seatAnimation']!.common).toBe(100);
    });
  });
});
