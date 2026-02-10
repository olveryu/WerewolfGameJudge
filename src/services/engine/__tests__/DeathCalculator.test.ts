/**
 * DeathCalculator Unit Tests
 *
 * Covers core death calculation scenarios:
 * - Wolf kill basics
 * - Guard protection
 * - Witch save/poison
 * - 同守同救必死 (double save = death)
 * - Witcher poison immunity
 * - Wolf Queen link death
 * - Dreamcatcher protection and link death
 * - Magician swap
 * - Nightmare block effects
 * - Spirit Knight reflection
 * - Peaceful night (no deaths)
 *
 * NightActions 字段定义来源：src/services/DeathCalculator.ts
 * - wolfKill: number | undefined
 * - guardProtect: number | undefined
 * - witchAction: WitchAction | undefined
 * - wolfQueenCharm: number | undefined
 * - dreamcatcherDream: number | undefined
 * - magicianSwap: { first: number; second: number } | undefined
 * - seerCheck: number | undefined
 * - nightmareBlock: number | undefined
 * - isWolfBlockedByNightmare: boolean | undefined
 *
 * RoleSeatMap 字段定义来源：src/services/DeathCalculator.ts
 * - witcher, wolfQueen, dreamcatcher, spiritKnight, seer, witch, guard: number (-1 表示不在场)
 */

import { makeWitchPoison,makeWitchSave } from '@/models/actions/WitchAction';
import {
  calculateDeaths,
  NightActions,
  RoleSeatMap,
} from '@/services/engine/DeathCalculator';

/** All roles absent — mirrors the module-private DEFAULT_ROLE_SEAT_MAP */
const NO_ROLES: RoleSeatMap = {
  witcher: -1,
  wolfQueen: -1,
  dreamcatcher: -1,
  spiritKnight: -1,
  seer: -1,
  witch: -1,
  guard: -1,
};

describe('DeathCalculator', () => {
  // ===========================================================================
  // Basic Wolf Kill
  // ===========================================================================

  describe('Wolf Kill Basics', () => {
    it('should kill target when wolf kills and no protection', () => {
      const actions: NightActions = {
        wolfKill: 3,
      };

      const deaths = calculateDeaths(actions);
      expect(deaths).toEqual([3]);
    });

    it('should return empty array when wolf does not kill', () => {
      const actions: NightActions = {};

      const deaths = calculateDeaths(actions);
      expect(deaths).toEqual([]);
    });

    it('should return empty array for peaceful night', () => {
      const actions: NightActions = {
        wolfKill: undefined,
        guardProtect: 5,
        witchAction: undefined,
      };

      const deaths = calculateDeaths(actions);
      expect(deaths).toEqual([]);
    });
  });

  // ===========================================================================
  // Guard Protection
  // ===========================================================================

  describe('Guard Protection', () => {
    it('should prevent death when guard protects wolf target', () => {
      const actions: NightActions = {
        wolfKill: 3,
        guardProtect: 3,
      };

      const deaths = calculateDeaths(actions);
      expect(deaths).toEqual([]);
    });

    it('should not prevent death when guard protects different target', () => {
      const actions: NightActions = {
        wolfKill: 3,
        guardProtect: 5,
      };

      const deaths = calculateDeaths(actions);
      expect(deaths).toEqual([3]);
    });
  });

  // ===========================================================================
  // Witch Save
  // ===========================================================================

  describe('Witch Save', () => {
    it('should prevent death when witch saves wolf target', () => {
      const actions: NightActions = {
        wolfKill: 3,
        witchAction: makeWitchSave(3),
      };

      const deaths = calculateDeaths(actions);
      expect(deaths).toEqual([]);
    });

    it('should not prevent death when witch saves different target', () => {
      const actions: NightActions = {
        wolfKill: 3,
        witchAction: makeWitchSave(5),
      };

      const deaths = calculateDeaths(actions);
      expect(deaths).toEqual([3]);
    });
  });

  // ===========================================================================
  // 同守同救必死 (Double Save = Death)
  // ===========================================================================

  describe('Double Save Rule (同守同救必死)', () => {
    it('should kill target when both guard and witch save the same target', () => {
      const actions: NightActions = {
        wolfKill: 3,
        guardProtect: 3,
        witchAction: makeWitchSave(3),
      };

      const deaths = calculateDeaths(actions);
      expect(deaths).toEqual([3]);
    });
  });

  // ===========================================================================
  // Witch Poison
  // ===========================================================================

  describe('Witch Poison', () => {
    it('should kill poison target', () => {
      const actions: NightActions = {
        witchAction: makeWitchPoison(5),
      };

      const deaths = calculateDeaths(actions);
      expect(deaths).toEqual([5]);
    });

    it('should kill both wolf target and poison target', () => {
      const actions: NightActions = {
        wolfKill: 3,
        witchAction: makeWitchPoison(5),
      };

      const deaths = calculateDeaths(actions);
      expect(deaths).toEqual([3, 5]);
    });

    it('should not kill witcher when poisoned', () => {
      const actions: NightActions = {
        witchAction: makeWitchPoison(5),
      };
      const roleSeatMap: RoleSeatMap = {
        ...NO_ROLES,
        witcher: 5,
      };

      const deaths = calculateDeaths(actions, roleSeatMap);
      expect(deaths).toEqual([]);
    });

    it('should kill non-witcher when poisoned', () => {
      const actions: NightActions = {
        witchAction: makeWitchPoison(5),
      };
      const roleSeatMap: RoleSeatMap = {
        ...NO_ROLES,
        witcher: 7, // witcher is at different seat
      };

      const deaths = calculateDeaths(actions, roleSeatMap);
      expect(deaths).toEqual([5]);
    });
  });

  // ===========================================================================
  // Wolf Queen Link Death
  // ===========================================================================

  describe('Wolf Queen Link Death', () => {
    it('should kill charmed target when wolf queen dies', () => {
      const actions: NightActions = {
        wolfKill: 2, // wolf kills queen
        wolfQueenCharm: 5,
      };
      const roleSeatMap: RoleSeatMap = {
        ...NO_ROLES,
        wolfQueen: 2,
      };

      const deaths = calculateDeaths(actions, roleSeatMap);
      expect(deaths).toEqual([2, 5]);
    });

    it('should not kill charmed target when wolf queen survives', () => {
      const actions: NightActions = {
        wolfKill: 3, // wolf kills someone else
        wolfQueenCharm: 5,
      };
      const roleSeatMap: RoleSeatMap = {
        ...NO_ROLES,
        wolfQueen: 2,
      };

      const deaths = calculateDeaths(actions, roleSeatMap);
      expect(deaths).toEqual([3]);
    });

    it('should not affect anything when wolf queen not present', () => {
      const actions: NightActions = {
        wolfKill: 3,
        wolfQueenCharm: 5,
      };

      const deaths = calculateDeaths(actions);
      expect(deaths).toEqual([3]);
    });
  });

  // ===========================================================================
  // Dreamcatcher Protection and Link Death
  // ===========================================================================

  describe('Dreamcatcher Effect', () => {
    it('should protect dream target from wolf kill', () => {
      const actions: NightActions = {
        wolfKill: 3,
        dreamcatcherDream: 3,
      };

      const deaths = calculateDeaths(actions);
      expect(deaths).toEqual([]);
    });

    it('should kill dream target when dreamcatcher dies', () => {
      const actions: NightActions = {
        wolfKill: 2, // wolf kills dreamcatcher
        dreamcatcherDream: 5,
      };
      const roleSeatMap: RoleSeatMap = {
        ...NO_ROLES,
        dreamcatcher: 2,
      };

      const deaths = calculateDeaths(actions, roleSeatMap);
      expect(deaths).toEqual([2, 5]);
    });

    it('should protect dream target even if dreamcatcher dies (protection first)', () => {
      // Dreamcatcher protects target, but dreamcatcher dies
      // Dream target is protected from wolf kill, then dies with dreamcatcher
      const actions: NightActions = {
        wolfKill: 2, // wolf kills dreamcatcher
        witchAction: makeWitchPoison(5), // witch poisons dream target
        dreamcatcherDream: 5,
      };
      const roleSeatMap: RoleSeatMap = {
        ...NO_ROLES,
        dreamcatcher: 2,
      };

      // Dream target (5) is protected from poison, then dies because dreamcatcher (2) dies
      const deaths = calculateDeaths(actions, roleSeatMap);
      // 5 is protected from poison, but dies because dreamcatcher (2) dies
      expect(deaths).toEqual([2, 5]);
    });
  });

  // ===========================================================================
  // Magician Swap
  // ===========================================================================

  describe('Magician Swap', () => {
    it('should swap death when first target is dead', () => {
      const actions: NightActions = {
        wolfKill: 3,
        magicianSwap: { first: 3, second: 7 },
      };

      const deaths = calculateDeaths(actions);
      expect(deaths).toEqual([7]); // 3 lives, 7 dies
    });

    it('should swap death when second target is dead', () => {
      const actions: NightActions = {
        wolfKill: 7,
        magicianSwap: { first: 3, second: 7 },
      };

      const deaths = calculateDeaths(actions);
      expect(deaths).toEqual([3]); // 7 lives, 3 dies
    });

    it('should not swap when both targets are dead', () => {
      const actions: NightActions = {
        wolfKill: 3,
        witchAction: makeWitchPoison(7),
        magicianSwap: { first: 3, second: 7 },
      };

      const deaths = calculateDeaths(actions);
      expect(deaths).toEqual([3, 7]); // both still dead
    });

    it('should not swap when neither target is dead', () => {
      const actions: NightActions = {
        wolfKill: 5,
        magicianSwap: { first: 3, second: 7 },
      };

      const deaths = calculateDeaths(actions);
      expect(deaths).toEqual([5]); // only wolf kill victim
    });

    it('should not affect anything when magician does not swap', () => {
      const actions: NightActions = {
        wolfKill: 3,
      };

      const deaths = calculateDeaths(actions);
      expect(deaths).toEqual([3]);
    });
  });

  // ===========================================================================
  // Complex Scenarios
  // ===========================================================================

  describe('Complex Scenarios', () => {
    it('should handle wolf kill + witch poison + guard (different targets)', () => {
      const actions: NightActions = {
        wolfKill: 3,
        guardProtect: 5,
        witchAction: makeWitchPoison(7),
      };

      const deaths = calculateDeaths(actions);
      expect(deaths).toEqual([3, 7]);
    });

    it('should handle guard protecting poison target (poison still works)', () => {
      // Guard only protects from wolf kill, not poison
      const actions: NightActions = {
        wolfKill: 3,
        guardProtect: 7,
        witchAction: makeWitchPoison(7),
      };

      const deaths = calculateDeaths(actions);
      expect(deaths).toEqual([3, 7]);
    });

    it('should handle witch saving different target than guard protection', () => {
      const actions: NightActions = {
        wolfKill: 3,
        guardProtect: 5,
        witchAction: makeWitchSave(3), // witch saves wolf target
      };

      const deaths = calculateDeaths(actions);
      expect(deaths).toEqual([]); // witch save works
    });
  });

  // ===========================================================================
  // Nightmare Block Effects
  // ===========================================================================

  describe('Nightmare Block Effects', () => {
    it('封锁守卫 → 守卫保护无效', () => {
      const actions: NightActions = {
        wolfKill: 0,
        guardProtect: 0, // 守卫想保护0号
        nightmareBlock: 11, // 封锁守卫（座位11）
      };
      const roleSeatMap: RoleSeatMap = {
        ...NO_ROLES,
        guard: 11,
      };

      const deaths = calculateDeaths(actions, roleSeatMap);

      // 守卫被封锁，保护无效，0号死亡
      expect(deaths).toEqual([0]);
    });

    it('封锁女巫 → 女巫救人无效', () => {
      const actions: NightActions = {
        wolfKill: 0,
        witchAction: makeWitchSave(0), // 女巫想救0号
        nightmareBlock: 9, // 封锁女巫（座位9）
      };
      const roleSeatMap: RoleSeatMap = {
        ...NO_ROLES,
        witch: 9,
      };

      const deaths = calculateDeaths(actions, roleSeatMap);

      // 女巫被封锁，救人无效，0号死亡
      expect(deaths).toEqual([0]);
    });

    it('封锁女巫 → 女巫毒人无效', () => {
      const actions: NightActions = {
        wolfKill: 0,
        witchAction: makeWitchPoison(1), // 女巫想毒1号
        nightmareBlock: 9, // 封锁女巫（座位9）
      };
      const roleSeatMap: RoleSeatMap = {
        ...NO_ROLES,
        witch: 9,
      };

      const deaths = calculateDeaths(actions, roleSeatMap);

      // 女巫被封锁，毒人无效，只有0号死亡
      expect(deaths).toEqual([0]);
    });

    it('封锁狼人 → 狼人无法杀人', () => {
      const actions: NightActions = {
        wolfKill: 0, // 狼想杀0号
        isWolfBlockedByNightmare: true, // 梦魇封锁了狼人
      };

      const deaths = calculateDeaths(actions);

      // 狼人被封锁，当夜无法杀人
      expect(deaths).toEqual([]);
    });

    it('封锁非关键角色 → 不影响其他技能', () => {
      const actions: NightActions = {
        wolfKill: 0,
        guardProtect: 0, // 守卫保护0号
        nightmareBlock: 0, // 封锁座位0（村民）
      };
      const roleSeatMap: RoleSeatMap = {
        ...NO_ROLES,
        guard: 11,
      };

      const deaths = calculateDeaths(actions, roleSeatMap);

      // 封锁的是村民，守卫保护有效
      expect(deaths).toEqual([]);
    });
  });

  // ===========================================================================
  // Spirit Knight Reflection
  // ===========================================================================

  describe('Spirit Knight Reflection', () => {
    const spiritKnightRoleSeatMap: RoleSeatMap = {
      ...NO_ROLES,
      spiritKnight: 7,
      seer: 8,
      witch: 9,
    };

    it('预言家查验恶灵骑士 → 预言家死亡', () => {
      const actions: NightActions = {
        wolfKill: 0,
        seerCheck: 7,
      };

      const deaths = calculateDeaths(actions, spiritKnightRoleSeatMap);

      expect(deaths).toContain(0);
      expect(deaths).toContain(8);
      expect(deaths).not.toContain(7);
    });

    it('女巫毒恶灵骑士 → 女巫死亡，恶灵骑士免疫', () => {
      const actions: NightActions = {
        wolfKill: 0,
        witchAction: makeWitchPoison(7),
      };

      const deaths = calculateDeaths(actions, spiritKnightRoleSeatMap);

      expect(deaths).toContain(0);
      expect(deaths).toContain(9);
      expect(deaths).not.toContain(7);
    });

    it('预言家查验普通狼人 → 无反伤', () => {
      const actions: NightActions = {
        wolfKill: 0,
        seerCheck: 4,
      };

      const deaths = calculateDeaths(actions, spiritKnightRoleSeatMap);

      expect(deaths).toEqual([0]);
    });

    it('女巫毒普通狼人 → 无反伤', () => {
      const actions: NightActions = {
        wolfKill: 0,
        witchAction: makeWitchPoison(4),
      };

      const deaths = calculateDeaths(actions, spiritKnightRoleSeatMap);

      expect(deaths).toContain(0);
      expect(deaths).toContain(4);
      expect(deaths).not.toContain(9);
    });

    it('恶灵骑士不在场时无反伤规则', () => {
      const actions: NightActions = {
        wolfKill: 0,
        seerCheck: 4,
        witchAction: makeWitchPoison(5),
      };

      const deaths = calculateDeaths(actions); // default role seat map (no spirit knight)

      expect(deaths).toContain(0);
      expect(deaths).toContain(5);
    });

    it('狼刀恶灵骑士 → 恶灵骑士免疫', () => {
      const actions: NightActions = {
        wolfKill: 7,
      };

      const deaths = calculateDeaths(actions, spiritKnightRoleSeatMap);

      expect(deaths).not.toContain(7);
      expect(deaths).toEqual([]);
    });

    it('狼刀恶灵骑士 + 女巫毒村民 → 只有村民死', () => {
      const actions: NightActions = {
        wolfKill: 7,
        witchAction: makeWitchPoison(0),
      };

      const deaths = calculateDeaths(actions, spiritKnightRoleSeatMap);

      expect(deaths).not.toContain(7);
      expect(deaths).toContain(0);
      expect(deaths.length).toBe(1);
    });
  });

  // ===========================================================================
  // Edge Cases
  // ===========================================================================

  describe('Edge Cases', () => {
    it('should handle empty actions', () => {
      const actions: NightActions = {};

      const deaths = calculateDeaths(actions);
      expect(deaths).toEqual([]);
    });

    it('should return sorted death list', () => {
      const actions: NightActions = {
        wolfKill: 9,
        witchAction: makeWitchPoison(2),
      };

      const deaths = calculateDeaths(actions);
      expect(deaths).toEqual([2, 9]);
    });

    it('should handle seat 0', () => {
      const actions: NightActions = {
        wolfKill: 0,
      };

      const deaths = calculateDeaths(actions);
      expect(deaths).toEqual([0]);
    });
  });
});
