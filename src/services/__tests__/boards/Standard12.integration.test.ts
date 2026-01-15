/**
 * 标准板12人 - Host Runtime Integration Tests
 *
 * 角色配置：4村民 + 4狼人 + 预言家 + 女巫 + 猎人 + 白痴
 * 行动顺序：wolf → witch → seer → hunter
 */

import { createHostGame, cleanupHostGame, HostGameContext, mockSendPrivate } from './hostGameFactory';
import { RoleName } from '../../../models/roles';

const TEMPLATE_NAME = '标准板12人';

const createRoleAssignment = (): Map<number, RoleName> => {
  const assignment = new Map<number, RoleName>();
  assignment.set(0, 'villager');
  assignment.set(1, 'villager');
  assignment.set(2, 'villager');
  assignment.set(3, 'villager');
  assignment.set(4, 'wolf');
  assignment.set(5, 'wolf');
  assignment.set(6, 'wolf');
  assignment.set(7, 'wolf');
  assignment.set(8, 'seer');
  assignment.set(9, 'witch');
  assignment.set(10, 'hunter');
  assignment.set(11, 'idiot');
  return assignment;
};

describe(`${TEMPLATE_NAME} - Host Runtime Integration`, () => {
  let ctx: HostGameContext;

  afterEach(() => {
    cleanupHostGame();
  });

  describe('Happy Path', () => {
    it('狼人杀村民，无人干预', async () => {
      ctx = await createHostGame(TEMPLATE_NAME, createRoleAssignment());

      const result = await ctx.runNight({
        wolf: 0, // 狼人杀0号村民
        witch: null,
        seer: 4,
        hunter: null,
      });

      expect(result.completed).toBe(true);
      expect(result.deaths).toEqual([0]);
    });

    it('女巫救人成功', async () => {
      ctx = await createHostGame(TEMPLATE_NAME, createRoleAssignment());

      const result = await ctx.runNight({
        wolf: 0,
        witch: 0, // 救0号
        seer: 4,
        hunter: null,
      });

      expect(result.completed).toBe(true);
      expect(result.deaths).toEqual([]);
      expect(result.info).toContain('平安夜');
    });

    it('女巫毒人成功', async () => {
      ctx = await createHostGame(TEMPLATE_NAME, createRoleAssignment());

      const result = await ctx.runNight({
        wolf: 0,
        witch: null,
        witchPoison: 1, // 毒1号
        seer: 4,
        hunter: null,
      });

      expect(result.completed).toBe(true);
      expect(result.deaths).toContain(0); // 狼刀
      expect(result.deaths).toContain(1); // 毒杀
    });
  });

  describe('预言家查验', () => {
    it('查验狼人应该收到狼人结果', async () => {
      ctx = await createHostGame(TEMPLATE_NAME, createRoleAssignment());
      mockSendPrivate.mockClear();

      await ctx.runNight({
        wolf: 0,
        witch: null,
        seer: 4, // 查4号狼人
        hunter: null,
      });

      const seerRevealCalls = mockSendPrivate.mock.calls.filter(
        (call) => call[0]?.payload?.kind === 'SEER_REVEAL'
      );

      expect(seerRevealCalls.length).toBeGreaterThan(0);
      expect(seerRevealCalls[0][0].payload.result).toBe('狼人');
    });

    it('查验好人应该收到好人结果', async () => {
      ctx = await createHostGame(TEMPLATE_NAME, createRoleAssignment());
      mockSendPrivate.mockClear();

      await ctx.runNight({
        wolf: 0,
        witch: null,
        seer: 11, // 查11号白痴
        hunter: null,
      });

      const seerRevealCalls = mockSendPrivate.mock.calls.filter(
        (call) => call[0]?.payload?.kind === 'SEER_REVEAL'
      );

      expect(seerRevealCalls.length).toBeGreaterThan(0);
      expect(seerRevealCalls[0][0].payload.result).toBe('好人');
    });
  });

  describe('空刀', () => {
    it('狼人空刀应该无人死亡', async () => {
      ctx = await createHostGame(TEMPLATE_NAME, createRoleAssignment());

      const result = await ctx.runNight({
        wolf: null, // 空刀
        witch: null,
        seer: 4,
        hunter: null,
      });

      expect(result.deaths).toEqual([]);
      expect(result.info).toContain('平安夜');
    });
  });
});
