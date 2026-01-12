/**
 * 狼王守卫12人 - Host Runtime Integration Tests
 *
 * 角色配置：4村民 + 3狼人 + 黑狼王 + 预言家 + 女巫 + 猎人 + 守卫
 * 行动顺序：guard → wolf → witch → seer → hunter → darkWolfKing
 *
 * 黑狼王特性：
 * - 被刀死亡时可以带走一人
 * - 被女巫毒死不能发动技能
 *
 * 守卫特性：
 * - 守护目标免疫狼刀
 * - 不能连续两晚守同一人（第一晚忽略此规则）
 */

import { createHostGame, cleanupHostGame, HostGameContext } from './hostGameFactory';
import { calculateDeaths, NightActions, RoleSeatMap } from '../../DeathCalculator';
import { RoleName } from '../../../models/roles';
import { makeWitchSave, makeWitchPoison } from '../../../models/actions';

const TEMPLATE_NAME = '狼王守卫12人';

const createRoleAssignment = (): Map<number, RoleName> => {
  const assignment = new Map<number, RoleName>();
  assignment.set(0, 'villager');
  assignment.set(1, 'villager');
  assignment.set(2, 'villager');
  assignment.set(3, 'villager');
  assignment.set(4, 'wolf');
  assignment.set(5, 'wolf');
  assignment.set(6, 'wolf');
  assignment.set(7, 'darkWolfKing');
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
        wolf: 0,
        witch: null,
        seer: 4,
        hunter: null,
        darkWolfKing: null,
      });

      expect(result.completed).toBe(true);
      expect(result.deaths).toEqual([0]);
      expect(result.info).toContain('1号');
    });

    it('守卫保护：狼刀目标被守不死', async () => {
      ctx = await createHostGame(TEMPLATE_NAME, createRoleAssignment());

      const result = await ctx.runNight({
        guard: 0, // 守座位0
        wolf: 0,  // 狼刀座位0
        witch: null,
        seer: 4,
        hunter: null,
        darkWolfKing: null,
      });

      expect(result.completed).toBe(true);
      expect(result.deaths).toEqual([]);
      expect(result.info).toContain('平安夜');
    });

    it('女巫救人：狼刀目标被救不死', async () => {
      ctx = await createHostGame(TEMPLATE_NAME, createRoleAssignment());

      const result = await ctx.runNight({
        guard: null,
        wolf: 0,
        witch: 0, // 救座位0
        seer: 4,
        hunter: null,
        darkWolfKing: null,
      });

      expect(result.completed).toBe(true);
      expect(result.deaths).toEqual([]);
      expect(result.info).toContain('平安夜');
    });
  });

  describe('黑狼王技能', () => {
    it('黑狼王自刀死亡不能发动技能', async () => {
      // 黑狼王自刀 = 自杀，不算正常死亡
      ctx = await createHostGame(TEMPLATE_NAME, createRoleAssignment());

      const result = await ctx.runNight({
        guard: null,
        wolf: 7, // 狼刀黑狼王自己
        witch: null,
        seer: 4,
        hunter: null,
        darkWolfKing: null, // 自刀不能发动技能
      });

      expect(result.completed).toBe(true);
      expect(result.deaths).toContain(7);
    });
  });
});

// =============================================================================
// DeathCalculator 单元测试（守卫保护）
// =============================================================================

describe('DeathCalculator - Guard Protection', () => {
  const baseRoleSeatMap: RoleSeatMap = {
    witcher: -1,
    wolfQueen: -1,
    celebrity: -1,
    spiritKnight: -1,
    seer: 8,
    witch: 9,
    guard: 11,
  };

  it('守卫保护目标 → 狼刀无效', () => {
    const actions: NightActions = {
      wolfKill: 0,
      guardProtect: 0,
    };

    const deaths = calculateDeaths(actions, baseRoleSeatMap);

    expect(deaths).toEqual([]);
  });

  it('守卫保护非狼刀目标 → 狼刀生效', () => {
    const actions: NightActions = {
      wolfKill: 0,
      guardProtect: 1,
    };

    const deaths = calculateDeaths(actions, baseRoleSeatMap);

    expect(deaths).toContain(0);
  });

  it('同守同救必死：守卫保护 + 女巫救人同一目标 → 目标死亡', () => {
    const actions: NightActions = {
      wolfKill: 0,
      guardProtect: 0,
      witchAction: makeWitchSave(0),
    };

    const deaths = calculateDeaths(actions, baseRoleSeatMap);

    // 同守同救必死规则：守卫和女巫同时保护同一人，该人必死
    expect(deaths).toEqual([0]);
  });

  it('守卫保护无法阻挡女巫毒药', () => {
    const actions: NightActions = {
      wolfKill: 1,
      guardProtect: 0,
      witchAction: makeWitchPoison(0),
    };

    const deaths = calculateDeaths(actions, baseRoleSeatMap);

    expect(deaths).toContain(0); // 守卫保护不能阻挡毒药
    expect(deaths).toContain(1); // 狼刀目标死亡
  });
});
