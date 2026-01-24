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
import { RoleId } from '../../../models/roles';

const TEMPLATE_NAME = '狼美守卫12人';

const createRoleAssignment = (): Map<number, RoleId> => {
  const assignment = new Map<number, RoleId>();
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
        wolf: 0, // 狼刀座位0
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
  it('狼美人被女巫毒死 → 被链接的玩家也死亡', async () => {
      ctx = await createHostGame(TEMPLATE_NAME, createRoleAssignment());

      const result = await ctx.runNight({
        guard: null,
    wolf: 0, // 狼刀村民
        wolfQueen: 0, // 狼美人链接0号
    witchPoison: 7, // 女巫毒狼美人
        seer: 4,
        hunter: null,
      });

      expect(result.completed).toBe(true);
      expect(result.deaths).toContain(7); // 狼美人死亡
      expect(result.deaths).toContain(0); // 被链接的0号也死亡
    });
  });

  describe('边界情况和复杂场景', () => {
    it('狼美人被女巫毒死 → 被链接的玩家也死亡', async () => {
      ctx = await createHostGame(TEMPLATE_NAME, createRoleAssignment());

      const result = await ctx.runNight({
        guard: null,
        wolf: 0, // 狼刀村民
        wolfQueen: 1, // 狼美人链接1号
        witchPoison: 7, // 女巫毒狼美人
        seer: 4,
        hunter: null,
      });

      expect(result.completed).toBe(true);
      expect(result.deaths).toContain(0); // 狼刀目标
      expect(result.deaths).toContain(7); // 狼美人被毒死
      expect(result.deaths).toContain(1); // 被链接的玩家死亡
    });

    it('守卫守狼美人 + 狼刀狼美人 → 狼美人存活，链接不触发', async () => {
      ctx = await createHostGame(TEMPLATE_NAME, createRoleAssignment());

      const wolfQueenSeat = ctx.findSeatByRole('wolfQueen');
      expect(wolfQueenSeat).toBe(7);

      const result = await ctx.runNight({
        guard: wolfQueenSeat, // 守卫守狼美人
  wolf: 0, // 禁选：狼美人不可被狼刀投票，改为刀0号
        wolfQueen: 0, // 狼美人链接0号
        witch: null,
        seer: 4,
        hunter: null,
      });

  expect(result.completed).toBe(true);
  // 狼美人未被刀，守卫也与狼刀无关，0号应死亡；链接在狼美人存活时不触发
  expect(result.deaths).toEqual([0]);
    });

    it('女巫救狼美人（被狼刀）→ 狼美人存活，链接不触发', async () => {
      ctx = await createHostGame(TEMPLATE_NAME, createRoleAssignment());


      const result = await ctx.runNight({
        guard: null,
  wolf: 0, // 禁选：狼美人不可被狼刀投票，改为刀0号
        wolfQueen: 0, // 狼美人链接0号
  witch: 0, // 女巫救0号
        seer: 4,
        hunter: null,
      });

      expect(result.completed).toBe(true);
  expect(result.deaths).toEqual([]); // 女巫救人
  expect(result.info).toContain('平安夜');
    });

    it('狼美人链接预言家 + 狼刀狼美人 → 预言家连坐死', async () => {
      ctx = await createHostGame(TEMPLATE_NAME, createRoleAssignment());

      const wolfQueenSeat = ctx.findSeatByRole('wolfQueen');
      const seerSeat = ctx.findSeatByRole('seer');

      const result = await ctx.runNight({
        guard: null,
  wolf: 0, // 禁选：狼美人不可被狼刀投票，改为刀0号
        wolfQueen: seerSeat, // 狼美人链接预言家
        witch: null,
        seer: 4,
        hunter: null,
      });

      expect(result.completed).toBe(true);
  expect(result.deaths).toContain(0); // 狼刀目标死亡
  // 狼美人未死亡，链接不触发
  expect(result.deaths).not.toContain(wolfQueenSeat);
  expect(result.deaths).not.toContain(seerSeat);
    });

    it('同守同救必死规则 + 狼美人链接', async () => {
      ctx = await createHostGame(TEMPLATE_NAME, createRoleAssignment());

      const wolfQueenSeat = ctx.findSeatByRole('wolfQueen');

      const result = await ctx.runNight({
        guard: wolfQueenSeat, // 守卫守狼美人
  wolf: 0, // 禁选：狼美人不可被狼刀投票，改为刀0号
        wolfQueen: 0, // 狼美人链接0号
  witch: 0, // 女巫救0号
        seer: 4,
        hunter: null,
      });

      expect(result.completed).toBe(true);
  // guard 守的是狼美人(7)而非 0 号，因此不触发“同守同救必死”；0 号被女巫救下应存活
  expect(result.deaths).toEqual([]);
  expect(result.info).toContain('平安夜');
  // 狼美人未死亡（未被刀），链接不触发
  expect(result.deaths).not.toContain(wolfQueenSeat);
    });

    it('双死亡：狼刀村民 + 女巫毒另一村民', async () => {
      ctx = await createHostGame(TEMPLATE_NAME, createRoleAssignment());

      const result = await ctx.runNight({
        guard: null,
        wolf: 0, // 狼刀座位0
        wolfQueen: 3, // 狼美人链接3号（不触发）
        witchPoison: 1, // 女巫毒座位1
        seer: 4,
        hunter: null,
      });

      expect(result.completed).toBe(true);
      expect(result.deaths).toContain(0);
      expect(result.deaths).toContain(1);
      expect(result.deaths).not.toContain(3); // 狼美人没死，链接不触发
    });
  });
});

// DeathCalculator unit tests for Wolf Queen Link Death are in src/services/__tests__/DeathCalculator.test.ts
// Wolf Vote Rejection tests are in src/services/__tests__/GameStateService.wolfVoteRejection.test.ts
