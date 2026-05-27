/**
 * Night-1 Integration Test: WolfQueen Charm
 *
 * Theme: Eclipse Wolf Queen charm behavior and linked death.
 *
 * Template: Wolf Queen Guard
 * Fixed seat-role assignment:
 *   seat 0-3: villager
 *   seat 4-6: wolf
 *   seat 7: wolfQueen
 *   seat 8: seer
 *   seat 9: witch
 *   seat 10: hunter
 *   seat 11: guard
 *
 * Core rules:
 * - wolfQueen charm target recorded via action (targetSeat)
 * - charmed target linked to wolfQueen (linked death handled in DeathCalculator)
 *
 * Architecture: intents -> handlers -> reducer -> GameState
 */

import type { RoleId } from '@werewolf/game-engine/models/roles';

import { cleanupGame, createGame, type GameContext } from './gameFactory';
import { executeFullNight } from './stepByStepRunner';

const TEMPLATE_NAME = '狼美守卫';

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
  map.set(7, 'wolfQueen');
  map.set(8, 'seer');
  map.set(9, 'witch');
  map.set(10, 'hunter');
  map.set(11, 'guard');
  return map;
}

describe('Night-1: WolfQueen Charm (12p)', () => {
  let ctx: GameContext;

  afterEach(() => {
    cleanupGame();
  });

  describe('WolfQueen 魅惑正常执行', () => {
    it('wolfQueen 魅惑 villager(0)，action 记录正确，流程完成', () => {
      ctx = createGame(TEMPLATE_NAME, createRoleAssignment());

      const result = executeFullNight(ctx, {
        guard: null,
        wolf: 1, // attack seat 1
        wolfQueen: 0, // charm seat 0
        witch: { save: null, poison: null },
        seer: 4,
      });

      expect(result.completed).toBe(true);

      // Core assertion: wolfQueenCharm action written to state.actions
      const state = ctx.getGameState();
      const charmAction = state.actions?.find((a) => a.schemaId === 'wolfQueenCharm');
      expect(charmAction).toBeDefined();
      expect(charmAction!.actorSeat).toBe(7); // wolfQueen at seat 7
      expect(charmAction!.targetSeat).toBe(0); // charm seat 0

      // Only attacked seat 1 dies, seat 0 and wolfQueen survive
      expect(result.deaths).toEqual([1]);
    });

    it('wolfQueen 魅惑 seer(8)，action 写入 targetSeat=8', () => {
      ctx = createGame(TEMPLATE_NAME, createRoleAssignment());

      const result = executeFullNight(ctx, {
        guard: null,
        wolf: 0,
        wolfQueen: 8, // charm seer
        witch: { save: null, poison: null },
        seer: 4,
      });

      expect(result.completed).toBe(true);

      // Core assertion: action records charm target
      const state = ctx.getGameState();
      const charmAction = state.actions?.find((a) => a.schemaId === 'wolfQueenCharm');
      expect(charmAction).toBeDefined();
      expect(charmAction!.targetSeat).toBe(8);

      expect(result.deaths).toEqual([0]);
    });
  });

  describe('WolfQueen 不魅惑', () => {
    it('wolfQueen 空选，action 中 targetSeat 为 undefined（或无该 action）', () => {
      ctx = createGame(TEMPLATE_NAME, createRoleAssignment());

      const result = executeFullNight(ctx, {
        guard: null,
        wolf: 0,
        wolfQueen: null, // no charm
        witch: { save: null, poison: null },
        seer: 4,
      });

      // Core assertion: when empty, action exists with targetSeat undefined, or no action
      const state = ctx.getGameState();
      const charmAction = state.actions?.find((a) => a.schemaId === 'wolfQueenCharm');
      // Empty selection: either no action, or targetSeat is undefined
      expect(charmAction?.targetSeat).toBeUndefined();

      expect(result.completed).toBe(true);
      expect(result.deaths).toEqual([0]);
    });
  });

  describe('WolfQueen 链接死亡（Night-1 内）', () => {
    /**
     * Note: current implementation is **one-way linked**
     * - wolfQueen dies -> charmed target also dies ✓
     * - charmed target dies -> wolfQueen unaffected (one-way link)
     *
     * Reflects DeathCalculator.ts rule:
     * "If queen is dead, charmed target also dies"
     */

    it('被魅惑者被袭击时，只有被魅惑者死（单向链接）', () => {
      ctx = createGame(TEMPLATE_NAME, createRoleAssignment());

      // wolfQueen charms seat 0, attacks seat 0
      // Per current rule (one-way link), only seat 0 dies
      const result = executeFullNight(ctx, {
        guard: null,
        wolf: 0, // attack charmed target
        wolfQueen: 0, // charm seat 0
        witch: { save: null, poison: null },
        seer: 4,
      });

      expect(result.completed).toBe(true);

      // Core assertion: only seat 0 dies, wolfQueen(7) survives (one-way link)
      expect(result.deaths).toEqual([0]);
    });

    it('wolfQueen 死亡时，被魅惑者也死亡', () => {
      ctx = createGame(TEMPLATE_NAME, createRoleAssignment());

      // wolfQueen charms seat 0, witch poisons wolfQueen(7)
      const result = executeFullNight(ctx, {
        guard: null,
        wolf: null, // skip attack
        wolfQueen: 0, // charm seat 0
        witch: { save: null, poison: 7 }, // poison wolfQueen
        seer: 4,
      });

      expect(result.completed).toBe(true);

      // Core assertion: wolfQueen(7) and charmed target(0) both die
      expect([...result.deaths].sort((a, b) => a - b)).toEqual([0, 7]);
    });
  });

  describe('WolfQueen 魅惑不影响袭击其他目标', () => {
    it('wolfQueen 魅惑 A，袭击 B，只有 B 死', () => {
      ctx = createGame(TEMPLATE_NAME, createRoleAssignment());

      const result = executeFullNight(ctx, {
        guard: null,
        wolf: 1, // attack seat 1
        wolfQueen: 0, // charm seat 0 (different from attack target)
        witch: { save: null, poison: null },
        seer: 4,
      });

      expect(result.completed).toBe(true);

      // Core assertion: only seat 1 dies, seat 0 and wolfQueen survive
      expect(result.deaths).toEqual([1]);
    });
  });
});
