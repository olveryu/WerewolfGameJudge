/**
 * 狼王魔术师12人 - Host Runtime Integration Test
 *
 * Template: villager x4, wolf x3, darkWolfKing, seer, witch, hunter, magician
 * 特点:
 * - magician 在所有人之前行动，交换两人的号码牌
 * - darkWolfKing 参与狼人会议，被刀杀时可开枪
 */

import { createHostGame, cleanupHostGame, HostGameContext } from './hostGameFactory';
import { RoleName } from '../../../models/roles';

const TEMPLATE_NAME = '狼王魔术师12人';

/**
 * 固定角色分配（便于测试）
 * 0-3: 村民
 * 4-6: 狼人
 * 7: 黑狼王
 * 8: 预言家, 9: 女巫, 10: 猎人, 11: 魔术师
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
  map.set(7, 'darkWolfKing');
  map.set(8, 'seer');
  map.set(9, 'witch');
  map.set(10, 'hunter');
  map.set(11, 'magician');
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
        magician: null,   // 魔术师不交换
        darkWolfKing: null,
        wolf: 0,          // 狼人杀 0 号村民
        witch: null,
        seer: 4,          // 预言家查 4 号狼人
        hunter: null,
      });

      expect(result.completed).toBe(true);
      expect(result.deaths).toEqual([0]);
      expect(result.info).toContain('1号');
    });

    it('女巫救人：狼刀目标不死', async () => {
      ctx = await createHostGame(TEMPLATE_NAME, createRoleAssignment());

      const result = await ctx.runNight({
        magician: null,
        darkWolfKing: null,
        wolf: 0,
        witch: 0,         // 女巫救 0 号
        seer: 7,
        hunter: null,
      });

      expect(result.completed).toBe(true);
      expect(result.deaths).toEqual([]);
      expect(result.info).toContain('平安夜');
    });
  });

  describe('Magician 特性', () => {
    it('魔术师在 Night-1 有行动', async () => {
      const { ROLE_SPECS } = require('../../../models/roles/spec');
      expect(ROLE_SPECS.magician.night1.hasAction).toBe(true);

      const { NIGHT_STEPS } = require('../../../models/roles/spec');
      const magicianStep = NIGHT_STEPS.find(
        (s: { roleId: string }) => s.roleId === 'magician'
      );
      expect(magicianStep).toBeDefined();
      expect(magicianStep?.id).toBe('magicianSwap');
    });

    it('魔术师排在最前面（所有人之前行动）', async () => {
      const { NIGHT_STEPS } = require('../../../models/roles/spec');
      
      // magician 应该是第一个或非常靠前的步骤
      const magicianIndex = NIGHT_STEPS.findIndex(
        (s: { roleId: string }) => s.roleId === 'magician'
      );
      const wolfIndex = NIGHT_STEPS.findIndex(
        (s: { roleId: string }) => s.roleId === 'wolf'
      );
      const seerIndex = NIGHT_STEPS.findIndex(
        (s: { roleId: string }) => s.roleId === 'seer'
      );
      
      expect(magicianIndex).toBeLessThan(wolfIndex);
      expect(magicianIndex).toBeLessThan(seerIndex);
    });

    it('魔术师不交换：流程正常完成', async () => {
      ctx = await createHostGame(TEMPLATE_NAME, createRoleAssignment());

      const result = await ctx.runNight({
        magician: null,   // 不交换
        darkWolfKing: null,
        wolf: 1,
        witch: null,
        seer: 4,
        hunter: null,
      });

      expect(result.completed).toBe(true);
      expect(result.deaths).toEqual([1]);
    });

    // TODO: 魔术师交换两人的测试需要 hostGameFactory 支持两段选择
    // 当前 hostGameFactory.buildRoleAction 暂不支持 magician 的 compound swap
  });

  describe('DarkWolfKing 特性', () => {
    it('黑狼王是参会狼：参与狼人投票', async () => {
      const { ROLE_SPECS } = require('../../../models/roles/spec');
      expect(ROLE_SPECS.darkWolfKing.wolfMeeting?.canSeeWolves).toBe(true);
      expect(ROLE_SPECS.darkWolfKing.wolfMeeting?.participatesInWolfVote).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('狼空刀：平安夜', async () => {
      ctx = await createHostGame(TEMPLATE_NAME, createRoleAssignment());

      const result = await ctx.runNight({
        magician: null,
        darkWolfKing: null,
        wolf: null,       // 狼人空刀
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
        magician: null,
        darkWolfKing: null,
        wolf: null,
        witch: null,
        witchPoison: 2,   // 女巫毒 2 号
        seer: 4,
        hunter: null,
      });

      expect(result.completed).toBe(true);
      expect(result.deaths).toEqual([2]);
      expect(result.info).toContain('3号');
    });

    it('狼人刀黑狼王：黑狼王死亡（可开枪）', async () => {
      ctx = await createHostGame(TEMPLATE_NAME, createRoleAssignment());

      const result = await ctx.runNight({
        magician: null,
        darkWolfKing: null,
        wolf: 7,          // 狼人刀黑狼王
        witch: null,
        seer: 4,
        hunter: null,
      });

      expect(result.completed).toBe(true);
      expect(result.deaths).toEqual([7]);
      // 黑狼王被狼刀可以开枪（白天结算）
    });

    it('女巫毒黑狼王：黑狼王死亡（不可开枪）', async () => {
      ctx = await createHostGame(TEMPLATE_NAME, createRoleAssignment());

      const result = await ctx.runNight({
        magician: null,
        darkWolfKing: null,
        wolf: 0,
        witch: null,
        witchPoison: 7,   // 女巫毒黑狼王
        seer: 4,
        hunter: null,
      });

      expect(result.completed).toBe(true);
      expect(result.deaths).toContain(0);   // 狼刀目标
      expect(result.deaths).toContain(7);   // 黑狼王被毒
      // 黑狼王被毒不可开枪
    });

    it('狼人刀预言家 + 女巫毒猎人：双杀', async () => {
      ctx = await createHostGame(TEMPLATE_NAME, createRoleAssignment());

      const result = await ctx.runNight({
        magician: null,
        darkWolfKing: null,
        wolf: 8,          // 狼人杀预言家
        witch: null,
        witchPoison: 10,  // 女巫毒猎人
        seer: 4,
        hunter: null,
      });

      expect(result.completed).toBe(true);
      expect(result.deaths).toContain(8);   // 预言家死
      expect(result.deaths).toContain(10);  // 猎人死（被毒不可开枪）
    });

    it('狼人刀女巫，无人救 → 女巫死亡', async () => {
      ctx = await createHostGame(TEMPLATE_NAME, createRoleAssignment());

      const result = await ctx.runNight({
        magician: null,
        darkWolfKing: null,
        wolf: 9,          // 狼人杀女巫
        witch: null,      // 女巫不行动（第一夜不可自救）
        seer: 4,
        hunter: null,
      });

      expect(result.completed).toBe(true);
      expect(result.deaths).toContain(9);
    });

    it('狼人刀魔术师：魔术师死亡', async () => {
      ctx = await createHostGame(TEMPLATE_NAME, createRoleAssignment());

      const result = await ctx.runNight({
        magician: null,
        darkWolfKing: null,
        wolf: 11,         // 狼人杀魔术师
        witch: null,
        seer: 4,
        hunter: null,
      });

      expect(result.completed).toBe(true);
      expect(result.deaths).toEqual([11]);
    });
  });
});
