/**
 * 狼王摄梦人12人 - Host Runtime Integration Test
 *
 * Template: villager x4, wolf x3, darkWolfKing, seer, witch, hunter, dreamcatcher
 * 特点:
 * - darkWolfKing 参与狼人会议，被刀杀时可开枪
 * - dreamcatcher 每晚选择一名梦游者（Night-1 有动作）
 */

import { createHostGame, cleanupHostGame, HostGameContext } from './hostGameFactory';
import { RoleId } from '../../../models/roles';

const TEMPLATE_NAME = '狼王摄梦人12人';

/**
 * 固定角色分配（便于测试）
 * 0-3: 村民
 * 4-6: 狼人
 * 7: 黑狼王
 * 8: 预言家, 9: 女巫, 10: 猎人, 11: 摄梦人
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

describe(`${TEMPLATE_NAME} - Host Runtime Integration`, () => {
  let ctx: HostGameContext;

  afterEach(() => {
    cleanupHostGame();
  });

  describe('Happy Path: 标准夜晚', () => {
    it('应该完整走完夜晚，狼人杀村民', async () => {
      ctx = await createHostGame(TEMPLATE_NAME, createRoleAssignment());

      const result = await ctx.runNight({
        dreamcatcher: 0,  // 摄梦人选择 0 号为梦游者
        darkWolfKing: null, // 黑狼王确认状态
        wolf: 1,          // 狼人杀 1 号村民
        witch: null,      // 女巫不救不毒
        seer: 4,          // 预言家查 4 号狼人
        hunter: null,     // 猎人确认状态
      });

      expect(result.completed).toBe(true);
      expect(result.deaths).toEqual([1]);
      expect(result.info).toContain('2号');
    });

    it('女巫救人：狼刀目标不死', async () => {
      ctx = await createHostGame(TEMPLATE_NAME, createRoleAssignment());

      const result = await ctx.runNight({
        dreamcatcher: 2,
        darkWolfKing: null,
        wolf: 0,
        witch: 0,         // 女巫救 0 号
        seer: 7,          // 预言家查黑狼王
        hunter: null,
      });

      expect(result.completed).toBe(true);
      expect(result.deaths).toEqual([]);
      expect(result.info).toContain('平安夜');
    });
  });

  describe('Dreamcatcher 特性', () => {
    it('摄梦人在 Night-1 有行动', async () => {
      const { ROLE_SPECS } = require('../../../models/roles/spec');
      expect(ROLE_SPECS.dreamcatcher.night1.hasAction).toBe(true);

      const { NIGHT_STEPS } = require('../../../models/roles/spec');
      const dreamcatcherStep = NIGHT_STEPS.find(
        (s: { roleId: string }) => s.roleId === 'dreamcatcher'
      );
      expect(dreamcatcherStep).toBeDefined();
      expect(dreamcatcherStep?.id).toBe('dreamcatcherDream');
    });

    it('摄梦人选择梦游者：梦游者免疫夜间伤害', async () => {
      ctx = await createHostGame(TEMPLATE_NAME, createRoleAssignment());

      // 摄梦人选择 0 号为梦游者，狼人杀 0 号
      const result = await ctx.runNight({
        dreamcatcher: 0,  // 0 号成为梦游者
        darkWolfKing: null,
        wolf: 0,          // 狼人杀梦游者
        witch: null,
        seer: 4,
        hunter: null,
      });

      expect(result.completed).toBe(true);
      // 梦游者免疫夜间伤害，0 号不死
      expect(result.deaths).toEqual([]);
      expect(result.info).toContain('平安夜');
    });
  });

  describe('DarkWolfKing 特性', () => {
    it('黑狼王是参会狼：参与狼人投票', async () => {
      const { ROLE_SPECS } = require('../../../models/roles/spec');
      expect(ROLE_SPECS.darkWolfKing.wolfMeeting?.canSeeWolves).toBe(true);
      expect(ROLE_SPECS.darkWolfKing.wolfMeeting?.participatesInWolfVote).toBe(true);
    });

    it('黑狼王在 Night-1 有确认状态动作', async () => {
      const { ROLE_SPECS } = require('../../../models/roles/spec');
      expect(ROLE_SPECS.darkWolfKing.night1.hasAction).toBe(true);

      const { NIGHT_STEPS } = require('../../../models/roles/spec');
      const darkWolfKingStep = NIGHT_STEPS.find(
        (s: { roleId: string }) => s.roleId === 'darkWolfKing'
      );
      expect(darkWolfKingStep).toBeDefined();
      expect(darkWolfKingStep?.id).toBe('darkWolfKingConfirm');
    });
  });

  describe('Edge Cases', () => {
    it('狼空刀 + 摄梦人选人：平安夜', async () => {
      ctx = await createHostGame(TEMPLATE_NAME, createRoleAssignment());

      const result = await ctx.runNight({
        dreamcatcher: 1,
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

    it('女巫毒梦游者：梦游者免疫毒药（梦游保护包含毒药）', async () => {
      ctx = await createHostGame(TEMPLATE_NAME, createRoleAssignment());

      const result = await ctx.runNight({
        dreamcatcher: 0,  // 0 号成为梦游者
        darkWolfKing: null,
        wolf: null,       // 狼人空刀
        witch: null,
        witchPoison: 0,   // 女巫毒梦游者
        seer: 4,
        hunter: null,
      });

      expect(result.completed).toBe(true);
      // 梦游者免疫夜间伤害，包括女巫毒药
      expect(result.deaths).toEqual([]);
      expect(result.info).toContain('平安夜');
    });

    it('女巫毒摄梦人：摄梦人死，梦游者连坐死', async () => {
      ctx = await createHostGame(TEMPLATE_NAME, createRoleAssignment());

      const result = await ctx.runNight({
        dreamcatcher: 0,  // 0 号成为梦游者
        darkWolfKing: null,
        wolf: null,       // 狼人空刀
        witch: null,
        witchPoison: 11,  // 女巫毒摄梦人（11号）
        seer: 4,
        hunter: null,
      });

      expect(result.completed).toBe(true);
      // 摄梦人死亡，梦游者连坐出局
      expect(result.deaths).toEqual([0, 11]);
    });

    it('狼人刀摄梦人：摄梦人死，梦游者连坐死', async () => {
      ctx = await createHostGame(TEMPLATE_NAME, createRoleAssignment());

      const result = await ctx.runNight({
        dreamcatcher: 0,  // 0 号成为梦游者
        darkWolfKing: null,
        wolf: 11,         // 狼人杀摄梦人（11号）
        witch: null,
        seer: 4,
        hunter: null,
      });

      expect(result.completed).toBe(true);
      // 摄梦人死亡，梦游者连坐出局
      expect(result.deaths).toEqual([0, 11]);
    });

    it('狼人刀摄梦人但女巫救：摄梦人不死，梦游者不连坐', async () => {
      ctx = await createHostGame(TEMPLATE_NAME, createRoleAssignment());

      const result = await ctx.runNight({
        dreamcatcher: 0,  // 0 号成为梦游者
        darkWolfKing: null,
        wolf: 11,         // 狼人杀摄梦人（11号）
        witch: 11,        // 女巫救摄梦人
        seer: 4,
        hunter: null,
      });

      expect(result.completed).toBe(true);
      // 摄梦人被救，没人死
      expect(result.deaths).toEqual([]);
      expect(result.info).toContain('平安夜');
    });
  });
});
