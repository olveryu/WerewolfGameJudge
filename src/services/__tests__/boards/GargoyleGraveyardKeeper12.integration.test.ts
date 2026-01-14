/**
 * 石像鬼守墓人12人 - Host Runtime Integration Test
 *
 * Template: villager x4, wolf x3, gargoyle, seer, witch, hunter, graveyardKeeper
 * 特点:
 * - gargoyle 是非参会狼（canSeeWolves=false, participatesInWolfVote=false）
 * - gargoyle 有独立查验能力（Night-1 有动作）
 * - graveyardKeeper 在 Night-1 无动作（需要上一个白天有人被放逐）
 */

import { createHostGame, cleanupHostGame, HostGameContext, mockSendPrivate } from './hostGameFactory';
import { RoleName } from '../../../models/roles';

const TEMPLATE_NAME = '石像鬼守墓人12人';

/**
 * 固定角色分配（便于测试）
 * 0-3: 村民
 * 4-6: 狼人
 * 7: 石像鬼
 * 8: 预言家, 9: 女巫, 10: 猎人, 11: 守墓人
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
  map.set(7, 'gargoyle');
  map.set(8, 'seer');
  map.set(9, 'witch');
  map.set(10, 'hunter');
  map.set(11, 'graveyardKeeper');
  return map;
}

describe(`${TEMPLATE_NAME} - Host Runtime Integration`, () => {
  let ctx: HostGameContext;

  afterEach(() => {
    cleanupHostGame();
  });

  describe('Happy Path: 标准夜晚', () => {
    it('应该完整走完夜晚，狼人杀村民', async () => {
      ctx = await createHostGame(TEMPLATE_NAME, createRoleAssignment());

      const result = await ctx.runNight({
        gargoyle: 8,    // 石像鬼查验预言家
        wolf: 0,        // 狼人杀 0 号村民
        witch: null,    // 女巫不救不毒
        seer: 4,        // 预言家查 4 号狼人
        hunter: null,   // 猎人确认状态
      });

      expect(result.completed).toBe(true);
      expect(result.deaths).toEqual([0]);
      expect(result.info).toContain('1号');
    });

    it('女巫救人：狼刀目标不死', async () => {
      ctx = await createHostGame(TEMPLATE_NAME, createRoleAssignment());

      const result = await ctx.runNight({
        gargoyle: 0,    // 石像鬼查验村民
        wolf: 0,        // 狼人杀 0 号
        witch: 0,       // 女巫救 0 号（save，非 poison）
        seer: 7,        // 预言家查石像鬼
        hunter: null,
      });

      expect(result.completed).toBe(true);
      expect(result.deaths).toEqual([]);
      expect(result.info).toContain('平安夜');
    });
  });

  describe('Gargoyle 特性', () => {
    it('石像鬼是非参会狼：不参与狼人投票', async () => {
      ctx = await createHostGame(TEMPLATE_NAME, createRoleAssignment());

      // 验证 gargoyle 的 wolfMeeting 配置（通过 ROLE_SPECS 检查）
      const { ROLE_SPECS } = require('../../../models/roles/spec');
      expect(ROLE_SPECS.gargoyle.wolfMeeting?.canSeeWolves).toBe(false);
      expect(ROLE_SPECS.gargoyle.wolfMeeting?.participatesInWolfVote).toBe(false);
    });

    it('石像鬼查验在 Night-1 有行动', async () => {
      ctx = await createHostGame(TEMPLATE_NAME, createRoleAssignment());
      
      // 验证 gargoyle 在 NIGHT_STEPS 中存在
      const { NIGHT_STEPS } = require('../../../models/roles/spec');
      const gargoyleStep = NIGHT_STEPS.find((s: { roleId: string }) => s.roleId === 'gargoyle');
      expect(gargoyleStep).toBeDefined();
      expect(gargoyleStep?.id).toBe('gargoyleCheck');
    });

    it('石像鬼查验获得目标的具体身份（私信结果）', async () => {
      mockSendPrivate.mockClear();
      ctx = await createHostGame(TEMPLATE_NAME, createRoleAssignment());

      const result = await ctx.runNight({
        gargoyle: 8,    // 石像鬼查验预言家（seat 8）
        wolf: 0,
        witch: null,
        seer: 4,
        hunter: null,
      });

      expect(result.completed).toBe(true);
      
      // 验证 GARGOYLE_REVEAL 私信被发送
      const gargoyleRevealCalls = mockSendPrivate.mock.calls.filter(
        (call: any[]) => call[0]?.payload?.kind === 'GARGOYLE_REVEAL'
      );
      expect(gargoyleRevealCalls.length).toBe(1);
      
      const revealPayload = gargoyleRevealCalls[0][0].payload;
      expect(revealPayload.targetSeat).toBe(8);
      expect(revealPayload.result).toBe('预言家'); // seat 8 是预言家
    });
  });

  describe('GraveyardKeeper 特性', () => {
    it('守墓人 Night-1 无动作（因为没有上一个白天放逐）', async () => {
      // 验证 graveyardKeeper 在 Night-1 不行动
      const { ROLE_SPECS } = require('../../../models/roles/spec');
      expect(ROLE_SPECS.graveyardKeeper.night1.hasAction).toBe(false);

      // 验证 graveyardKeeper 不在 NIGHT_STEPS 中
      const { NIGHT_STEPS } = require('../../../models/roles/spec');
      const graveyardKeeperStep = NIGHT_STEPS.find(
        (s: { roleId: string }) => s.roleId === 'graveyardKeeper'
      );
      expect(graveyardKeeperStep).toBeUndefined();
    });
  });

  describe('Edge Cases', () => {
    it('狼空刀：平安夜', async () => {
      ctx = await createHostGame(TEMPLATE_NAME, createRoleAssignment());

      const result = await ctx.runNight({
        gargoyle: 0,
        wolf: null,     // 狼人空刀
        witch: null,
        seer: 4,
        hunter: null,
      });

      expect(result.completed).toBe(true);
      expect(result.deaths).toEqual([]);
      expect(result.info).toContain('平安夜');
    });

    it('女巫毒人：毒药目标死亡', async () => {
      ctx = await createHostGame(TEMPLATE_NAME, createRoleAssignment());

      const result = await ctx.runNight({
        gargoyle: 0,
        wolf: null,         // 狼人空刀
        witch: null,
        witchPoison: 1,     // 女巫毒 1 号
        seer: 4,
        hunter: null,
      });

      expect(result.completed).toBe(true);
      expect(result.deaths).toEqual([1]);
      expect(result.info).toContain('2号');
    });

    it('狼人刀石像鬼：石像鬼死亡（自刀）', async () => {
      ctx = await createHostGame(TEMPLATE_NAME, createRoleAssignment());

      const result = await ctx.runNight({
        gargoyle: 8,
        wolf: 7,            // 狼人刀石像鬼（自刀队友）
        witch: null,
        seer: 4,
        hunter: null,
      });

      expect(result.completed).toBe(true);
      expect(result.deaths).toEqual([7]);
    });

    it('狼人刀预言家 + 女巫毒石像鬼：双杀', async () => {
      ctx = await createHostGame(TEMPLATE_NAME, createRoleAssignment());

      const result = await ctx.runNight({
        gargoyle: 0,
        wolf: 8,            // 狼人杀预言家
        witch: null,
        witchPoison: 7,     // 女巫毒石像鬼
        seer: 4,            // 预言家查狼
        hunter: null,
      });

      expect(result.completed).toBe(true);
      expect(result.deaths).toContain(8);   // 预言家死
      expect(result.deaths).toContain(7);   // 石像鬼死
    });

    it('石像鬼查验狼人队友：获得狼人身份', async () => {
      ctx = await createHostGame(TEMPLATE_NAME, createRoleAssignment());

      const result = await ctx.runNight({
        gargoyle: 4,        // 石像鬼查验狼人队友
        wolf: 0,
        witch: null,
        seer: 5,            // 预言家查另一个狼
        hunter: null,
      });

      expect(result.completed).toBe(true);
      expect(result.deaths).toEqual([0]);
    });

    it('狼人刀女巫，无人救 → 女巫死亡', async () => {
      ctx = await createHostGame(TEMPLATE_NAME, createRoleAssignment());

      const result = await ctx.runNight({
        gargoyle: 0,
        wolf: 9,            // 狼人杀女巫
        witch: null,        // 女巫不行动（第一夜不可自救）
        seer: 4,
        hunter: null,
      });

      expect(result.completed).toBe(true);
      expect(result.deaths).toContain(9);
    });

    it('狼人刀猎人：猎人死亡可开枪', async () => {
      ctx = await createHostGame(TEMPLATE_NAME, createRoleAssignment());

      const result = await ctx.runNight({
        gargoyle: 0,
        wolf: 10,           // 狼人杀猎人
        witch: null,
        seer: 4,
        hunter: null,
      });

      expect(result.completed).toBe(true);
      expect(result.deaths).toEqual([10]);
      // 猎人被狼刀可以开枪（白天结算）
    });
  });
});
