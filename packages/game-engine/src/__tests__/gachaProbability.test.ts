import {
  GOLDEN_RATES,
  NORMAL_RATES,
  PITY_THRESHOLD,
  rollRarity,
  selectReward,
} from '../growth/gachaProbability';
import type { Rarity } from '../growth/rewardCatalog';
import { REWARD_POOL } from '../growth/rewardCatalog';

describe('gachaProbability', () => {
  // ── rollRarity ──────────────────────────────────────────────────────────

  describe('rollRarity', () => {
    it('should return correct rarity boundaries for normal draw', () => {
      // legendary: 0–1.5, epic: 1.5–5.5, rare: 5.5–15.5, common: 15.5–100
      expect(rollRarity('normal', 0, 0).rarity).toBe('legendary');
      expect(rollRarity('normal', 0, 1.4).rarity).toBe('legendary');
      expect(rollRarity('normal', 0, 1.5).rarity).toBe('epic');
      expect(rollRarity('normal', 0, 5.4).rarity).toBe('epic');
      expect(rollRarity('normal', 0, 5.5).rarity).toBe('rare');
      expect(rollRarity('normal', 0, 15.4).rarity).toBe('rare');
      expect(rollRarity('normal', 0, 15.5).rarity).toBe('common');
      expect(rollRarity('normal', 0, 99.9).rarity).toBe('common');
    });

    it('should return correct rarity boundaries for golden draw', () => {
      // legendary: 0–3, epic: 3–11, rare: 11–31, common: 31–100
      expect(rollRarity('golden', 0, 0).rarity).toBe('legendary');
      expect(rollRarity('golden', 0, 2.9).rarity).toBe('legendary');
      expect(rollRarity('golden', 0, 3).rarity).toBe('epic');
      expect(rollRarity('golden', 0, 10.9).rarity).toBe('epic');
      expect(rollRarity('golden', 0, 11).rarity).toBe('rare');
      expect(rollRarity('golden', 0, 30.9).rarity).toBe('rare');
      expect(rollRarity('golden', 0, 31).rarity).toBe('common');
    });

    it('normal distribution should match rates within 1% over 100k trials', () => {
      const counts: Record<Rarity, number> = { common: 0, rare: 0, epic: 0, legendary: 0 };
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
      const counts: Record<Rarity, number> = { common: 0, rare: 0, epic: 0, legendary: 0 };
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
      const counts: Record<Rarity, number> = { common: 0, rare: 0, epic: 0, legendary: 0 };
      const N = 100_000;
      for (let i = 0; i < N; i++) {
        const val = (i / N) * 100;
        const { rarity } = rollRarity('normal', PITY_THRESHOLD - 1, val);
        counts[rarity]++;
      }
      // legendary/epic 保持原始概率不变
      expect(Math.abs((counts.legendary / N) * 100 - NORMAL_RATES.legendary)).toBeLessThan(1);
      expect(Math.abs((counts.epic / N) * 100 - NORMAL_RATES.epic)).toBeLessThan(1);
      // rare 吃掉原 common 的份额
      expect(
        Math.abs((counts.rare / N) * 100 - (NORMAL_RATES.rare + NORMAL_RATES.common)),
      ).toBeLessThan(1);
      expect(counts.common).toBe(0);
    });

    it('golden pity at count=9 should never return common or rare', () => {
      for (let i = 0; i < 1000; i++) {
        const val = (i / 1000) * 100;
        const { rarity, pityReset } = rollRarity('golden', PITY_THRESHOLD - 1, val);
        expect(rarity === 'epic' || rarity === 'legendary').toBe(true);
        expect(pityReset).toBe(true);
      }
    });

    it('golden pity should clamp to epic without inflating legendary rate', () => {
      const counts: Record<Rarity, number> = { common: 0, rare: 0, epic: 0, legendary: 0 };
      const N = 100_000;
      for (let i = 0; i < N; i++) {
        const val = (i / N) * 100;
        const { rarity } = rollRarity('golden', PITY_THRESHOLD - 1, val);
        counts[rarity]++;
      }
      // legendary 保持原始概率不变
      expect(Math.abs((counts.legendary / N) * 100 - GOLDEN_RATES.legendary)).toBeLessThan(1);
      // epic 吃掉原 common+rare 的份额
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
      const { pityReset } = rollRarity('golden', 5, 5); // epic range
      expect(pityReset).toBe(true);
    });
  });

  // ── selectReward ────────────────────────────────────────────────────────

  describe('selectReward', () => {
    const deterministicRandom = (_max: number) => 0; // always pick first

    it('should return item of target rarity', () => {
      const result = selectReward('epic', new Set(), deterministicRandom);
      expect(result).toBeDefined();
      expect(result!.rarity).toBe('epic');
    });

    it('should not return already-owned items', () => {
      const epicItems = REWARD_POOL.filter((i) => i.rarity === 'epic');
      const ownedIds = new Set(epicItems.slice(0, 3).map((i) => i.id));
      const result = selectReward('epic', ownedIds, deterministicRandom);
      expect(result).toBeDefined();
      expect(ownedIds.has(result!.id)).toBe(false);
    });

    it('should upgrade rarity when target pool is empty', () => {
      // Own all common items
      const commonIds = new Set(REWARD_POOL.filter((i) => i.rarity === 'common').map((i) => i.id));
      const result = selectReward('common', commonIds, deterministicRandom);
      expect(result).toBeDefined();
      expect(result!.rarity).not.toBe('common');
      // Should be rare (next upgrade)
      expect(result!.rarity).toBe('rare');
    });

    it('should return undefined when all items collected', () => {
      const allIds = new Set(REWARD_POOL.map((i) => i.id));
      const result = selectReward('common', allIds, deterministicRandom);
      expect(result).toBeUndefined();
    });

    it('should respect randomFn index', () => {
      const epicPool = REWARD_POOL.filter((i) => i.rarity === 'epic');
      // Pick the last item
      const lastPicker = (max: number) => max - 1;
      const result = selectReward('epic', new Set(), lastPicker);
      expect(result).toBeDefined();
      expect(result!.id).toBe(epicPool[epicPool.length - 1].id);
    });
  });

  // ── REWARD_POOL rarity distribution ─────────────────────────────────────

  describe('REWARD_POOL rarity counts', () => {
    it('should have correct total count', () => {
      expect(REWARD_POOL.length).toBe(575);
    });

    it('should have correct rarity distribution', () => {
      const counts: Record<Rarity, number> = { common: 0, rare: 0, epic: 0, legendary: 0 };
      for (const item of REWARD_POOL) {
        counts[item.rarity]++;
      }
      expect(counts.legendary).toBe(37);
      expect(counts.epic).toBe(55);
      expect(counts.rare).toBe(164);
      expect(counts.common).toBe(319);
    });

    it('should have correct per-type rarity distribution', () => {
      const byType: Record<string, Record<Rarity, number>> = {};
      for (const item of REWARD_POOL) {
        if (!byType[item.type]) byType[item.type] = { common: 0, rare: 0, epic: 0, legendary: 0 };
        byType[item.type][item.rarity]++;
      }
      // Avatars: L3/E7/R14/C18 = 42
      expect(byType['avatar'].legendary).toBe(3);
      expect(byType['avatar'].epic).toBe(7);
      expect(byType['avatar'].rare).toBe(14);
      expect(byType['avatar'].common).toBe(19);
      // Frames: L11/E9/R50/C100 = 170
      expect(byType['frame'].legendary).toBe(11);
      expect(byType['frame'].epic).toBe(9);
      expect(byType['frame'].rare).toBe(50);
      expect(byType['frame'].common).toBe(100);
      // SeatFlairs: L7/E23/R50/C100 = 180
      expect(byType['seatFlair'].legendary).toBe(7);
      expect(byType['seatFlair'].epic).toBe(23);
      expect(byType['seatFlair'].rare).toBe(50);
      expect(byType['seatFlair'].common).toBe(100);
      // NameStyles: L4/E16/R50/C100 = 170
      expect(byType['nameStyle'].legendary).toBe(4);
      expect(byType['nameStyle'].epic).toBe(16);
      expect(byType['nameStyle'].rare).toBe(50);
      expect(byType['nameStyle'].common).toBe(100);
    });
  });
});
