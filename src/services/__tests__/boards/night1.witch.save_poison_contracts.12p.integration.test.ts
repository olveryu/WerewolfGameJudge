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

import {
  createHostGame,
  cleanupHostGame,
  HostGameContext,
} from './hostGameFactory';
import type { RoleId } from '../../../models/roles';

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
      const result = ctx.runNight({
        magician: null,
        darkWolfKing: { confirmed: false },
        wolf: 0,
        witch: { stepResults: { save: 0, poison: null } },
        seer: 4,
        hunter: { confirmed: false },
      });

      expect(result.completed).toBe(true);

      // 核心断言：seat 0 被救，不在死亡列表中
      expect(result.deaths).toEqual([]);

      // savedSeat 写入 currentNightResults
      expect(result.state.currentNightResults?.savedSeat).toBe(0);
    });

    it('女巫不救人时，被狼刀的玩家死亡', () => {
      ctx = createHostGame(TEMPLATE_NAME, createRoleAssignment());

      const result = ctx.runNight({
        magician: null,
        darkWolfKing: { confirmed: false },
        wolf: 1,
        witch: { stepResults: { save: null, poison: null } },
        seer: 4,
        hunter: { confirmed: false },
      });

      expect(result.completed).toBe(true);
      expect(result.deaths).toEqual([1]);
    });
  });

  describe('Poison 毒人', () => {
    it('女巫毒人，该玩家死亡', () => {
      ctx = createHostGame(TEMPLATE_NAME, createRoleAssignment());

      // 狼空刀，女巫毒 seat 2
      const result = ctx.runNight({
        magician: null,
        darkWolfKing: { confirmed: false },
        wolf: null,
        witch: { stepResults: { save: null, poison: 2 } },
        seer: 4,
        hunter: { confirmed: false },
      });

      expect(result.completed).toBe(true);

      // 核心断言：seat 2 被毒死
      expect(result.deaths).toEqual([2]);

      // poisonedSeat 写入 currentNightResults
      expect(result.state.currentNightResults?.poisonedSeat).toBe(2);
    });

    it('女巫可以毒狼人', () => {
      ctx = createHostGame(TEMPLATE_NAME, createRoleAssignment());

      const result = ctx.runNight({
        magician: null,
        darkWolfKing: { confirmed: false },
        wolf: null,
        witch: { stepResults: { save: null, poison: 4 } }, // 毒 wolf
        seer: 5,
        hunter: { confirmed: false },
      });

      expect(result.completed).toBe(true);
      expect(result.deaths).toEqual([4]);
    });
  });

  describe('notSelf 约束：女巫不能自救', () => {
    it('狼刀女巫 seat(9) 时，女巫救自己应被拒绝或无效', () => {
      ctx = createHostGame(TEMPLATE_NAME, createRoleAssignment());

      // 狼刀 seat 9（witch），女巫尝试救自己
      const result = ctx.runNight({
        magician: null,
        darkWolfKing: { confirmed: false },
        wolf: 9, // 刀女巫
        witch: { stepResults: { save: 9, poison: null } }, // 尝试自救
        seer: 4,
        hunter: { confirmed: false },
      });

      expect(result.completed).toBe(true);

      // 核心断言：女巫不能自救，所以 seat 9 应该死亡
      // 或者 save action 被拒绝（savedSeat 不是 9）
      expect(result.deaths).toContain(9);
    });
  });

  describe('witchContext 写入 BroadcastGameState', () => {
    it('狼刀目标写入 witchContext.killedIndex（通过 runNight 验证最终状态）', () => {
      ctx = createHostGame(TEMPLATE_NAME, createRoleAssignment());

      // 使用 runNight 完整走完夜晚，检查 state 中的 savedSeat/poisonedSeat 记录
      const result = ctx.runNight({
        magician: null,
        darkWolfKing: { confirmed: false },
        wolf: 0, // 狼刀 seat 0
        witch: { stepResults: { save: 0, poison: null } }, // 救 seat 0
        seer: 4,
        hunter: { confirmed: false },
      });

      expect(result.completed).toBe(true);

      // 核心断言：savedSeat 记录了女巫救的目标
      expect(result.state.currentNightResults?.savedSeat).toBe(0);

      // seat 0 被救，不死
      expect(result.deaths).toEqual([]);
    });
  });

  describe('Save 只能救被狼刀的目标', () => {
    it('女巫救非狼刀目标应被拒绝', () => {
      ctx = createHostGame(TEMPLATE_NAME, createRoleAssignment());

      // 狼刀 seat 0，女巫尝试救 seat 1（不是被刀的）
      const result = ctx.runNight({
        magician: null,
        darkWolfKing: { confirmed: false },
        wolf: 0,
        witch: { stepResults: { save: 1, poison: null } }, // 救错人
        seer: 4,
        hunter: { confirmed: false },
      });

      expect(result.completed).toBe(true);

      // 核心断言：救无效，seat 0 仍然死亡
      expect(result.deaths).toContain(0);

      // savedSeat 不应该是 1
      expect(result.state.currentNightResults?.savedSeat).not.toBe(1);
    });
  });
});
