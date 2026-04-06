/**
 * DeathCalculator Unit Tests
 *
 * Covers core death calculation scenarios:
 * - Wolf kill basics
 * - Guard protection
 * - Witch save/poison
 * - 同守同救必死 (double save = death)
 * - Witcher/dancer/masquerade poison immunity (driven by poisonImmuneSeats)
 * - Wolf Queen link death
 * - Bonded link death (Shadow ↔ Avenger)
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
 * - nightmareBlock: number | undefined
 * - isWolfBlockedByNightmare: boolean | undefined
 *
 * RoleSeatMap 字段定义来源：src/services/DeathCalculator.ts
 * - wolfQueenLinkSeat, dreamcatcherLinkSeat, poisonSourceSeat, guardProtectorSeat: number (-1 表示不在场)
 * - poisonImmuneSeats: number[] (免疫毒药的角色座位)
 * - reflectsDamageSeats: number[] (反伤角色座位)
 * - reflectionSources: ReflectionSource[] (反伤来源配对列表)
 */

import {
  calculateDeaths,
  calculateDeathsDetailed,
  NightActions,
  RoleSeatMap,
} from '@werewolf/game-engine/engine/DeathCalculator';
import { makeWitchPoison, makeWitchSave } from '@werewolf/game-engine/models/actions/WitchAction';

/** All roles absent — mirrors the module-private DEFAULT_ROLE_SEAT_MAP */
const NO_ROLES: RoleSeatMap = {
  wolfQueenLinkSeat: -1,
  dreamcatcherLinkSeat: -1,
  poisonSourceSeat: -1,
  guardProtectorSeat: -1,
  bondedLinkSeats: null,
  coupleLinkSeats: null,
  poisonImmuneSeats: [],
  reflectsDamageSeats: [],
  wolfKillSilentImmuneSeats: [],
  checkDeathTargetSeats: [],
  reflectionSources: [],
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

    it('should not kill poison-immune role when poisoned', () => {
      const actions: NightActions = {
        witchAction: makeWitchPoison(5),
      };
      const roleSeatMap: RoleSeatMap = {
        ...NO_ROLES,
        poisonImmuneSeats: [5],
      };

      const deaths = calculateDeaths(actions, roleSeatMap);
      expect(deaths).toEqual([]);
    });

    it('should kill non-immune role when poisoned', () => {
      const actions: NightActions = {
        witchAction: makeWitchPoison(5),
      };
      const roleSeatMap: RoleSeatMap = {
        ...NO_ROLES,
        poisonImmuneSeats: [7], // immune role is at different seat
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
        wolfQueenLinkSeat: 2,
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
        wolfQueenLinkSeat: 2,
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
        dreamcatcherLinkSeat: 2,
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
        dreamcatcherLinkSeat: 2,
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
        guardProtectorSeat: 11,
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
        poisonSourceSeat: 9,
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
        poisonSourceSeat: 9,
      };

      const deaths = calculateDeaths(actions, roleSeatMap);

      // 女巫被封锁，毒人无效，只有0号死亡
      expect(deaths).toEqual([0]);
    });

    it('封锁狼人 → 狼人无法袭击', () => {
      const actions: NightActions = {
        wolfKill: 0, // 狼想杀0号
        isWolfBlockedByNightmare: true, // 梦魇封锁了狼人
      };

      const deaths = calculateDeaths(actions);

      // 狼人被封锁，当夜无法袭击
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
        guardProtectorSeat: 11,
      };

      const deaths = calculateDeaths(actions, roleSeatMap);

      // 封锁的是村民，守卫保护有效
      expect(deaths).toEqual([]);
    });
  });

  // ===========================================================================
  // Bonded Link Death (Shadow ↔ Avenger)
  // ===========================================================================

  describe('Bonded Link Death', () => {
    it('影子死亡 → 复仇者也死亡（同生共死）', () => {
      const actions: NightActions = {
        wolfKill: 3, // wolf kills shadow (seat 3)
      };
      const roleSeatMap: RoleSeatMap = {
        ...NO_ROLES,
        bondedLinkSeats: [3, 7], // shadow=3, avenger=7
      };

      const deaths = calculateDeaths(actions, roleSeatMap);
      expect(deaths).toEqual([3, 7]);
    });

    it('复仇者死亡 → 影子也死亡（双向）', () => {
      const actions: NightActions = {
        wolfKill: 7, // wolf kills avenger (seat 7)
      };
      const roleSeatMap: RoleSeatMap = {
        ...NO_ROLES,
        bondedLinkSeats: [3, 7],
      };

      const deaths = calculateDeaths(actions, roleSeatMap);
      expect(deaths).toEqual([3, 7]);
    });

    it('未绑定时 → 无连带死亡', () => {
      const actions: NightActions = {
        wolfKill: 3,
      };
      const roleSeatMap: RoleSeatMap = {
        ...NO_ROLES,
        bondedLinkSeats: null, // not bonded
      };

      const deaths = calculateDeaths(actions, roleSeatMap);
      expect(deaths).toEqual([3]);
    });

    it('两人同时死亡 → 不重复计算', () => {
      const actions: NightActions = {
        wolfKill: 3,
        witchAction: makeWitchPoison(7),
      };
      const roleSeatMap: RoleSeatMap = {
        ...NO_ROLES,
        bondedLinkSeats: [3, 7],
      };

      const deaths = calculateDeaths(actions, roleSeatMap);
      // Both already dead, no duplicate
      expect(deaths).toEqual([3, 7]);
    });

    it('守卫守住影子 → 不触发连带', () => {
      const actions: NightActions = {
        wolfKill: 3,
        guardProtect: 3, // guard protects shadow
      };
      const roleSeatMap: RoleSeatMap = {
        ...NO_ROLES,
        guardProtectorSeat: 11,
        bondedLinkSeats: [3, 7],
      };

      const deaths = calculateDeaths(actions, roleSeatMap);
      // Shadow saved by guard, no bonded link triggered
      expect(deaths).toEqual([]);
    });

    it('女巫毒影子 → 复仇者连带死亡', () => {
      const actions: NightActions = {
        wolfKill: 0, // wolf kills someone else
        witchAction: makeWitchPoison(3), // witch poisons shadow
      };
      const roleSeatMap: RoleSeatMap = {
        ...NO_ROLES,
        bondedLinkSeats: [3, 7],
      };

      const deaths = calculateDeaths(actions, roleSeatMap);
      expect(deaths).toEqual([0, 3, 7]);
    });

    it('与狼美连带交互：狼美人死亡拉人 + 被拉目标是绑定角色 → 触发同生共死', () => {
      const actions: NightActions = {
        wolfKill: 0,
        wolfQueenCharm: 3, // wolf queen charms shadow
      };
      const roleSeatMap: RoleSeatMap = {
        ...NO_ROLES,
        wolfQueenLinkSeat: 0, // wolf queen is seat 0 (wolf killed)
        bondedLinkSeats: [3, 7],
      };

      // Wolf queen (seat 0) dies → charm kills shadow (3) → bonded link kills avenger (7)
      const deaths = calculateDeaths(actions, roleSeatMap);
      expect(deaths).toEqual([0, 3, 7]);
    });
  });

  // ===========================================================================
  // Spirit Knight Reflection
  // ===========================================================================

  describe('Spirit Knight Reflection', () => {
    it('预言家查验恶灵骑士 → 预言家死亡', () => {
      const actions: NightActions = {
        wolfKill: 0,
      };
      const roleSeatMap: RoleSeatMap = {
        ...NO_ROLES,
        reflectsDamageSeats: [7],
        poisonImmuneSeats: [7],
        reflectionSources: [{ sourceSeat: 8, targetSeat: 7 }],
      };

      const deaths = calculateDeaths(actions, roleSeatMap);

      expect(deaths).toContain(0);
      expect(deaths).toContain(8);
      expect(deaths).not.toContain(7);
    });

    it('女巫毒恶灵骑士 → 女巫死亡，恶灵骑士免疫', () => {
      const actions: NightActions = {
        wolfKill: 0,
        witchAction: makeWitchPoison(7),
      };
      const roleSeatMap: RoleSeatMap = {
        ...NO_ROLES,
        reflectsDamageSeats: [7],
        poisonImmuneSeats: [7],
        poisonSourceSeat: 9,
        reflectionSources: [{ sourceSeat: 9, targetSeat: 7 }],
      };

      const deaths = calculateDeaths(actions, roleSeatMap);

      expect(deaths).toContain(0);
      expect(deaths).toContain(9);
      expect(deaths).not.toContain(7);
    });

    it('预言家查验普通狼人 → 无反伤', () => {
      const actions: NightActions = {
        wolfKill: 0,
      };
      const roleSeatMap: RoleSeatMap = {
        ...NO_ROLES,
        reflectsDamageSeats: [7],
        poisonImmuneSeats: [7],
        reflectionSources: [{ sourceSeat: 8, targetSeat: 4 }],
      };

      const deaths = calculateDeaths(actions, roleSeatMap);

      expect(deaths).toEqual([0]);
    });

    it('女巫毒普通狼人 → 无反伤', () => {
      const actions: NightActions = {
        wolfKill: 0,
        witchAction: makeWitchPoison(4),
      };
      const roleSeatMap: RoleSeatMap = {
        ...NO_ROLES,
        reflectsDamageSeats: [7],
        poisonImmuneSeats: [7],
        poisonSourceSeat: 9,
        reflectionSources: [{ sourceSeat: 9, targetSeat: 4 }],
      };

      const deaths = calculateDeaths(actions, roleSeatMap);

      expect(deaths).toContain(0);
      expect(deaths).toContain(4);
      expect(deaths).not.toContain(9);
    });

    it('反伤角色不在场时无反伤规则', () => {
      const actions: NightActions = {
        wolfKill: 0,
        witchAction: makeWitchPoison(5),
      };

      const deaths = calculateDeaths(actions); // default role seat map (no reflectsDamage)

      expect(deaths).toContain(0);
      expect(deaths).toContain(5);
    });

    it('女巫被梦魇封锁时毒恶灵骑士 → 无反伤', () => {
      // Nightmare-blocked sources are excluded at construction time,
      // so reflectionSources is empty when witch is blocked.
      const actions: NightActions = {
        wolfKill: 0,
        witchAction: makeWitchPoison(7),
        nightmareBlock: 9, // 封锁女巫
      };
      const roleSeatMap: RoleSeatMap = {
        ...NO_ROLES,
        reflectsDamageSeats: [7],
        poisonImmuneSeats: [7],
        poisonSourceSeat: 9,
        reflectionSources: [], // witch blocked → no reflection source
      };

      const deaths = calculateDeaths(actions, roleSeatMap);

      // 女巫被封锁，毒无效 → 无反伤，只有 0 号死
      expect(deaths).toEqual([0]);
    });

    it('通灵师查验恶灵骑士 → 通灵师死亡', () => {
      const roleSeatMap: RoleSeatMap = {
        ...NO_ROLES,
        reflectsDamageSeats: [7],
        poisonImmuneSeats: [7],
        reflectionSources: [{ sourceSeat: 10, targetSeat: 7 }],
      };
      const actions: NightActions = {
        wolfKill: 0,
      };

      const deaths = calculateDeaths(actions, roleSeatMap);

      expect(deaths).toContain(0);
      expect(deaths).toContain(10);
      expect(deaths).not.toContain(7);
    });

    it('纯白之女查验恶灵骑士 → 纯白之女死亡', () => {
      const roleSeatMap: RoleSeatMap = {
        ...NO_ROLES,
        reflectsDamageSeats: [7],
        poisonImmuneSeats: [7],
        reflectionSources: [{ sourceSeat: 11, targetSeat: 7 }],
      };
      const actions: NightActions = {
        wolfKill: 0,
      };

      const deaths = calculateDeaths(actions, roleSeatMap);

      expect(deaths).toContain(0);
      expect(deaths).toContain(11);
      expect(deaths).not.toContain(7);
    });

    it('通灵师查验普通狼人 → 无反伤', () => {
      const roleSeatMap: RoleSeatMap = {
        ...NO_ROLES,
        reflectsDamageSeats: [7],
        poisonImmuneSeats: [7],
        reflectionSources: [{ sourceSeat: 10, targetSeat: 4 }],
      };
      const actions: NightActions = {
        wolfKill: 0,
      };

      const deaths = calculateDeaths(actions, roleSeatMap);

      expect(deaths).toEqual([0]);
    });

    it('纯白之女查验普通狼人 → 无反伤', () => {
      const roleSeatMap: RoleSeatMap = {
        ...NO_ROLES,
        reflectsDamageSeats: [7],
        poisonImmuneSeats: [7],
        reflectionSources: [{ sourceSeat: 11, targetSeat: 4 }],
      };
      const actions: NightActions = {
        wolfKill: 0,
      };

      const deaths = calculateDeaths(actions, roleSeatMap);

      expect(deaths).toEqual([0]);
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

  // ===========================================================================
  // Cursed Fox (咒狐)
  // ===========================================================================

  describe('Cursed Fox (咒狐)', () => {
    it('狼刀咒狐 → 咒狐不死（静默免疫）', () => {
      const actions: NightActions = { wolfKill: 5 };
      const roleSeatMap: RoleSeatMap = {
        ...NO_ROLES,
        wolfKillSilentImmuneSeats: [5],
      };

      const deaths = calculateDeaths(actions, roleSeatMap);
      expect(deaths).toEqual([]);
    });

    it('预言家查验咒狐 → 咒狐出局', () => {
      const actions: NightActions = {};
      const roleSeatMap: RoleSeatMap = {
        ...NO_ROLES,
        checkDeathTargetSeats: [5],
      };

      const deaths = calculateDeaths(actions, roleSeatMap);
      expect(deaths).toEqual([5]);
    });

    it('同夜狼刀 + 预言查验咒狐 → 咒狐出局（狼刀无效，查验致死生效）', () => {
      const actions: NightActions = { wolfKill: 5 };
      const roleSeatMap: RoleSeatMap = {
        ...NO_ROLES,
        wolfKillSilentImmuneSeats: [5],
        checkDeathTargetSeats: [5],
      };

      const deaths = calculateDeaths(actions, roleSeatMap);
      expect(deaths).toEqual([5]);
    });

    it('同夜狼刀 + 毒药 + 预言查验咒狐 → 咒狐出局（三重交互）', () => {
      const actions: NightActions = {
        wolfKill: 5,
        witchAction: makeWitchPoison(5),
      };
      const roleSeatMap: RoleSeatMap = {
        ...NO_ROLES,
        wolfKillSilentImmuneSeats: [5],
        checkDeathTargetSeats: [5],
        poisonSourceSeat: 3,
      };

      const deaths = calculateDeaths(actions, roleSeatMap);
      expect(deaths).toEqual([5]);
    });

    it('女巫毒药毒杀咒狐 → 咒狐正常出局', () => {
      const actions: NightActions = {
        witchAction: makeWitchPoison(5),
      };
      const roleSeatMap: RoleSeatMap = {
        ...NO_ROLES,
        poisonSourceSeat: 3,
      };

      const deaths = calculateDeaths(actions, roleSeatMap);
      expect(deaths).toEqual([5]);
    });

    it('狼刀咒狐 + 女巫救咒狐 → 咒狐不死，解药浪费', () => {
      // 咒狐免疫狼刀，所以 processWolfKill 直接 return（不加死亡）
      // 女巫的 save 实际上不影响结果（因为没人会死），解药被浪费
      const actions: NightActions = {
        wolfKill: 5,
        witchAction: makeWitchSave(5),
      };
      const roleSeatMap: RoleSeatMap = {
        ...NO_ROLES,
        wolfKillSilentImmuneSeats: [5],
        poisonSourceSeat: 3,
      };

      const deaths = calculateDeaths(actions, roleSeatMap);
      expect(deaths).toEqual([]);
    });

    it('狼刀非咒狐目标 → 正常死亡（咒狐不影响其他人）', () => {
      const actions: NightActions = { wolfKill: 2 };
      const roleSeatMap: RoleSeatMap = {
        ...NO_ROLES,
        wolfKillSilentImmuneSeats: [5], // 咒狐在5号位但被刀的是2号位
      };

      const deaths = calculateDeaths(actions, roleSeatMap);
      expect(deaths).toEqual([2]);
    });

    it('预言家未查验咒狐 → 咒狐不出局', () => {
      const actions: NightActions = {};
      const roleSeatMap: RoleSeatMap = {
        ...NO_ROLES,
        // checkDeathTargetSeats 为空，因为预言家查验的不是咒狐
      };

      const deaths = calculateDeaths(actions, roleSeatMap);
      expect(deaths).toEqual([]);
    });
  });
});

// =============================================================================
// calculateDeathsDetailed — death reason tracking
// =============================================================================

describe('calculateDeathsDetailed', () => {
  it('wolf kill → reason wolfKill', () => {
    const result = calculateDeathsDetailed({ wolfKill: 3 });
    expect(result.deaths).toEqual([3]);
    expect(result.deathReasons).toEqual({ 3: 'wolfKill' });
  });

  it('poison kill → reason poison', () => {
    const result = calculateDeathsDetailed(
      { witchAction: makeWitchPoison(5) },
      { ...NO_ROLES, poisonSourceSeat: 2 },
    );
    expect(result.deaths).toEqual([5]);
    expect(result.deathReasons).toEqual({ 5: 'poison' });
  });

  it('wolf kill + poison → both reasons', () => {
    const result = calculateDeathsDetailed(
      { wolfKill: 1, witchAction: makeWitchPoison(5) },
      { ...NO_ROLES, poisonSourceSeat: 2 },
    );
    expect(result.deaths).toEqual([1, 5]);
    expect(result.deathReasons).toEqual({ 1: 'wolfKill', 5: 'poison' });
  });

  it('check death → reason checkDeath', () => {
    const result = calculateDeathsDetailed({}, { ...NO_ROLES, checkDeathTargetSeats: [4] });
    expect(result.deaths).toEqual([4]);
    expect(result.deathReasons).toEqual({ 4: 'checkDeath' });
  });

  it('wolf queen link → reason wolfQueenLink', () => {
    const result = calculateDeathsDetailed(
      { wolfKill: 2, wolfQueenCharm: 7 },
      { ...NO_ROLES, wolfQueenLinkSeat: 2 },
    );
    expect(result.deaths).toEqual([2, 7]);
    expect(result.deathReasons).toEqual({ 2: 'wolfKill', 7: 'wolfQueenLink' });
  });

  it('bonded link → reason bondedLink', () => {
    const result = calculateDeathsDetailed(
      { wolfKill: 3 },
      { ...NO_ROLES, bondedLinkSeats: [3, 8] },
    );
    expect(result.deaths).toEqual([3, 8]);
    expect(result.deathReasons).toEqual({ 3: 'wolfKill', 8: 'bondedLink' });
  });

  it('couple link → reason coupleLink', () => {
    const result = calculateDeathsDetailed(
      { wolfKill: 1 },
      { ...NO_ROLES, coupleLinkSeats: [1, 6] },
    );
    expect(result.deaths).toEqual([1, 6]);
    expect(result.deathReasons).toEqual({ 1: 'wolfKill', 6: 'coupleLink' });
  });

  it('dreamcatcher protection clears reason, link death adds dreamcatcherLink', () => {
    const result = calculateDeathsDetailed(
      { wolfKill: 5, dreamcatcherDream: 5 },
      { ...NO_ROLES, dreamcatcherLinkSeat: 9 },
    );
    // dream target 5 is protected, dreamcatcher 9 is not dead → no deaths
    expect(result.deaths).toEqual([]);
    expect(result.deathReasons).toEqual({});
  });

  it('dreamcatcher dies → dream target gets dreamcatcherLink reason', () => {
    const result = calculateDeathsDetailed(
      { wolfKill: 9, dreamcatcherDream: 5 },
      { ...NO_ROLES, dreamcatcherLinkSeat: 9 },
    );
    expect(result.deaths).toEqual([5, 9]);
    expect(result.deathReasons).toEqual({ 9: 'wolfKill', 5: 'dreamcatcherLink' });
  });

  it('reflection → reason reflection', () => {
    const result = calculateDeathsDetailed(
      {},
      {
        ...NO_ROLES,
        reflectsDamageSeats: [4],
        reflectionSources: [{ sourceSeat: 2, targetSeat: 4 }],
      },
    );
    expect(result.deaths).toEqual([2]);
    expect(result.deathReasons).toEqual({ 2: 'reflection' });
  });

  it('magician swap → swapped seat gets magicianSwap reason', () => {
    const result = calculateDeathsDetailed({
      wolfKill: 3,
      magicianSwap: { first: 3, second: 7 },
    });
    expect(result.deaths).toEqual([7]);
    expect(result.deathReasons).toEqual({ 7: 'magicianSwap' });
  });

  it('peaceful night → empty reasons', () => {
    const result = calculateDeathsDetailed({});
    expect(result.deaths).toEqual([]);
    expect(result.deathReasons).toEqual({});
  });

  it('calculateDeaths delegates to calculateDeathsDetailed (same deaths)', () => {
    const actions: NightActions = { wolfKill: 1, witchAction: makeWitchPoison(5) };
    const roleSeatMap: RoleSeatMap = { ...NO_ROLES, poisonSourceSeat: 2 };

    const deaths = calculateDeaths(actions, roleSeatMap);
    const detailed = calculateDeathsDetailed(actions, roleSeatMap);
    expect(deaths).toEqual(detailed.deaths);
  });
});
