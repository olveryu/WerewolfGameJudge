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
 * - Celebrity protection and link death
 * - Magician swap
 * - Peaceful night (no deaths)
 */

import {
  calculateDeaths,
  NightActions,
  RoleSeatMap,
  DEFAULT_ROLE_SEAT_MAP,
} from '../DeathCalculator';

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
        witchSave: undefined,
        witchPoison: undefined,
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
        witchSave: 3,
      };

      const deaths = calculateDeaths(actions);
      expect(deaths).toEqual([]);
    });

    it('should not prevent death when witch saves different target', () => {
      const actions: NightActions = {
        wolfKill: 3,
        witchSave: 5,
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
        witchSave: 3,
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
        witchPoison: 5,
      };

      const deaths = calculateDeaths(actions);
      expect(deaths).toEqual([5]);
    });

    it('should kill both wolf target and poison target', () => {
      const actions: NightActions = {
        wolfKill: 3,
        witchPoison: 5,
      };

      const deaths = calculateDeaths(actions);
      expect(deaths).toEqual([3, 5]);
    });

    it('should not kill witcher when poisoned', () => {
      const actions: NightActions = {
        witchPoison: 5,
      };
      const roleSeatMap: RoleSeatMap = {
        ...DEFAULT_ROLE_SEAT_MAP,
        witcher: 5,
      };

      const deaths = calculateDeaths(actions, roleSeatMap);
      expect(deaths).toEqual([]);
    });

    it('should kill non-witcher when poisoned', () => {
      const actions: NightActions = {
        witchPoison: 5,
      };
      const roleSeatMap: RoleSeatMap = {
        ...DEFAULT_ROLE_SEAT_MAP,
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
        ...DEFAULT_ROLE_SEAT_MAP,
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
        ...DEFAULT_ROLE_SEAT_MAP,
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
  // Celebrity Protection and Link Death
  // ===========================================================================

  describe('Celebrity Effect', () => {
    it('should protect dream target from wolf kill', () => {
      const actions: NightActions = {
        wolfKill: 3,
        celebrityDream: 3,
      };

      const deaths = calculateDeaths(actions);
      expect(deaths).toEqual([]);
    });

    it('should kill dream target when celebrity dies', () => {
      const actions: NightActions = {
        wolfKill: 2, // wolf kills celebrity
        celebrityDream: 5,
      };
      const roleSeatMap: RoleSeatMap = {
        ...DEFAULT_ROLE_SEAT_MAP,
        celebrity: 2,
      };

      const deaths = calculateDeaths(actions, roleSeatMap);
      expect(deaths).toEqual([2, 5]);
    });

    it('should protect dream target even if celebrity dies (protection first)', () => {
      // Celebrity protects target, but celebrity dies
      // Dream target is protected from wolf kill, then dies with celebrity
      const actions: NightActions = {
        wolfKill: 2, // wolf kills celebrity
        witchPoison: 5, // witch poisons dream target
        celebrityDream: 5,
      };
      const roleSeatMap: RoleSeatMap = {
        ...DEFAULT_ROLE_SEAT_MAP,
        celebrity: 2,
      };

      // Dream target (5) is protected from poison, then dies with celebrity
      const deaths = calculateDeaths(actions, roleSeatMap);
      // 5 is protected from poison, but dies because celebrity (2) dies
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
        witchPoison: 7,
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
        witchPoison: 7,
      };

      const deaths = calculateDeaths(actions);
      expect(deaths).toEqual([3, 7]);
    });

    it('should handle guard protecting poison target (poison still works)', () => {
      // Guard only protects from wolf kill, not poison
      const actions: NightActions = {
        wolfKill: 3,
        guardProtect: 7,
        witchPoison: 7,
      };

      const deaths = calculateDeaths(actions);
      expect(deaths).toEqual([3, 7]);
    });

    it('should handle witch saving different target than guard protection', () => {
      const actions: NightActions = {
        wolfKill: 3,
        guardProtect: 5,
        witchSave: 3, // witch saves wolf target
      };

      const deaths = calculateDeaths(actions);
      expect(deaths).toEqual([]); // witch save works
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
        witchPoison: 2,
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
