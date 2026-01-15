/**
 * 标准板12人 - Host Runtime Integration Test
 *
 * Template: villager x4, wolf x4, seer, witch, hunter, idiot
 * 特点: 基础配置，无特殊技能狼，无守卫
 */

import { createHostGame, cleanupHostGame, HostGameContext, mockSendPrivate } from './hostGameFactory';
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

    it('狼人刀预言家：预言家死亡', async () => {
      ctx = await createHostGame(TEMPLATE_NAME, createRoleAssignment());

      const result = await ctx.runNight({
        wolf: 8,          // 狼人杀预言家
        witch: null,
        seer: 4,          // 预言家查狼
        hunter: null,
      });

      expect(result.completed).toBe(true);
      expect(result.deaths).toEqual([8]);
      expect(result.info).toContain('9号');
    });

    it('狼人刀女巫，无人救 → 女巫死亡', async () => {
      ctx = await createHostGame(TEMPLATE_NAME, createRoleAssignment());

      // 女巫被刀，没有人救
      const result = await ctx.runNight({
        wolf: 9,          // 狼人杀女巫
        witch: null,      // 女巫不行动（第一夜不可自救）
        seer: 4,
        hunter: null,
      });

      expect(result.completed).toBe(true);
      expect(result.deaths).toContain(9);
    });

    it('狼人刀猎人：猎人死亡（可开枪）', async () => {
      ctx = await createHostGame(TEMPLATE_NAME, createRoleAssignment());

      const result = await ctx.runNight({
        wolf: 10,         // 狼人杀猎人
        witch: null,
        seer: 4,
        hunter: null,
      });

      expect(result.completed).toBe(true);
      expect(result.deaths).toEqual([10]);
      // 猎人被狼刀可以开枪（白天结算）
    });

    it('女巫毒猎人：猎人死亡（不可开枪）', async () => {
      ctx = await createHostGame(TEMPLATE_NAME, createRoleAssignment());

      const result = await ctx.runNight({
        wolf: 0,
        witchPoison: 10,  // 女巫毒猎人
        seer: 4,
        hunter: null,
      });

      expect(result.completed).toBe(true);
      expect(result.deaths).toContain(0);   // 狼刀目标
      expect(result.deaths).toContain(10);  // 猎人被毒
      // 猎人被毒不可开枪
    });

    it('狼人刀 + 女巫毒同一人：目标死亡', async () => {
      ctx = await createHostGame(TEMPLATE_NAME, createRoleAssignment());

      const result = await ctx.runNight({
        wolf: 0,
        witchPoison: 0,   // 女巫也毒0号
        seer: 4,
        hunter: null,
      });

      expect(result.completed).toBe(true);
      expect(result.deaths).toEqual([0]);
    });
  });

  describe('Private Reveal 存在性锁', () => {
    it('预言家查验触发 SEER_REVEAL 私信', async () => {
      ctx = await createHostGame(TEMPLATE_NAME, createRoleAssignment());

      await ctx.runNight({
        wolf: 0,
        witch: null,
        seer: 4,          // 预言家查 4 号（狼人）
        hunter: null,
      });

      // 验证 SEER_REVEAL 私信被发送
      const seerRevealCalls = mockSendPrivate.mock.calls.filter(
        (call: unknown[]) => 
          (call[0] as { type: string }).type === 'PRIVATE_EFFECT' &&
          ((call[0] as { payload?: { kind: string } }).payload?.kind === 'SEER_REVEAL')
      );
      expect(seerRevealCalls.length).toBe(1);
      expect(seerRevealCalls[0][0]).toMatchObject({
        type: 'PRIVATE_EFFECT',
        payload: {
          kind: 'SEER_REVEAL',
          targetSeat: 4,
          result: '狼人',  // 查验到狼人
        },
      });
    });

    it('预言家查验好人：返回好人结果', async () => {
      ctx = await createHostGame(TEMPLATE_NAME, createRoleAssignment());

      await ctx.runNight({
        wolf: 0,
        witch: null,
        seer: 1,          // 预言家查 1 号（村民）
        hunter: null,
      });

      // 验证 SEER_REVEAL 私信被发送
      const seerRevealCalls = mockSendPrivate.mock.calls.filter(
        (call: unknown[]) => 
          (call[0] as { type: string }).type === 'PRIVATE_EFFECT' &&
          ((call[0] as { payload?: { kind: string } }).payload?.kind === 'SEER_REVEAL')
      );
      expect(seerRevealCalls.length).toBe(1);
      expect(seerRevealCalls[0][0]).toMatchObject({
        type: 'PRIVATE_EFFECT',
        payload: {
          kind: 'SEER_REVEAL',
          targetSeat: 1,
          result: '好人',  // 查验到好人
        },
      });
    });
  });
});
