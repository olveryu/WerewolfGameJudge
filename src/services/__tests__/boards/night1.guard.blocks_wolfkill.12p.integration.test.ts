/**
 * Night-1 Integration Test: Guard Blocks Wolf Kill
 *
 * 主题：守卫守护与狼刀的互动。
 *
 * 模板：狼王守卫12人
 * 固定 seat-role assignment:
 *   seat 0-3: villager
 *   seat 4-6: wolf
 *   seat 7: darkWolfKing
 *   seat 8: seer
 *   seat 9: witch
 *   seat 10: hunter
 *   seat 11: guard
 *
 * 核心规则：
 * - 守卫守护的目标免疫狼刀
 * - witchContext.killedSeat 在守卫挡刀时的取值需要固化
 *
 * 架构：intents → handlers → reducer → BroadcastGameState
 */

import { createHostGame, cleanupHostGame, HostGameContext } from './hostGameFactory';
import { executeFullNight } from './stepByStepRunner';
import type { RoleId } from '@/models/roles';

const TEMPLATE_NAME = '狼王守卫12人';

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
  map.set(11, 'guard');
  return map;
}

describe('Night-1: Guard Blocks Wolf Kill (12p)', () => {
  let ctx: HostGameContext;

  afterEach(() => {
    cleanupHostGame();
  });

  describe('守卫守护成功挡刀', () => {
    it('守卫守护狼刀目标，该目标不死', () => {
      ctx = createHostGame(TEMPLATE_NAME, createRoleAssignment());

      // 守卫守 seat 0，狼刀 seat 0
      const result = executeFullNight(ctx, {
        guard: 0, // 守 seat 0
        wolf: 0, // 刀 seat 0
        witch: { save: null, poison: null },
        seer: 4,
      });

      expect(result.completed).toBe(true);

      // 核心断言：seat 0 被守卫保护，不在死亡列表中
      expect(result.deaths).toEqual([]);

      // guardedSeat 写入 currentNightResults
      expect(ctx.getBroadcastState().currentNightResults?.guardedSeat).toBe(0);
    });

    it('守卫守护非狼刀目标，狼刀目标死亡', () => {
      ctx = createHostGame(TEMPLATE_NAME, createRoleAssignment());

      // 守卫守 seat 1，狼刀 seat 0
      const result = executeFullNight(ctx, {
        guard: 1, // 守 seat 1
        wolf: 0, // 刀 seat 0
        witch: { save: null, poison: null },
        seer: 4,
      });

      expect(result.completed).toBe(true);

      // 核心断言：seat 0 不被保护，死亡
      expect(result.deaths).toEqual([0]);
    });
  });

  describe('守卫不守护', () => {
    it('守卫空守时，狼刀正常生效', () => {
      ctx = createHostGame(TEMPLATE_NAME, createRoleAssignment());

      const result = executeFullNight(ctx, {
        guard: null, // 不守护
        wolf: 2,
        witch: { save: null, poison: null },
        seer: 4,
      });

      expect(result.completed).toBe(true);
      expect(result.deaths).toEqual([2]);
    });
  });

  /**
   * witchContext.killedSeat 的 contract 由 witchContext.test.ts 单元测试覆盖。
   * Integration 测试只验证最终死亡结果，不检查中间状态。
   *
   * 守卫挡刀时，witchContext.killedSeat 仍为原目标（女巫能看到谁被刀）。
   * 这个规则的验证见：src/services/engine/handlers/__tests__/witchContext.test.ts
   */

  describe('守卫 + 女巫同守同救', () => {
    it('守卫守护 + 女巫救同一目标：按"同守同救必死"规则，目标死亡', () => {
      ctx = createHostGame(TEMPLATE_NAME, createRoleAssignment());

      // 守卫守 seat 0，女巫救 seat 0，狼刀 seat 0
      const result = executeFullNight(ctx, {
        guard: 0,
        wolf: 0,
        witch: { save: 0, poison: null },
        seer: 4,
      });

      expect(result.completed).toBe(true);

      // 核心断言：同守同救必死
      expect(result.deaths).toEqual([0]);
    });

    it('守卫守护 A + 女巫救 B：只有女巫救的 B 生效（如果 B 被刀）', () => {
      ctx = createHostGame(TEMPLATE_NAME, createRoleAssignment());

      // 守卫守 seat 1，狼刀 seat 0，女巫救 seat 0
      const result = executeFullNight(ctx, {
        guard: 1, // 守 seat 1（不是被刀的）
        wolf: 0, // 刀 seat 0
        witch: { save: 0, poison: null }, // 救 seat 0
        seer: 4,
      });

      expect(result.completed).toBe(true);

      // 核心断言：只有女巫救，seat 0 不死
      expect(result.deaths).toEqual([]);
    });
  });
});
