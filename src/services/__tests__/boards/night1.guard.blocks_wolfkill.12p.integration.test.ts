/**
 * Night-1 Integration Test: Guard Blocks Wolf Kill
 *
 * Topic: Interaction between Guard's protection and the wolf kill.
 *
 * Template: Wolf King Guard
 * Fixed seat-role assignment:
 *   seat 0-3: villager
 *   seat 4-6: wolf
 *   seat 7: darkWolfKing
 *   seat 8: seer
 *   seat 9: witch
 *   seat 10: hunter
 *   seat 11: guard
 *
 * Core rules:
 * - The Guard's protected target is immune to the wolf kill
 * - witchContext.killedSeat needs to be pinned down when the Guard blocks the kill
 *
 * Architecture: intents -> handlers -> reducer -> WerewolfState
 */

import type { RoleId } from '@werewolf/game-engine/werewolf/models/roles';

import { cleanupGame, createGame, type GameContext } from './gameFactory';
import { executeFullNight } from './stepByStepRunner';

const TEMPLATE_NAME = '狼王守卫';

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
  map.set(11, 'guard');
  return map;
}

describe('Night-1: Guard Blocks Wolf Kill (12p)', () => {
  let ctx: GameContext;

  afterEach(() => {
    cleanupGame();
  });

  describe('守卫守护成功抵挡袭击', () => {
    it('守卫守护袭击目标，该目标不死', () => {
      ctx = createGame(TEMPLATE_NAME, createRoleAssignment());

      // Guard protects seat 0, wolves attack seat 0
      const result = executeFullNight(ctx, {
        guard: 0, // protect seat 0
        wolf: 0, // attack seat 0
        witch: { save: null, poison: null },
        seer: 4,
      });

      expect(result.completed).toBe(true);

      // Core assertion: seat 0 is protected by Guard and not in the death list
      expect(result.deaths).toEqual([]);

      // guardedSeat is written to currentNightResults
      expect(ctx.getGameState().currentNightResults?.guardedSeat).toBe(0);
    });

    it('守卫守护非袭击目标，袭击目标死亡', () => {
      ctx = createGame(TEMPLATE_NAME, createRoleAssignment());

      // Guard protects seat 1, wolves attack seat 0
      const result = executeFullNight(ctx, {
        guard: 1, // protect seat 1
        wolf: 0, // attack seat 0
        witch: { save: null, poison: null },
        seer: 4,
      });

      expect(result.completed).toBe(true);

      // Core assertion: seat 0 is unprotected and dies
      expect(result.deaths).toEqual([0]);
    });
  });

  describe('守卫不守护', () => {
    it('守卫空守时，袭击正常生效', () => {
      ctx = createGame(TEMPLATE_NAME, createRoleAssignment());

      const result = executeFullNight(ctx, {
        guard: null, // no protection
        wolf: 2,
        witch: { save: null, poison: null },
        seer: 4,
      });

      expect(result.completed).toBe(true);
      expect(result.deaths).toEqual([2]);
    });
  });

  /**
   * The witchContext.killedSeat contract is covered by witchContext.test.ts unit tests.
   * Integration tests only verify the final death outcome, not intermediate state.
   *
   * When the Guard blocks the kill, witchContext.killedSeat still reports the original target
   * (so the witch can see who was attacked).
   * See: src/services/engine/handlers/__tests__/witchContext.test.ts
   */

  describe('守卫 + 女巫同守同救', () => {
    it('守卫守护 + 女巫救同一目标：按"同守同救必死"规则，目标死亡', () => {
      ctx = createGame(TEMPLATE_NAME, createRoleAssignment());

      // Guard protects seat 0, witch saves seat 0, wolves attack seat 0
      const result = executeFullNight(ctx, {
        guard: 0,
        wolf: 0,
        witch: { save: 0, poison: null },
        seer: 4,
      });

      expect(result.completed).toBe(true);

      // Core assertion: guard-and-save on the same target always dies
      expect(result.deaths).toEqual([0]);
    });

    it('守卫守护 A + 女巫救 B：只有女巫救的 B 生效（如果 B 被袭击）', () => {
      ctx = createGame(TEMPLATE_NAME, createRoleAssignment());

      // Guard protects seat 1, wolves attack seat 0, witch saves seat 0
      const result = executeFullNight(ctx, {
        guard: 1, // protect seat 1 (not the attack target)
        wolf: 0, // attack seat 0
        witch: { save: 0, poison: null }, // save seat 0
        seer: 4,
      });

      expect(result.completed).toBe(true);

      // Core assertion: only the witch save applies; seat 0 survives
      expect(result.deaths).toEqual([]);
    });
  });
});
