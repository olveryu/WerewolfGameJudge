/**
 * BloodMoonWitcher12 - Host Runtime Integration Tests
 *
 * 角色配置：4村民 + 3狼人 + 血月使徒 + 预言家 + 女巫 + 白痴 + 猎魔人
 * 行动顺序：wolf → witch → seer → witcher
 *
 * 猎魔人特性：
 * - 免疫女巫毒药
 * - 第二晚开始可狩猎狼人
 *
 * 血月使徒特性：
 * - 技能狼，无夜间行动
 */

import { createHostGame, cleanupHostGame, HostGameContext } from './hostGameFactory';
import { calculateDeaths, NightActions, RoleSeatMap } from '../../DeathCalculator';
import { RoleName } from '../../../models/roles';
import { makeWitchPoison } from '../../../models/actions';

const TEMPLATE_NAME = '血月猎魔12人';

const createRoleAssignment = (): Map<number, RoleName> => {
  const assignment = new Map<number, RoleName>();
  assignment.set(0, 'villager');
  assignment.set(1, 'villager');
  assignment.set(2, 'villager');
  assignment.set(3, 'villager');
  assignment.set(4, 'wolf');
  assignment.set(5, 'wolf');
  assignment.set(6, 'wolf');
  assignment.set(7, 'bloodMoon');
  assignment.set(8, 'seer');
  assignment.set(9, 'witch');
  assignment.set(10, 'idiot');
  assignment.set(11, 'witcher');
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
        wolf: 0,
        witch: null,
        seer: 4,
        witcher: null,
      });

      expect(result.completed).toBe(true);
      expect(result.deaths).toEqual([0]);
      expect(result.info).toContain('1号');
    });
  });

  describe('猎魔人特性: 免疫毒药 (Host Runtime)', () => {
    it('女巫毒猎魔人 → 猎魔人免疫，不死', async () => {
      ctx = await createHostGame(TEMPLATE_NAME, createRoleAssignment());

      const witcherSeat = ctx.findSeatByRole('witcher');
      expect(witcherSeat).toBe(11);

      // Host runtime: 女巫使用 witchPoison 毒猎魔人
      const result = await ctx.runNight({
        wolf: 0, // 狼刀座位0（村民）
        witchPoison: witcherSeat, // 毒猎魔人 (seat 11)
        seer: 4, // 预言家查狼
        witcher: null, // 猎魔人第一夜不行动
      });

      // 最小判定信号:
      // 1. 夜晚完成（不 stuck）
      expect(result.completed).toBe(true);
      // 2. 猎魔人免疫毒药，不在死亡列表
      expect(result.deaths).not.toContain(witcherSeat);
      // 3. 狼刀目标应该死亡
      expect(result.deaths).toContain(0);
    });

    it('女巫毒普通村民 → 村民死亡（对照组）', async () => {
      ctx = await createHostGame(TEMPLATE_NAME, createRoleAssignment());

      const result = await ctx.runNight({
        wolf: 0, // 狼刀座位0
        witchPoison: 1, // 毒座位1（村民）
        seer: 4,
        witcher: null,
      });

      expect(result.completed).toBe(true);
      // 狼刀 + 女巫毒都应该生效
      expect(result.deaths).toContain(0);
      expect(result.deaths).toContain(1);
    });
  });

  describe('女巫救人链路 (Host Runtime)', () => {
    it('女巫救被刀村民 → 平安夜', async () => {
      ctx = await createHostGame(TEMPLATE_NAME, createRoleAssignment());

      const result = await ctx.runNight({
        wolf: 0, // 狼刀座位0
        witch: 0, // 救座位0 (witch 不指定 witchPoison 时默认为救)
        seer: 4,
        witcher: null,
      });

      expect(result.completed).toBe(true);
      expect(result.deaths).toEqual([]);
      expect(result.info).toContain('平安夜');
    });

    /**
     * 女巫同夜救毒限制：
     * 当前规则是女巫每夜只能使用一种药（救或毒，不可同时）。
     * hostGameFactory.runNight 的设计：如果同时传入 witch 和 witchPoison，
     * 会优先使用 witchPoison（参见 processRoleAction）。
     *
     * 此测试锁定该行为契约。
     */
    it('同时传入 witch 和 witchPoison → witchPoison 优先', async () => {
      ctx = await createHostGame(TEMPLATE_NAME, createRoleAssignment());

      const result = await ctx.runNight({
        wolf: 0, // 狼刀座位0
        witch: 0, // 尝试救座位0
        witchPoison: 1, // 同时尝试毒座位1
        seer: 4,
        witcher: null,
      });

      expect(result.completed).toBe(true);
      // witchPoison 优先：座位0 未被救（死亡），座位1 被毒（死亡）
      expect(result.deaths).toContain(0);
      expect(result.deaths).toContain(1);
    });
  });
});

// =============================================================================
// DeathCalculator 单元测试（猎魔人免疫毒药）
// =============================================================================

describe('DeathCalculator - Witcher Poison Immunity', () => {
  const baseRoleSeatMap: RoleSeatMap = {
    witcher: 11,
    wolfQueen: -1,
  dreamcatcher: -1,
    spiritKnight: -1,
    seer: 8,
    witch: 9,
    guard: -1,
  };

  it('女巫毒猎魔人 → 猎魔人免疫，不死', () => {
    const actions: NightActions = {
      wolfKill: 0,
      witchAction: makeWitchPoison(11), // 毒猎魔人
    };

    const deaths = calculateDeaths(actions, baseRoleSeatMap);

    expect(deaths).toContain(0);      // 狼刀目标死亡
    expect(deaths).not.toContain(11); // 猎魔人免疫
  });

  it('女巫毒普通村民 → 村民死亡', () => {
    const actions: NightActions = {
      wolfKill: 0,
      witchAction: makeWitchPoison(1),
    };

    const deaths = calculateDeaths(actions, baseRoleSeatMap);

    expect(deaths).toContain(0);
    expect(deaths).toContain(1);
  });

  it('猎魔人不在场时，毒药正常生效', () => {
    const noWitcher: RoleSeatMap = {
      ...baseRoleSeatMap,
      witcher: -1,
    };

    const actions: NightActions = {
      wolfKill: 0,
      witchAction: makeWitchPoison(11),
    };

    const deaths = calculateDeaths(actions, noWitcher);

    expect(deaths).toContain(0);
    expect(deaths).toContain(11); // 没有猎魔人免疫，11号死亡
  });
});
