/**
 * Night-1 Integration Test: 狼王摄梦12人 - Dreamcatcher Dream
 *
 * 板子：狼王摄梦12人
 * 主题：摄梦人的守护与链接死亡
 *
 * 固定 seat-role assignment:
 *   seat 0-3: villager
 *   seat 4-6: wolf
 *   seat 7: darkWolfKing
 *   seat 8: seer
 *   seat 9: witch
 *   seat 10: hunter
 *   seat 11: dreamcatcher
 *
 * 核心规则：
 * - 摄梦人守护的目标免疫夜晚死亡
 * - 摄梦人死亡时，被守护者也死亡（链接死亡）
 *
 * 架构：intents → handlers → reducer → GameState
 */

import type { RoleId } from '@werewolf/game-engine/models/roles';

import { cleanupHostGame, createHostGame, HostGameContext } from './hostGameFactory';
import { executeFullNight } from './stepByStepRunner';

const TEMPLATE_NAME = '狼王摄梦12人';

/**
 * 固定 seat-role assignment
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

describe('Night-1: 狼王摄梦12人 - Dreamcatcher (12p)', () => {
  let ctx: HostGameContext;

  afterEach(() => {
    cleanupHostGame();
  });

  describe('Dreamcatcher 守护目标', () => {
    it('dreamcatcher 守护 villager(0)，action 写入 state.actions', () => {
      ctx = createHostGame(TEMPLATE_NAME, createRoleAssignment());

      const result = executeFullNight(ctx, {
        dreamcatcher: 0, // 守护 villager
        wolf: 1,
        witch: { save: null, poison: null },
        seer: 4,
      });

      expect(result.completed).toBe(true);

      // 核心断言：dreamcatcherDream action 写入 state.actions
      const state = ctx.getGameState();
      const dreamAction = state.actions?.find((a) => a.schemaId === 'dreamcatcherDream');
      expect(dreamAction).toBeDefined();
      expect(dreamAction!.actorSeat).toBe(11); // dreamcatcher 在 seat 11
      expect(dreamAction!.targetSeat).toBe(0); // 守护 seat 0

      // 被狼刀的 seat 1 死亡
      expect(result.deaths).toEqual([1]);
    });

    it('dreamcatcher 守护被狼刀目标(1)，该目标免疫死亡', () => {
      ctx = createHostGame(TEMPLATE_NAME, createRoleAssignment());

      const result = executeFullNight(ctx, {
        dreamcatcher: 1, // 守护 villager(1)
        wolf: 1, // 狼刀 villager(1)
        witch: { save: null, poison: null },
        seer: 4,
      });

      expect(result.completed).toBe(true);

      // 核心断言：action 记录
      const state = ctx.getGameState();
      const dreamAction = state.actions?.find((a) => a.schemaId === 'dreamcatcherDream');
      expect(dreamAction).toBeDefined();
      expect(dreamAction!.targetSeat).toBe(1);

      // 被守护者免疫狼刀，无人死亡
      expect(result.deaths).toEqual([]);
    });
  });

  describe('Dreamcatcher 空选', () => {
    it('dreamcatcher 不守护时，action 中 targetSeat 为 undefined', () => {
      ctx = createHostGame(TEMPLATE_NAME, createRoleAssignment());

      const result = executeFullNight(ctx, {
        dreamcatcher: null, // 不守护
        wolf: 0,
        witch: { save: null, poison: null },
        seer: 4,
      });

      expect(result.completed).toBe(true);

      // 核心断言：空选时 action 的 targetSeat 为 undefined 或无该 action
      const state = ctx.getGameState();
      const dreamAction = state.actions?.find((a) => a.schemaId === 'dreamcatcherDream');
      expect(dreamAction?.targetSeat).toBeUndefined();

      expect(result.deaths).toEqual([0]);
    });
  });

  describe('Dreamcatcher 链接死亡', () => {
    it('dreamcatcher 被毒杀，被守护者也死亡', () => {
      ctx = createHostGame(TEMPLATE_NAME, createRoleAssignment());

      const result = executeFullNight(ctx, {
        dreamcatcher: 0, // 守护 villager(0)
        wolf: null, // 空刀
        witch: { save: null, poison: 11 }, // 毒 dreamcatcher
        seer: 4,
      });

      expect(result.completed).toBe(true);

      // 核心断言：dreamcatcher(11) 和被守护者(0) 都死亡
      expect([...result.deaths].sort((a, b) => a - b)).toEqual([0, 11]);
    });
  });
});
