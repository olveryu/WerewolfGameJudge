/**
 * Night-1 Integration Test: Wolf King Dreamcatcher - Dreamcatcher Dream
 *
 * Board: Wolf King Dreamcatcher
 * Topic: Dreamcatcher's protect and linked death
 *
 * Fixed seat-role assignment:
 *   seat 0-3: villager
 *   seat 4-6: wolf
 *   seat 7: darkWolfKing
 *   seat 8: seer
 *   seat 9: witch
 *   seat 10: hunter
 *   seat 11: dreamcatcher
 *
 * Core rules:
 * - Dreamcatcher's protected target is immune to night death
 * - When Dreamcatcher dies, the protected target also dies (linked death)
 *
 * Architecture: intents → handlers → reducer → GameState
 */

import type { RoleId } from '@werewolf/game-engine/models/roles';

import { cleanupGame, createGame, type GameContext } from './gameFactory';
import { executeFullNight } from './stepByStepRunner';

const TEMPLATE_NAME = '狼王摄梦人';

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
  map.set(11, 'dreamcatcher');
  return map;
}

describe('Night-1: 狼王摄梦人 - Dreamcatcher (12p)', () => {
  let ctx: GameContext;

  afterEach(() => {
    cleanupGame();
  });

  describe('Dreamcatcher 守护目标', () => {
    it('dreamcatcher 守护 villager(0)，action 写入 state.actions', () => {
      ctx = createGame(TEMPLATE_NAME, createRoleAssignment());

      const result = executeFullNight(ctx, {
        dreamcatcher: 0, // 守护 villager
        wolf: 1,
        witch: { save: null, poison: null },
        seer: 4,
      });

      expect(result.completed).toBe(true);

      // Core assertion: dreamcatcherDream action written to state.actions
      const state = ctx.getGameState();
      const dreamAction = state.actions?.find((a) => a.schemaId === 'dreamcatcherDream');
      expect(dreamAction).toBeDefined();
      expect(dreamAction!.actorSeat).toBe(11); // dreamcatcher 在 seat 11
      expect(dreamAction!.targetSeat).toBe(0); // 守护 seat 0

      // attacked seat 1 dies
      expect(result.deaths).toEqual([1]);
    });

    it('dreamcatcher 守护被袭击目标(1)，该目标免疫死亡', () => {
      ctx = createGame(TEMPLATE_NAME, createRoleAssignment());

      const result = executeFullNight(ctx, {
        dreamcatcher: 1, // 守护 villager(1)
        wolf: 1, // 袭击 villager(1)
        witch: { save: null, poison: null },
        seer: 4,
      });

      expect(result.completed).toBe(true);

      // Core assertion: action recorded
      const state = ctx.getGameState();
      const dreamAction = state.actions?.find((a) => a.schemaId === 'dreamcatcherDream');
      expect(dreamAction).toBeDefined();
      expect(dreamAction!.targetSeat).toBe(1);

      // protected target is immune to the attack; no deaths
      expect(result.deaths).toEqual([]);
    });
  });

  describe('Dreamcatcher 空选', () => {
    it('dreamcatcher 不守护时，action 中 targetSeat 为 undefined', () => {
      ctx = createGame(TEMPLATE_NAME, createRoleAssignment());

      const result = executeFullNight(ctx, {
        dreamcatcher: null, // 不守护
        wolf: 0,
        witch: { save: null, poison: null },
        seer: 4,
      });

      expect(result.completed).toBe(true);

      // Core assertion: when no target selected, action's targetSeat is undefined or the action is absent
      const state = ctx.getGameState();
      const dreamAction = state.actions?.find((a) => a.schemaId === 'dreamcatcherDream');
      expect(dreamAction?.targetSeat).toBeUndefined();

      expect(result.deaths).toEqual([0]);
    });
  });

  describe('Dreamcatcher 链接死亡', () => {
    it('dreamcatcher 被毒杀，被守护者也死亡', () => {
      ctx = createGame(TEMPLATE_NAME, createRoleAssignment());

      const result = executeFullNight(ctx, {
        dreamcatcher: 0, // 守护 villager(0)
        wolf: null, // 放弃袭击
        witch: { save: null, poison: 11 }, // 毒 dreamcatcher
        seer: 4,
      });

      expect(result.completed).toBe(true);

      // Core assertion: both dreamcatcher(11) and the protected target(0) die
      expect([...result.deaths].sort((a, b) => a - b)).toEqual([0, 11]);
    });
  });
});
