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

  describe('猎魔人特性: 免疫毒药', () => {
    it('女巫毒猎魔人，猎魔人不死', async () => {
      ctx = await createHostGame(TEMPLATE_NAME, createRoleAssignment());

      const witcherSeat = ctx.findSeatByRole('witcher');
      expect(witcherSeat).toBe(11);

      // Note: runNight currently uses witch action as save, not poison
      // We'll test via DeathCalculator directly
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
    celebrity: -1,
    spiritKnight: -1,
    seer: 8,
    witch: 9,
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
