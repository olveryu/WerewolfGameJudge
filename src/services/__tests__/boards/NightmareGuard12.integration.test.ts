/**
 * 梦魇守卫12人 - Host Runtime Integration Tests
 *
 * 角色配置：4村民 + 3狼人 + 梦魇 + 预言家 + 女巫 + 猎人 + 守卫
 * 行动顺序：guard → nightmare → wolf → witch → seer → hunter
 *
 * 梦魇特性：
 * - 每晚可以封锁一名玩家的技能
 * - 被封锁的玩家当晚技能无效
 * - 梦魇是狼人阵营（技能狼）
 */

import { createHostGame, cleanupHostGame, HostGameContext } from './hostGameFactory';
import { calculateDeaths, NightActions, RoleSeatMap } from '../../DeathCalculator';
import { RoleName } from '../../../models/roles';
import { makeWitchSave, makeWitchPoison } from '../../../models/actions';

const TEMPLATE_NAME = '梦魇守卫12人';

const createRoleAssignment = (): Map<number, RoleName> => {
  const assignment = new Map<number, RoleName>();
  assignment.set(0, 'villager');
  assignment.set(1, 'villager');
  assignment.set(2, 'villager');
  assignment.set(3, 'villager');
  assignment.set(4, 'wolf');
  assignment.set(5, 'wolf');
  assignment.set(6, 'wolf');
  assignment.set(7, 'nightmare');
  assignment.set(8, 'seer');
  assignment.set(9, 'witch');
  assignment.set(10, 'hunter');
  assignment.set(11, 'guard');
  return assignment;
};

describe(`${TEMPLATE_NAME} - Host Runtime Integration`, () => {
  let ctx: HostGameContext;

  afterEach(() => {
    cleanupHostGame();
  });

  describe('Happy Path: 标准夜晚', () => {
    it('应该完整走完夜晚，狼人杀村民', async () => {
      ctx = await createHostGame(TEMPLATE_NAME, createRoleAssignment());

      const result = await ctx.runNight({
        guard: null,
        nightmare: 0, // 梦魇封锁0号（村民，无技能）
        wolf: 1,
        witch: null,
        seer: 4,
        hunter: null,
      });

      expect(result.completed).toBe(true);
      expect(result.deaths).toEqual([1]);
      expect(result.info).toContain('2号');
    });

    it('守卫保护：狼刀目标被守不死', async () => {
      ctx = await createHostGame(TEMPLATE_NAME, createRoleAssignment());

      const result = await ctx.runNight({
        guard: 0, // 守座位0
        nightmare: 1,
        wolf: 0,  // 狼刀座位0
        witch: null,
        seer: 4,
        hunter: null,
      });

      expect(result.completed).toBe(true);
      expect(result.deaths).toEqual([]);
      expect(result.info).toContain('平安夜');
    });
  });

  describe('梦魇封锁技能', () => {
    it('梦魇封锁守卫 → 守卫技能无效', async () => {
      ctx = await createHostGame(TEMPLATE_NAME, createRoleAssignment());

      const result = await ctx.runNight({
        guard: 0, // 守卫想守0号
        nightmare: 11, // 梦魇封锁守卫（座位11）
        wolf: 0, // 狼刀0号
        witch: null,
        seer: 4,
        hunter: null,
      });

      expect(result.completed).toBe(true);
      // 守卫被封锁，保护无效，0号死亡
      expect(result.deaths).toContain(0);
    });

    it('梦魇封锁女巫 → 女巫救人无效', async () => {
      ctx = await createHostGame(TEMPLATE_NAME, createRoleAssignment());

      const result = await ctx.runNight({
        guard: null,
        nightmare: 9, // 梦魇封锁女巫（座位9）
        wolf: 0, // 狼刀0号
        witch: 0, // 女巫想救0号
        seer: 4,
        hunter: null,
      });

      expect(result.completed).toBe(true);
      // 女巫被封锁，救人无效，0号死亡
      expect(result.deaths).toContain(0);
    });

    it('梦魇封锁女巫 → 女巫毒人无效', async () => {
      ctx = await createHostGame(TEMPLATE_NAME, createRoleAssignment());

      const result = await ctx.runNight({
        guard: null,
        nightmare: 9, // 梦魇封锁女巫（座位9）
        wolf: 0, // 狼刀0号
        witch: null,
        witchPoison: 1, // 女巫想毒1号
        seer: 4,
        hunter: null,
      });

      expect(result.completed).toBe(true);
      // 女巫被封锁，毒人无效，只有0号死亡
      expect(result.deaths).toEqual([0]);
    });

    it('梦魇封锁狼人 → 狼人无法杀人', async () => {
      ctx = await createHostGame(TEMPLATE_NAME, createRoleAssignment());

      // 注意：梦魇封锁任意一个狼人（座位4、5、6）都会导致当夜狼人阵营无法刀人
      const result = await ctx.runNight({
        guard: null,
        nightmare: 4, // 梦魇封锁座位4（普狼）
        wolf: 0, // 狼想刀0号
        witch: null,
        seer: 8,
        hunter: null,
      });

      expect(result.completed).toBe(true);
      // 梦魇封锁狼人，狼人阵营当夜不能刀人
      expect(result.deaths).toEqual([]);
      expect(result.info).toContain('平安夜');
    });
  });
});

// =============================================================================
// DeathCalculator 单元测试（梦魇封锁）
// =============================================================================

describe('DeathCalculator - Nightmare Block', () => {
  const baseRoleSeatMap: RoleSeatMap = {
    witcher: -1,
    wolfQueen: -1,
    celebrity: -1,
    spiritKnight: -1,
    seer: 8,
    witch: 9,
    guard: 11,
  };

  describe('正常情况（无梦魇封锁）', () => {
    it('守卫保护有效', () => {
      const actions: NightActions = {
        wolfKill: 0,
        guardProtect: 0,
      };

      const deaths = calculateDeaths(actions, baseRoleSeatMap);

      expect(deaths).toEqual([]);
    });

    it('女巫救人有效', () => {
      const actions: NightActions = {
        wolfKill: 0,
        witchAction: makeWitchSave(0),
      };

      const deaths = calculateDeaths(actions, baseRoleSeatMap);

      expect(deaths).toEqual([]);
    });

    it('女巫毒人有效', () => {
      const actions: NightActions = {
        wolfKill: 0,
        witchAction: makeWitchPoison(1),
      };

      const deaths = calculateDeaths(actions, baseRoleSeatMap);

      expect(deaths).toContain(0);
      expect(deaths).toContain(1);
    });
  });

  describe('梦魇封锁效果', () => {
    it('封锁守卫 → 守卫保护无效', () => {
      const actions: NightActions = {
        wolfKill: 0,
        guardProtect: 0, // 守卫想保护0号
        nightmareBlock: 11, // 封锁守卫（座位11）
      };

      const deaths = calculateDeaths(actions, baseRoleSeatMap);

      // 守卫被封锁，保护无效，0号死亡
      expect(deaths).toEqual([0]);
    });

    it('封锁女巫 → 女巫救人无效', () => {
      const actions: NightActions = {
        wolfKill: 0,
        witchAction: makeWitchSave(0), // 女巫想救0号
        nightmareBlock: 9, // 封锁女巫（座位9）
      };

      const deaths = calculateDeaths(actions, baseRoleSeatMap);

      // 女巫被封锁，救人无效，0号死亡
      expect(deaths).toEqual([0]);
    });

    it('封锁女巫 → 女巫毒人无效', () => {
      const actions: NightActions = {
        wolfKill: 0,
        witchAction: makeWitchPoison(1), // 女巫想毒1号
        nightmareBlock: 9, // 封锁女巫（座位9）
      };

      const deaths = calculateDeaths(actions, baseRoleSeatMap);

      // 女巫被封锁，毒人无效，只有0号死亡
      expect(deaths).toEqual([0]);
    });

    it('封锁狼人 → 狼人无法杀人', () => {
      const actions: NightActions = {
        wolfKill: 0, // 狼想杀0号
        nightmareBlockedWolf: true, // 梦魇封锁了狼人
      };

      const deaths = calculateDeaths(actions, baseRoleSeatMap);

      // 狼人被封锁，当夜无法杀人
      expect(deaths).toEqual([]);
    });

    it('封锁非关键角色 → 不影响其他技能', () => {
      const actions: NightActions = {
        wolfKill: 0,
        guardProtect: 0, // 守卫保护0号
        nightmareBlock: 0, // 封锁座位0（村民）
      };

      const deaths = calculateDeaths(actions, baseRoleSeatMap);

      // 封锁的是村民，守卫保护有效
      expect(deaths).toEqual([]);
    });
  });
});
