/**
 * SpiritKnight12 - Host Runtime Integration Tests
 *
 * 角色配置：4村民 + 3狼人 + 恶灵骑士 + 预言家 + 女巫 + 猎人 + 守卫
 *
 * 恶灵骑士特性：
 * - 永久免疫夜间伤害（无法自刀、吃毒不死）
 * - 被预言家查验或女巫毒杀，则次日对方神职死亡（反伤）
 */

import { createHostGame, cleanupHostGame, HostGameContext } from './hostGameFactory';
import { calculateDeaths, NightActions, RoleSeatMap } from '../../DeathCalculator';
import { RoleName } from '../../../models/roles';
import { makeWitchPoison } from '../../../models/actions';

const TEMPLATE_NAME = '恶灵骑士12人';

const createRoleAssignment = (): Map<number, RoleName> => {
  const assignment = new Map<number, RoleName>();
  assignment.set(0, 'villager');
  assignment.set(1, 'villager');
  assignment.set(2, 'villager');
  assignment.set(3, 'villager');
  assignment.set(4, 'wolf');
  assignment.set(5, 'wolf');
  assignment.set(6, 'wolf');
  assignment.set(7, 'spiritKnight');
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
        guard: 8,
        wolf: 0,
        witch: null,
        seer: 4,
        hunter: null,
      });

      expect(result.completed).toBe(true);
      expect(result.deaths).toEqual([0]);
      expect(result.info).toContain('1号');
    });

    it('平安夜：守卫守护狼刀目标', async () => {
      ctx = await createHostGame(TEMPLATE_NAME, createRoleAssignment());

      const result = await ctx.runNight({
        guard: 0,
        wolf: 0,
        witch: null,
        seer: 4,
        hunter: null,
      });

      expect(result.completed).toBe(true);
      expect(result.deaths).toEqual([]);
      expect(result.info).toContain('平安夜');
    });
  });

  describe('恶灵骑士反伤: 预言家查验', () => {
    it('预言家查验恶灵骑士，预言家应死亡，恶灵骑士不死', async () => {
      ctx = await createHostGame(TEMPLATE_NAME, createRoleAssignment());

      const spiritKnightSeat = ctx.findSeatByRole('spiritKnight');
      const seerSeat = ctx.findSeatByRole('seer');

      expect(spiritKnightSeat).toBe(7);
      expect(seerSeat).toBe(8);

      const result = await ctx.runNight({
        guard: 0,
        wolf: 1,
        witch: null,
        seer: spiritKnightSeat,
        hunter: null,
      });

      expect(result.completed).toBe(true);
      expect(result.deaths).toContain(1);
      expect(result.deaths).toContain(seerSeat);
      expect(result.deaths).not.toContain(spiritKnightSeat);
      expect(result.info).toContain(`${seerSeat + 1}号`);
    });
  });

  describe('边界情况', () => {
    it('同守同救必死规则仍然生效', async () => {
      ctx = await createHostGame(TEMPLATE_NAME, createRoleAssignment());

      const result = await ctx.runNight({
        guard: 0,
        wolf: 0,
        witch: 0,
        seer: 4,
        hunter: null,
      });

      expect(result.deaths).toContain(0);
    });
  });
});

describe('DeathCalculator - Spirit Knight Reflection', () => {
  const baseRoleSeatMap: RoleSeatMap = {
    witcher: -1,
    wolfQueen: -1,
  dreamcatcher: -1,
    spiritKnight: 7,
    seer: 8,
    witch: 9,
    guard: 11,
  };

  it('预言家查验恶灵骑士 → 预言家死亡', () => {
    const actions: NightActions = {
      wolfKill: 0,
      seerCheck: 7,
    };

    const deaths = calculateDeaths(actions, baseRoleSeatMap);

    expect(deaths).toContain(0);
    expect(deaths).toContain(8);
    expect(deaths).not.toContain(7);
  });

  it('女巫毒恶灵骑士 → 女巫死亡，恶灵骑士免疫', () => {
    const actions: NightActions = {
      wolfKill: 0,
      witchAction: makeWitchPoison(7),
    };

    const deaths = calculateDeaths(actions, baseRoleSeatMap);

    expect(deaths).toContain(0);
    expect(deaths).toContain(9);
    expect(deaths).not.toContain(7);
  });

  it('预言家查验普通狼人 → 无反伤', () => {
    const actions: NightActions = {
      wolfKill: 0,
      seerCheck: 4,
    };

    const deaths = calculateDeaths(actions, baseRoleSeatMap);

    expect(deaths).toEqual([0]);
  });

  it('女巫毒普通狼人 → 无反伤', () => {
    const actions: NightActions = {
      wolfKill: 0,
      witchAction: makeWitchPoison(4),
    };

    const deaths = calculateDeaths(actions, baseRoleSeatMap);

    expect(deaths).toContain(0);
    expect(deaths).toContain(4);
    expect(deaths).not.toContain(9);
  });

  it('恶灵骑士不在场时无反伤规则', () => {
    const noSpiritKnight: RoleSeatMap = {
      ...baseRoleSeatMap,
      spiritKnight: -1,
    };

    const actions: NightActions = {
      wolfKill: 0,
      seerCheck: 4,
      witchAction: makeWitchPoison(5),
    };

    const deaths = calculateDeaths(actions, noSpiritKnight);

    expect(deaths).toContain(0);
    expect(deaths).toContain(5);
    expect(deaths).not.toContain(8);
    expect(deaths).not.toContain(9);
  });
});
