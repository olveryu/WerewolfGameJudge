/**
 * 标准板12人 - Host Runtime Integration Test
 *
 * Template: villager x4, wolf x4, seer, witch, hunter, idiot
 * 特点: 基础配置，无特殊技能狼，无守卫
 */

import { createHostGame, cleanupHostGame, HostGameContext } from './hostGameFactory';
import { RoleName } from '../../../models/roles';

const TEMPLATE_NAME = '标准板12人';

/**
 * 固定角色分配（便于测试）
 * 0-3: 村民
 * 4-7: 狼人
 * 8: 预言家, 9: 女巫, 10: 猎人, 11: 白痴
 */
function createRoleAssignment(): Map<number, RoleName> {
  const map = new Map<number, RoleName>();
  map.set(0, 'villager');
  map.set(1, 'villager');
  map.set(2, 'villager');
  map.set(3, 'villager');
  map.set(4, 'wolf');
  map.set(5, 'wolf');
  map.set(6, 'wolf');
  map.set(7, 'wolf');
  map.set(8, 'seer');
  map.set(9, 'witch');
  map.set(10, 'hunter');
  map.set(11, 'idiot');
  return map;
}

describe('标准板12人 - Host Runtime Integration', () => {
  let ctx: HostGameContext;

  afterEach(() => {
    cleanupHostGame();
  });

  describe('Happy Path: 标准夜晚', () => {
    it('应该完整走完夜晚，狼人杀村民', async () => {
      ctx = await createHostGame(TEMPLATE_NAME, createRoleAssignment());

      const result = await ctx.runNight({
        wolf: 0,
        witch: null,
        seer: 4,
        hunter: null,
      });

      expect(result.completed).toBe(true);
      expect(result.deaths).toEqual([0]);
      expect(result.info).toContain('1号');
    });

    it('女巫救人：狼刀目标不死', async () => {
      ctx = await createHostGame(TEMPLATE_NAME, createRoleAssignment());

      const result = await ctx.runNight({
        wolf: 0,
        witch: 0, // 救座位0
        seer: 4,
        hunter: null,
      });

      expect(result.completed).toBe(true);
      expect(result.deaths).toEqual([]);
      expect(result.info).toContain('平安夜');
    });

    it('女巫毒人：毒杀目标死亡', async () => {
      ctx = await createHostGame(TEMPLATE_NAME, createRoleAssignment());

      const result = await ctx.runNight({
        wolf: 0,
        witchPoison: 1, // 毒座位1
        seer: 4,
        hunter: null,
      });

      expect(result.completed).toBe(true);
      expect(result.deaths).toContain(0); // 狼刀
      expect(result.deaths).toContain(1); // 女巫毒
      expect(result.info).toContain('1号');
      expect(result.info).toContain('2号');
    });
  });

  describe('边界情况', () => {
    it('狼人空刀：无人死亡', async () => {
      ctx = await createHostGame(TEMPLATE_NAME, createRoleAssignment());

      const result = await ctx.runNight({
        wolf: null,
        witch: null,
        seer: 4,
        hunter: null,
      });

      expect(result.completed).toBe(true);
      expect(result.deaths).toEqual([]);
      expect(result.info).toContain('平安夜');
    });
  });
});
