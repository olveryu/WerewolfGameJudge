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
import { RoleId } from '../../../models/roles';

const TEMPLATE_NAME = '恶灵骑士12人';

const createRoleAssignment = (): Map<number, RoleId> => {
  const assignment = new Map<number, RoleId>();
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

  it('狼人刀恶灵骑士：禁选应被拒绝（改为狼刀村民走通夜晚）', async () => {
      ctx = await createHostGame(TEMPLATE_NAME, createRoleAssignment());

      const spiritKnightSeat = ctx.findSeatByRole('spiritKnight');
      expect(spiritKnightSeat).toBe(7);

      const result = await ctx.runNight({
        guard: 0,
        wolf: 0, // 禁选：免疫角色不可被狼刀投票，改为刀村民确保流程与结算可覆盖
        witch: null,
        seer: 4,
        hunter: null,
      });

      expect(result.completed).toBe(true);
      // 该用例只关注“禁选不会卡死夜晚流程”，死亡由其他用例/DeathCalculator 覆盖
    });

    it('预言家查恶灵骑士：预言家反伤死', async () => {
      ctx = await createHostGame(TEMPLATE_NAME, createRoleAssignment());

      const spiritKnightSeat = ctx.findSeatByRole('spiritKnight');
      expect(spiritKnightSeat).toBe(7);

      const result = await ctx.runNight({
        guard: 0,
        wolf: 1, // 狼人杀村民
        witch: null,
        seer: spiritKnightSeat, // 预言家查恶灵骑士
        hunter: null,
      });

      expect(result.completed).toBe(true);
      expect(result.deaths).toContain(1); // 村民被狼刀
      expect(result.deaths).toContain(8); // 预言家反伤死
    });

    it('女巫毒恶灵骑士：恶灵骑士免疫 + 女巫反伤死', async () => {
      ctx = await createHostGame(TEMPLATE_NAME, createRoleAssignment());

      const result = await ctx.runNight({
        guard: 0,
        wolf: 1, // 狼人杀村民
        witch: null,
        witchPoison: 7, // 女巫毒恶灵骑士
        seer: 4,
        hunter: null,
      });

      expect(result.completed).toBe(true);
      expect(result.deaths).toContain(1); // 村民死
      expect(result.deaths).toContain(9); // 女巫反伤死
      expect(result.deaths).not.toContain(7); // 恶灵骑士免疫
    });

    it('预言家查恶灵骑士 + 女巫毒恶灵骑士：双反伤', async () => {
      ctx = await createHostGame(TEMPLATE_NAME, createRoleAssignment());

      const spiritKnightSeat = ctx.findSeatByRole('spiritKnight');

      const result = await ctx.runNight({
        guard: 0,
        wolf: 1, // 狼人杀村民
        witch: null,
        witchPoison: spiritKnightSeat, // 女巫毒恶灵骑士
        seer: spiritKnightSeat, // 预言家也查恶灵骑士
        hunter: null,
      });

      expect(result.completed).toBe(true);
      expect(result.deaths).toContain(1); // 村民死
      expect(result.deaths).toContain(8); // 预言家反伤死
      expect(result.deaths).toContain(9); // 女巫反伤死
      expect(result.deaths).not.toContain(7); // 恶灵骑士免疫
    });

    it('预言家查村民 + 女巫毒狼：正常死亡无反伤', async () => {
      ctx = await createHostGame(TEMPLATE_NAME, createRoleAssignment());

      const result = await ctx.runNight({
        guard: 0,
        wolf: 1,
        witch: null,
        witchPoison: 4, // 女巫毒普通狼
        seer: 0, // 预言家查村民
        hunter: null,
      });

      expect(result.completed).toBe(true);
      expect(result.deaths).toContain(1); // 狼刀目标
      expect(result.deaths).toContain(4); // 狼被毒
      expect(result.deaths).not.toContain(8); // 预言家无反伤
      expect(result.deaths).not.toContain(9); // 女巫无反伤
    });

    it('狼人刀预言家：预言家死亡', async () => {
      ctx = await createHostGame(TEMPLATE_NAME, createRoleAssignment());

      const result = await ctx.runNight({
        guard: 0,
        wolf: 8, // 狼人杀预言家
        witch: null,
        seer: 4, // 预言家查狼
        hunter: null,
      });

      expect(result.completed).toBe(true);
      expect(result.deaths).toEqual([8]);
    });

    it('守卫守预言家 + 狼刀预言家 + 预言家查恶灵骑士：预言家存活但反伤死', async () => {
      ctx = await createHostGame(TEMPLATE_NAME, createRoleAssignment());

      const spiritKnightSeat = ctx.findSeatByRole('spiritKnight');
      const seerSeat = ctx.findSeatByRole('seer');

      const result = await ctx.runNight({
        guard: seerSeat, // 守卫守预言家
        wolf: seerSeat, // 狼刀预言家（被守卫挡住）
        witch: null,
        seer: spiritKnightSeat, // 预言家查恶灵骑士
        hunter: null,
      });

      expect(result.completed).toBe(true);
      // 守卫挡住了狼刀，但预言家查恶灵骑士仍然反伤死
      expect(result.deaths).toContain(seerSeat);
    });
  });
});

// DeathCalculator unit tests for Spirit Knight Reflection are in src/services/__tests__/DeathCalculator.test.ts
// Wolf Vote Rejection tests are in src/services/__tests__/GameStateService.wolfVoteRejection.test.ts
