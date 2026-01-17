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
import { RoleId } from '../../../models/roles';

const TEMPLATE_NAME = '狼王守卫12人';

const createRoleAssignment = (): Map<number, RoleId> => {
  const assignment = new Map<number, RoleId>();
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
    /**
     * 黑狼王"带走一人"技能是白天死亡时由玩家自己宣布发动的，不在夜间处理。
     * 夜间只需验证死亡方式是否允许发动技能（getDarkWolfKingStatus）。
     *
     * 规则：
     * - 被狼刀死亡（包括自刀）→ 可以发动技能
     * - 被女巫毒死 → 不能发动技能
     */

    it('黑狼王被狼刀死亡（包括自刀）→ 死亡，可发动技能', async () => {
      ctx = await createHostGame(TEMPLATE_NAME, createRoleAssignment());

      const result = await ctx.runNight({
        guard: null,
        wolf: 7, // 狼刀黑狼王自己
        witch: null,
        seer: 4,
        hunter: null,
        darkWolfKing: null, // 夜间无行动
      });

      expect(result.completed).toBe(true);
      expect(result.deaths).toContain(7); // 黑狼王死亡
      // 注：是否可发动技能由 getDarkWolfKingStatus 判定（DeathCalculator 单测覆盖）
    });

    it('黑狼王被女巫毒死 → 死亡，不能发动技能', async () => {
      ctx = await createHostGame(TEMPLATE_NAME, createRoleAssignment());

      const result = await ctx.runNight({
        guard: null,
        wolf: 0, // 狼刀座位0
        witchPoison: 7, // 女巫毒黑狼王
        seer: 4,
        hunter: null,
        darkWolfKing: null,
      });

      expect(result.completed).toBe(true);
      expect(result.deaths).toContain(7); // 黑狼王被毒死
      expect(result.deaths).toContain(0); // 狼刀目标死亡
      // 注：被毒死不能发动技能，由 getDarkWolfKingStatus 返回 false
    });
  });

  describe('边界情况和复杂场景', () => {
    it('守卫守自己 + 狼刀守卫 → 守卫存活', async () => {
      ctx = await createHostGame(TEMPLATE_NAME, createRoleAssignment());

      const guardSeat = ctx.findSeatByRole('guard');
      expect(guardSeat).toBe(11);

      const result = await ctx.runNight({
        guard: guardSeat, // 守卫守自己
        wolf: guardSeat,  // 狼刀守卫
        witch: null,
        seer: 4,
        hunter: null,
        darkWolfKing: null,
      });

      expect(result.completed).toBe(true);
      expect(result.deaths).toEqual([]);
      expect(result.info).toContain('平安夜');
    });

    it('同守同救必死：狼刀 + 守卫守 + 女巫救同一目标 → 必死', async () => {
      ctx = await createHostGame(TEMPLATE_NAME, createRoleAssignment());

      const result = await ctx.runNight({
        guard: 0, // 守座位0
        wolf: 0,  // 狼刀座位0
        witch: 0, // 救座位0
        seer: 4,
        hunter: null,
        darkWolfKing: null,
      });

      expect(result.completed).toBe(true);
      // 同守同救必死规则
      expect(result.deaths).toContain(0);
    });

    it('守卫守预言家 + 狼刀预言家 → 预言家存活', async () => {
      ctx = await createHostGame(TEMPLATE_NAME, createRoleAssignment());

      const seerSeat = ctx.findSeatByRole('seer');

      const result = await ctx.runNight({
        guard: seerSeat,
        wolf: seerSeat,
        witch: null,
        seer: 4,
        hunter: null,
        darkWolfKing: null,
      });

      expect(result.completed).toBe(true);
      expect(result.deaths).toEqual([]);
      expect(result.info).toContain('平安夜');
    });

    it('守卫守护 + 女巫毒同一目标 → 死亡（守卫不防毒）', async () => {
      ctx = await createHostGame(TEMPLATE_NAME, createRoleAssignment());

      const result = await ctx.runNight({
        guard: 0,         // 守卫守座位0
        wolf: 1,          // 狼刀座位1
        witchPoison: 0,   // 女巫毒座位0
        seer: 4,
        hunter: null,
        darkWolfKing: null,
      });

      expect(result.completed).toBe(true);
      expect(result.deaths).toContain(0);  // 守卫不防毒
      expect(result.deaths).toContain(1);  // 狼刀目标死
    });

    it('预言家查黑狼王 → 查狼人身份', async () => {
      ctx = await createHostGame(TEMPLATE_NAME, createRoleAssignment());

      const darkWolfKingSeat = ctx.findSeatByRole('darkWolfKing');

      const result = await ctx.runNight({
        guard: null,
        wolf: 0,
        witch: null,
        seer: darkWolfKingSeat, // 查黑狼王
        hunter: null,
        darkWolfKing: null,
      });

      expect(result.completed).toBe(true);
      expect(result.deaths).toEqual([0]);
    });

    it('双死亡：狼刀村民 + 女巫毒狼人', async () => {
      ctx = await createHostGame(TEMPLATE_NAME, createRoleAssignment());

      const result = await ctx.runNight({
        guard: null,
        wolf: 0,          // 狼刀村民
        witchPoison: 4,   // 女巫毒普狼
        seer: 5,          // 预言家查另一狼
        hunter: null,
        darkWolfKing: null,
      });

      expect(result.completed).toBe(true);
      expect(result.deaths).toContain(0);  // 村民死
      expect(result.deaths).toContain(4);  // 狼被毒死
      expect(result.deaths.length).toBe(2);
    });
  });
});

// DeathCalculator unit tests for Guard Protection are in src/services/__tests__/DeathCalculator.test.ts
