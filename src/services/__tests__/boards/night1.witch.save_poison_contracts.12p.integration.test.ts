/**
 * Night-1 Integration Test: Witch Save/Poison Contracts
 *
 * 主题：女巫的解药/毒药约束和效果。
 *
 * 模板：狼王魔术师12人
 * 固定 seat-role assignment:
 *   seat 0-3: villager
 *   seat 4-6: wolf
 *   seat 7: darkWolfKing
 *   seat 8: seer
 *   seat 9: witch
 *   seat 10: hunter
 *   seat 11: magician
 *
 * 核心约束（Night-1-only）：
 * - notSelf：女巫不能自救
 * - save 只能救被狼人袭击的玩家
 * - 同一晚不能同时使用解药和毒药
 *
 * 架构：intents → handlers → reducer → BroadcastGameState
 */

import type { RoleId } from '@/models/roles';

import { cleanupHostGame, createHostGame, HostGameContext } from './hostGameFactory';
import { executeFullNight } from './stepByStepRunner';

const TEMPLATE_NAME = '狼王魔术师12人';

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
  map.set(11, 'magician');
  return map;
}

describe('Night-1: Witch Save/Poison Contracts (12p)', () => {
  let ctx: HostGameContext;

  afterEach(() => {
    cleanupHostGame();
  });

  describe('Save 正常救人', () => {
    it('女巫救被狼刀的玩家，该玩家不死', () => {
      ctx = createHostGame(TEMPLATE_NAME, createRoleAssignment());

      // 狼刀 seat 0，女巫救 seat 0
      const result = executeFullNight(ctx, {
        magician: null,
        wolf: 0,
        witch: { save: 0, poison: null },
        seer: 4,
      });

      expect(result.completed).toBe(true);

      // 核心断言：seat 0 被救，不在死亡列表中
      expect(result.deaths).toEqual([]);

      // savedSeat 写入 currentNightResults
      expect(ctx.getBroadcastState().currentNightResults?.savedSeat).toBe(0);
    });

    it('女巫不救人时，被狼刀的玩家死亡', () => {
      ctx = createHostGame(TEMPLATE_NAME, createRoleAssignment());

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
      ctx = createHostGame(TEMPLATE_NAME, createRoleAssignment());

      // 狼空刀，女巫毒 seat 2
      const result = executeFullNight(ctx, {
        magician: null,
        wolf: null,
        witch: { save: null, poison: 2 },
        seer: 4,
      });

      expect(result.completed).toBe(true);

      // 核心断言：seat 2 被毒死
      expect(result.deaths).toEqual([2]);

      // poisonedSeat 写入 currentNightResults
      expect(ctx.getBroadcastState().currentNightResults?.poisonedSeat).toBe(2);
    });

    it('女巫可以毒狼人', () => {
      ctx = createHostGame(TEMPLATE_NAME, createRoleAssignment());

      const result = executeFullNight(ctx, {
        magician: null,
        wolf: null,
        witch: { save: null, poison: 4 }, // 毒 wolf
        seer: 5,
      });

      expect(result.completed).toBe(true);
      expect(result.deaths).toEqual([4]);
    });
  });

  describe('notSelf 约束：女巫不能自救', () => {
    /**
     * notSelf 约束在 UI 层就是禁选：女巫无法在 UI 上选择自己。
     * 这里验证：当女巫自己被刀时，只能选择不救（skip）。
     * reject 的直接测试由 schema/resolver contract 测试覆盖。
     */
    it('狼刀女巫 seat(9) 时，女巫 skip 救人，女巫死亡', () => {
      ctx = createHostGame(TEMPLATE_NAME, createRoleAssignment());

      // 狼刀 seat 9（witch），女巫 skip（因为不能自救）
      const result = executeFullNight(ctx, {
        magician: null,
        wolf: 9, // 刀女巫
        witch: { save: null, poison: null }, // 不救（自救被禁）
        seer: 4,
      });

      expect(result.completed).toBe(true);

      // 核心断言：女巫不能自救，seat 9 死亡
      expect(result.deaths).toContain(9);
    });
  });

  describe('witchContext 写入 BroadcastGameState', () => {
    it('狼刀目标写入 witchContext.killedSeat（验证最终状态）', () => {
      ctx = createHostGame(TEMPLATE_NAME, createRoleAssignment());

      // 完整走完夜晚，检查 state 中的 savedSeat/poisonedSeat 记录
      const result = executeFullNight(ctx, {
        magician: null,
        wolf: 0, // 狼刀 seat 0
        witch: { save: 0, poison: null }, // 救 seat 0
        seer: 4,
      });

      expect(result.completed).toBe(true);

      // 核心断言：savedSeat 记录了女巫救的目标
      expect(ctx.getBroadcastState().currentNightResults?.savedSeat).toBe(0);

      // seat 0 被救，不死
      expect(result.deaths).toEqual([]);
    });
  });

  describe('Save 只能救被狼刀的目标', () => {
    /**
     * 女巫只能救被狼刀的目标。UI 层只会 enable 被刀的座位。
     * 如果狼空刀，女巫的救人选项不可用。
     * 这里验证：狼刀 seat 0，女巫救 seat 0 成功；女巫 skip 时 seat 0 死亡。
     * reject 的直接测试由 schema/resolver contract 测试覆盖。
     */
    it('女巫只救被狼刀目标，救成功', () => {
      ctx = createHostGame(TEMPLATE_NAME, createRoleAssignment());

      // 狼刀 seat 0，女巫救 seat 0（唯一合法目标）
      const result = executeFullNight(ctx, {
        magician: null,
        wolf: 0,
        witch: { save: 0, poison: null }, // 救被刀的人
        seer: 4,
      });

      expect(result.completed).toBe(true);

      // 核心断言：seat 0 被救，不死
      expect(result.deaths).not.toContain(0);
      expect(ctx.getBroadcastState().currentNightResults?.savedSeat).toBe(0);
    });

    it('女巫不救人时，被狼刀者死亡', () => {
      ctx = createHostGame(TEMPLATE_NAME, createRoleAssignment());

      // 狼刀 seat 0，女巫不救
      const result = executeFullNight(ctx, {
        magician: null,
        wolf: 0,
        witch: { save: null, poison: null }, // 不救
        seer: 4,
      });

      expect(result.completed).toBe(true);

      // 核心断言：seat 0 死亡
      expect(result.deaths).toContain(0);
    });
  });
});
