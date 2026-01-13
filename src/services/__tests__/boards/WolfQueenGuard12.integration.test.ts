/**
 * 狼美守卫12人 - Host Runtime Integration Tests
 *
 * 角色配置：4村民 + 3狼人 + 狼美人 + 预言家 + 女巫 + 猎人 + 守卫
 * 行动顺序：guard → wolf → wolfQueen → witch → seer → hunter
 *
 * 狼美人特性：
 * - 每晚可以链接一名玩家
 * - 狼美人死亡时，被链接的玩家也死亡
 * - 狼美人是狼人阵营
 */

import { createHostGame, cleanupHostGame, HostGameContext } from './hostGameFactory';
import { calculateDeaths, NightActions, RoleSeatMap } from '../../DeathCalculator';
import { RoleName } from '../../../models/roles';
import { makeWitchPoison } from '../../../models/actions';

const TEMPLATE_NAME = '狼美守卫12人';

const createRoleAssignment = (): Map<number, RoleName> => {
  const assignment = new Map<number, RoleName>();
  assignment.set(0, 'villager');
  assignment.set(1, 'villager');
  assignment.set(2, 'villager');
  assignment.set(3, 'villager');
  assignment.set(4, 'wolf');
  assignment.set(5, 'wolf');
  assignment.set(6, 'wolf');
  assignment.set(7, 'wolfQueen');
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
        wolfQueen: 1, // 狼美人链接1号
        witch: null,
        seer: 4,
        hunter: null,
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
        wolfQueen: 1,
        witch: null,
        seer: 4,
        hunter: null,
      });

      expect(result.completed).toBe(true);
      expect(result.deaths).toEqual([]);
      expect(result.info).toContain('平安夜');
    });
  });

  describe('狼美人技能', () => {
    it('狼美人被刀 → 被链接的玩家也死亡', async () => {
      ctx = await createHostGame(TEMPLATE_NAME, createRoleAssignment());

      // 狼人自刀狼美人
      const result = await ctx.runNight({
        guard: null,
        wolf: 7, // 刀狼美人
        wolfQueen: 0, // 狼美人链接0号
        witch: null,
        seer: 4,
        hunter: null,
      });

      expect(result.completed).toBe(true);
      expect(result.deaths).toContain(7); // 狼美人死亡
      expect(result.deaths).toContain(0); // 被链接的0号也死亡
    });
  });
});

// =============================================================================
// DeathCalculator 单元测试（狼美人链接死亡）
// =============================================================================

describe('DeathCalculator - Wolf Queen Link Death', () => {
  const baseRoleSeatMap: RoleSeatMap = {
    witcher: -1,
    wolfQueen: 7,
  dreamcatcher: -1,
    spiritKnight: -1,
    seer: 8,
    witch: 9,
    guard: 11,
  };

  it('狼美人被狼刀 → 被链接的玩家也死亡', () => {
    const actions: NightActions = {
      wolfKill: 7, // 狼刀狼美人
      wolfQueenCharm: 0, // 狼美人链接0号
    };

    const deaths = calculateDeaths(actions, baseRoleSeatMap);

    expect(deaths).toContain(7); // 狼美人死亡
    expect(deaths).toContain(0); // 被链接的玩家死亡
  });

  it('狼美人被女巫毒死 → 被链接的玩家也死亡', () => {
    const actions: NightActions = {
      wolfKill: 0,
      witchAction: makeWitchPoison(7), // 毒狼美人
      wolfQueenCharm: 1, // 狼美人链接1号
    };

    const deaths = calculateDeaths(actions, baseRoleSeatMap);

    expect(deaths).toContain(0); // 狼刀目标死亡
    expect(deaths).toContain(7); // 狼美人被毒死
    expect(deaths).toContain(1); // 被链接的玩家死亡
  });

  it('狼美人不死亡 → 被链接的玩家不受影响', () => {
    const actions: NightActions = {
      wolfKill: 0,
      wolfQueenCharm: 1, // 狼美人链接1号
    };

    const deaths = calculateDeaths(actions, baseRoleSeatMap);

    expect(deaths).toEqual([0]); // 只有狼刀目标死亡
    expect(deaths).not.toContain(1); // 被链接的玩家不死
  });

  it('狼美人被守卫保护 → 不死，链接不触发', () => {
    const actions: NightActions = {
      wolfKill: 7, // 狼刀狼美人
      guardProtect: 7, // 守卫保护狼美人
      wolfQueenCharm: 0, // 狼美人链接0号
    };

    const deaths = calculateDeaths(actions, baseRoleSeatMap);

    expect(deaths).toEqual([]); // 没人死亡
  });

  it('狼美人不在场时 → 链接不生效', () => {
    const noWolfQueen: RoleSeatMap = {
      ...baseRoleSeatMap,
      wolfQueen: -1,
    };

    const actions: NightActions = {
      wolfKill: 0,
      wolfQueenCharm: 1, // 链接不生效
    };

    const deaths = calculateDeaths(actions, noWolfQueen);

    expect(deaths).toEqual([0]); // 只有狼刀目标死亡
  });
});
