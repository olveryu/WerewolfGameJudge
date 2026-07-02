/**
 * Night-1 Integration Test: Witch Save/Poison Contracts
 *
 * Topic: Witch save/poison constraints and effects.
 *
 * Template: Wolf King Magician
 * Fixed seat-role assignment:
 *   seat 0-3: villager
 *   seat 4-6: wolf
 *   seat 7: darkWolfKing
 *   seat 8: seer
 *   seat 9: witch
 *   seat 10: hunter
 *   seat 11: magician
 *
 * Core constraints (Night-1-only):
 * - notSelf: Witch cannot self-save
 * - save can only target players attacked by wolves
 * - Cannot use save and poison in the same night
 *
 * Architecture: intents -> handlers -> reducer -> WerewolfState
 */

import type { RoleId } from '@werewolf/game-engine/werewolf/models/roles';

import { cleanupGame, createGame, type GameContext } from './gameFactory';
import { executeFullNight } from './stepByStepRunner';

const TEMPLATE_NAME = '狼王魔术师';

/**
 * Fixed seat-role assignment
 */
function createRoleAssignment(): Map<number, RoleId> {
  const map = new Map<number, RoleId>();
  map.set(0, 'villager');
  map.set(1, 'villager');
  map.set(2, 'villager');
  map.set(3, 'villager');
  map.set(4, 'wolf');
  map.set(5, 'wolf');
  map.set(6, 'wolf');
  map.set(7, 'darkWolfKing');
  map.set(8, 'seer');
  map.set(9, 'witch');
  map.set(10, 'hunter');
  map.set(11, 'magician');
  return map;
}

describe('Night-1: Witch Save/Poison Contracts (12p)', () => {
  let ctx: GameContext;

  afterEach(() => {
    cleanupGame();
  });

  describe('Save 正常救人', () => {
    it('女巫救被袭击的玩家，该玩家不死', () => {
      ctx = createGame(TEMPLATE_NAME, createRoleAssignment());

      // Attack seat 0, witch saves seat 0
      const result = executeFullNight(ctx, {
        magician: null,
        wolf: 0,
        witch: { save: 0, poison: null },
        seer: 4,
      });

      expect(result.completed).toBe(true);

      // Core assertion: seat 0 saved, not in death list
      expect(result.deaths).toEqual([]);

      // savedSeat written to currentNightResults
      expect(ctx.getGameState().currentNightResults?.savedSeat).toBe(0);
    });

    it('女巫不救人时，被袭击的玩家死亡', () => {
      ctx = createGame(TEMPLATE_NAME, createRoleAssignment());

      const result = executeFullNight(ctx, {
        magician: null,
        wolf: 1,
        witch: { save: null, poison: null },
        seer: 4,
      });

      expect(result.completed).toBe(true);
      expect(result.deaths).toEqual([1]);
    });
  });

  describe('Poison 毒人', () => {
    it('女巫毒人，该玩家死亡', () => {
      ctx = createGame(TEMPLATE_NAME, createRoleAssignment());

      // Wolves skip attack, witch poisons seat 2
      const result = executeFullNight(ctx, {
        magician: null,
        wolf: null,
        witch: { save: null, poison: 2 },
        seer: 4,
      });

      expect(result.completed).toBe(true);

      // Core assertion: seat 2 poisoned to death
      expect(result.deaths).toEqual([2]);

      // poisonedSeat written to currentNightResults
      expect(ctx.getGameState().currentNightResults?.poisonedSeat).toBe(2);
    });

    it('女巫可以毒狼人', () => {
      ctx = createGame(TEMPLATE_NAME, createRoleAssignment());

      const result = executeFullNight(ctx, {
        magician: null,
        wolf: null,
        witch: { save: null, poison: 4 }, // poison wolf
        seer: 5,
      });

      expect(result.completed).toBe(true);
      expect(result.deaths).toEqual([4]);
    });
  });

  describe('notSelf 约束：女巫不能自救', () => {
    /**
     * notSelf constraint at UI layer disables selection: witch cannot select self in UI.
     * Here we verify: when the witch is attacked, can only choose not to save (skip).
     * Direct reject testing covered by schema/resolver contract tests.
     */
    it('袭击女巫 seat(9) 时，女巫 skip 救人，女巫死亡', () => {
      ctx = createGame(TEMPLATE_NAME, createRoleAssignment());

      // Attack seat 9 (witch), witch skips (cannot self-save)
      const result = executeFullNight(ctx, {
        magician: null,
        wolf: 9, // attack witch
        witch: { save: null, poison: null }, // skip save (self-save forbidden)
        seer: 4,
      });

      expect(result.completed).toBe(true);

      // Core assertion: witch cannot self-save, seat 9 dies
      expect(result.deaths).toContain(9);
    });
  });

  describe('witchContext 写入 WerewolfState', () => {
    it('袭击目标写入 witchContext.killedSeat（验证最终状态）', () => {
      ctx = createGame(TEMPLATE_NAME, createRoleAssignment());

      // Run full night, check savedSeat/poisonedSeat records in state
      const result = executeFullNight(ctx, {
        magician: null,
        wolf: 0, // attack seat 0
        witch: { save: 0, poison: null }, // save seat 0
        seer: 4,
      });

      expect(result.completed).toBe(true);

      // Core assertion: savedSeat records the witch's save target
      expect(ctx.getGameState().currentNightResults?.savedSeat).toBe(0);

      // seat 0 saved, alive
      expect(result.deaths).toEqual([]);
    });
  });

  describe('Save 只能救被袭击的目标', () => {
    /**
     * Witch can only save the attacked target. UI layer only enables the attacked seat.
     * If wolves skip attack, the witch's save option is unavailable.
     * Here we verify: attack seat 0, witch saves seat 0 succeeds; if witch skips seat 0 dies.
     * Direct reject testing covered by schema/resolver contract tests.
     */
    it('女巫只救被袭击目标，救成功', () => {
      ctx = createGame(TEMPLATE_NAME, createRoleAssignment());

      // Attack seat 0, witch saves seat 0 (only legal target)
      const result = executeFullNight(ctx, {
        magician: null,
        wolf: 0,
        witch: { save: 0, poison: null }, // save the attacked
        seer: 4,
      });

      expect(result.completed).toBe(true);

      // Core assertion: seat 0 saved, alive
      expect(result.deaths).not.toContain(0);
      expect(ctx.getGameState().currentNightResults?.savedSeat).toBe(0);
    });

    it('女巫不救人时，被袭击者死亡', () => {
      ctx = createGame(TEMPLATE_NAME, createRoleAssignment());

      // Attack seat 0, witch does not save
      const result = executeFullNight(ctx, {
        magician: null,
        wolf: 0,
        witch: { save: null, poison: null }, // skip save
        seer: 4,
      });

      expect(result.completed).toBe(true);

      // Core assertion: seat 0 dies
      expect(result.deaths).toContain(0);
    });
  });
});
