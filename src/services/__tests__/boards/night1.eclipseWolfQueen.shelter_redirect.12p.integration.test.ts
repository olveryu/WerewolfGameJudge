/**
 * Night-1 Integration Test: EclipseWolfQueen Shelter Redirect
 *
 * 主题：蚀时狼妃放逐机制 — 神职技能目标重定向。
 *
 * 模板：永序之轮
 * 固定 seat-role assignment:
 *   seat 0-3: villager
 *   seat 4-6: wolf
 *   seat 7: eclipseWolfQueen
 *   seat 8: seer
 *   seat 9: witch
 *   seat 10: guard
 *   seat 11: sequencePrince
 *
 * 核心规则：
 * - 蚀时狼妃选择一名玩家放逐（shelteredSeat）
 * - 神职对被放逐者释放技能 → 效果重定向到施法者自身
 * - 狼人阵营对被放逐者释放技能 → 不受影响
 *
 * 架构：intents → handlers → reducer → GameState
 */

import type { RoleId } from '@werewolf/game-engine/models/roles';

import { cleanupGame, createGame, type GameContext } from './gameFactory';
import { executeFullNight } from './stepByStepRunner';

const TEMPLATE_NAME = '永序之轮';

function createRoleAssignment(): Map<number, RoleId> {
  const map = new Map<number, RoleId>();
  map.set(0, 'villager');
  map.set(1, 'villager');
  map.set(2, 'villager');
  map.set(3, 'villager');
  map.set(4, 'wolf');
  map.set(5, 'wolf');
  map.set(6, 'wolf');
  map.set(7, 'eclipseWolfQueen');
  map.set(8, 'seer');
  map.set(9, 'witch');
  map.set(10, 'guard');
  map.set(11, 'sequencePrince');
  return map;
}

describe('Night-1: EclipseWolfQueen Shelter Redirect (12p)', () => {
  let ctx: GameContext;

  afterEach(() => {
    cleanupGame();
  });

  describe('放逐对预言家查验的重定向', () => {
    it('预言家查验被放逐者 → 查验结果为预言家自身阵营（好人）', () => {
      ctx = createGame(TEMPLATE_NAME, createRoleAssignment());

      // eclipseWolfQueen 放逐 seat 4 (wolf)
      // seer 查验 seat 4 → 重定向为查验自身(seat 8) → 结果：好人
      const result = executeFullNight(ctx, {
        eclipseWolfQueen: 4,
        guard: null,
        wolf: 0,
        witch: { save: null, poison: null },
        seer: 4, // 查验被放逐的狼人 → 重定向查自己
      });

      expect(result.completed).toBe(true);

      // 核心断言：seer 的 action targetSeat 被重定向为 seer 自身座位
      const state = ctx.getGameState();
      const shelterAction = state.actions?.find((a) => a.schemaId === 'eclipseWolfQueenShelter');
      expect(shelterAction).toBeDefined();
      expect(shelterAction!.targetSeat).toBe(4);

      const seerAction = state.actions?.find((a) => a.schemaId === 'seerCheck');
      expect(seerAction).toBeDefined();
      expect(seerAction!.targetSeat).toBe(8); // 重定向到 seer 自身
    });

    it('预言家查验未被放逐者 → 正常查验', () => {
      ctx = createGame(TEMPLATE_NAME, createRoleAssignment());

      // eclipseWolfQueen 放逐 seat 0 (villager)
      // seer 查验 seat 4 (wolf) → 不受影响
      const result = executeFullNight(ctx, {
        eclipseWolfQueen: 0,
        guard: null,
        wolf: 1,
        witch: { save: null, poison: null },
        seer: 4, // 查验未被放逐的狼人
      });

      expect(result.completed).toBe(true);

      const state = ctx.getGameState();
      const seerAction = state.actions?.find((a) => a.schemaId === 'seerCheck');
      expect(seerAction).toBeDefined();
      expect(seerAction!.targetSeat).toBe(4); // 未重定向
    });
  });

  describe('放逐对守卫的重定向', () => {
    it('守卫守护被放逐者 → guardedSeat 为守卫自身', () => {
      ctx = createGame(TEMPLATE_NAME, createRoleAssignment());

      // eclipseWolfQueen 放逐 seat 0
      // guard 守护 seat 0 → 重定向守护自身(seat 10)
      const result = executeFullNight(ctx, {
        eclipseWolfQueen: 0,
        guard: 0, // 守护被放逐者 → 重定向
        wolf: 0, // 袭击 seat 0
        witch: { save: null, poison: null },
        seer: 4,
      });

      expect(result.completed).toBe(true);

      // guard action 的 targetSeat 被重定向为 guard 自身
      const state = ctx.getGameState();
      const guardAction = state.actions?.find((a) => a.schemaId === 'guardProtect');
      expect(guardAction).toBeDefined();
      expect(guardAction!.targetSeat).toBe(10); // 重定向到 guard 自身

      // seat 0 被狼人袭击且没有有效守护 → 死亡
      expect(result.deaths).toContain(0);
    });
  });

  describe('放逐对女巫毒药的重定向', () => {
    it('女巫毒被放逐者 → poisonedSeat 为女巫自身', () => {
      ctx = createGame(TEMPLATE_NAME, createRoleAssignment());

      // eclipseWolfQueen 放逐 seat 0
      // witch 毒 seat 0 → 重定向毒自身(seat 9)
      const result = executeFullNight(ctx, {
        eclipseWolfQueen: 0,
        guard: null,
        wolf: 1, // 袭击 seat 1
        witch: { save: null, poison: 0 }, // 毒被放逐者 → 重定向
        seer: 4,
      });

      expect(result.completed).toBe(true);

      // 女巫毒死自己 + 狼人袭击 seat 1
      expect(result.deaths).toContain(9); // 女巫自己
      expect(result.deaths).toContain(1); // 被袭击者
      expect(result.deaths).not.toContain(0); // 被放逐者安全
    });
  });

  describe('蚀时狼妃不蚀时', () => {
    it('eclipseWolfQueen 空选，神职技能正常执行', () => {
      ctx = createGame(TEMPLATE_NAME, createRoleAssignment());

      const result = executeFullNight(ctx, {
        eclipseWolfQueen: null, // 不放逐
        guard: 0,
        wolf: 0,
        witch: { save: null, poison: null },
        seer: 4,
      });

      expect(result.completed).toBe(true);

      // guard 正常守护 seat 0
      const state = ctx.getGameState();
      const guardAction = state.actions?.find((a) => a.schemaId === 'guardProtect');
      expect(guardAction!.targetSeat).toBe(0); // 未重定向

      // seat 0 被守护 → 不死
      expect(result.deaths).not.toContain(0);
    });
  });

  describe('狼人阵营不受放逐影响', () => {
    it('狼人袭击被放逐者 → 正常袭击不重定向', () => {
      ctx = createGame(TEMPLATE_NAME, createRoleAssignment());

      // eclipseWolfQueen 放逐 seat 0
      // wolf 袭击 seat 0 → 狼人是 Wolf team，不重定向
      const result = executeFullNight(ctx, {
        eclipseWolfQueen: 0,
        guard: null,
        wolf: 0, // 袭击被放逐者
        witch: { save: null, poison: null },
        seer: 4,
      });

      expect(result.completed).toBe(true);
      // seat 0 正常死亡（狼人不受放逐重定向影响）
      expect(result.deaths).toContain(0);
    });
  });
});
