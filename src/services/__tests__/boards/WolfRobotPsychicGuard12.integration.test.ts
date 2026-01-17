/**
 * 机械狼通灵师12人 - Host Runtime Integration Test
 *
 * Template: villager x4, wolf x3, wolfRobot, psychic, witch, hunter, guard
 * 特点:
 * - wolfRobot 是非参会狼（不看队友，队友不看它）
 * - psychic 查死者身份（私信 reveal）
 * - guard 守护一个人（被守护者今夜免刀）
 */

import {
  createHostGame,
  cleanupHostGame,
  HostGameContext,
  mockSendPrivate,
} from './hostGameFactory';
import { RoleId } from '../../../models/roles';

const TEMPLATE_NAME = '机械狼通灵师12人';

/**
 * 固定角色分配（便于测试）
 * 0-3: 村民
 * 4-6: 狼人
 * 7: 机械狼
 * 8: 通灵师, 9: 女巫, 10: 猎人, 11: 守卫
 */
function createRoleAssignment(): Map<number, RoleId> {
  const map = new Map<number, RoleId>();
  map.set(0, 'villager');
  map.set(1, 'villager');
  map.set(2, 'villager');
  map.set(3, 'villager');
  map.set(4, 'wolf');
  map.set(5, 'wolf');
  map.set(6, 'wolf');
  map.set(7, 'wolfRobot');
  map.set(8, 'psychic');
  map.set(9, 'witch');
  map.set(10, 'hunter');
  map.set(11, 'guard');
  return map;
}

describe(`${TEMPLATE_NAME} - Host Runtime Integration`, () => {
  let ctx: HostGameContext;

  afterEach(() => {
    cleanupHostGame();
  });

  describe('Happy Path: 标准夜晚', () => {
    it('应该完整走完夜晚，狼人杀村民', async () => {
      ctx = await createHostGame(TEMPLATE_NAME, createRoleAssignment());

      const result = await ctx.runNight({
        guard: 8, // 守卫守 8 号通灵师
        wolfRobot: null,
        wolf: 0, // 狼人杀 0 号村民
        witch: null,
        psychic: null, // 通灵师第一夜没人死，无行动
        hunter: null,
      });

      expect(result.completed).toBe(true);
      expect(result.deaths).toEqual([0]);
      expect(result.info).toContain('1号');
    });

    it('守卫守护成功：狼刀目标不死', async () => {
      ctx = await createHostGame(TEMPLATE_NAME, createRoleAssignment());

      const result = await ctx.runNight({
        guard: 0, // 守卫守 0 号
        wolfRobot: null,
        wolf: 0, // 狼人杀 0 号
        witch: null,
        psychic: null,
        hunter: null,
      });

      expect(result.completed).toBe(true);
      expect(result.deaths).toEqual([]);
      expect(result.info).toContain('平安夜');
    });
  });

  describe('WolfRobot 特性', () => {
    it('机械狼是非参会狼：不看队友', async () => {
      const { ROLE_SPECS } = require('../../../models/roles/spec');
      expect(ROLE_SPECS.wolfRobot.wolfMeeting?.canSeeWolves).toBe(false);
    });

    // NOTE: 机械狼没有 visibleToOtherWolves 字段
    // 其不可见性通过 canSeeWolves=false + participatesInWolfVote=false 语义暗示
    // 具体队友可见性逻辑由 host resolver 在运行时计算

    it('机械狼不参与狼人投票', async () => {
      const { ROLE_SPECS } = require('../../../models/roles/spec');
      expect(ROLE_SPECS.wolfRobot.wolfMeeting?.participatesInWolfVote).toBe(false);
    });
  });

  describe('Psychic 特性', () => {
    it('通灵师 Night-1 有行动', async () => {
      const { ROLE_SPECS } = require('../../../models/roles/spec');
      expect(ROLE_SPECS.psychic.night1.hasAction).toBe(true);

      const { NIGHT_STEPS } = require('../../../models/roles/spec');
      const psychicStep = NIGHT_STEPS.find((s: { roleId: string }) => s.roleId === 'psychic');
      expect(psychicStep).toBeDefined();
      expect(psychicStep?.id).toBe('psychicCheck');
    });

    it('通灵师结果通过 private message 发送', async () => {
      const { SCHEMAS } = require('../../../models/roles/spec');
      expect(SCHEMAS.psychicCheck).toBeDefined();
      // psychic 的查验结果通过 GameStateService.sendPsychicReveal 私信
      // Schema 本身不记录 result，结果在 resolver 层处理
      expect(SCHEMAS.psychicCheck.kind).toBe('chooseSeat');
    });
  });

  describe('Guard 特性', () => {
    it('守卫 Night-1 有行动', async () => {
      const { ROLE_SPECS } = require('../../../models/roles/spec');
      expect(ROLE_SPECS.guard.night1.hasAction).toBe(true);

      const { NIGHT_STEPS } = require('../../../models/roles/spec');
      const guardStep = NIGHT_STEPS.find((s: { roleId: string }) => s.roleId === 'guard');
      expect(guardStep).toBeDefined();
      expect(guardStep?.id).toBe('guardProtect');
    });

    it('守卫排在狼人之前', async () => {
      const { NIGHT_STEPS } = require('../../../models/roles/spec');

      const guardIndex = NIGHT_STEPS.findIndex((s: { roleId: string }) => s.roleId === 'guard');
      const wolfIndex = NIGHT_STEPS.findIndex((s: { roleId: string }) => s.roleId === 'wolf');

      expect(guardIndex).toBeLessThan(wolfIndex);
    });
  });

  describe('Edge Cases', () => {
    it('狼空刀 + 守卫守护：平安夜', async () => {
      ctx = await createHostGame(TEMPLATE_NAME, createRoleAssignment());

      const result = await ctx.runNight({
        guard: 1,
        wolfRobot: null,
        wolf: null, // 狼人空刀
        witch: null,
        psychic: null,
        hunter: null,
      });

      expect(result.completed).toBe(true);
      expect(result.deaths).toEqual([]);
      expect(result.info).toContain('平安夜');
    });

    it('女巫救人：狼刀目标不死（与守卫可叠加）', async () => {
      ctx = await createHostGame(TEMPLATE_NAME, createRoleAssignment());

      const result = await ctx.runNight({
        guard: 1, // 守卫守 1 号
        wolfRobot: null,
        wolf: 0, // 狼人杀 0 号
        witch: 0, // 女巫救 0 号
        psychic: null,
        hunter: null,
      });

      expect(result.completed).toBe(true);
      expect(result.deaths).toEqual([]);
      expect(result.info).toContain('平安夜');
    });

    it('女巫毒人：毒药目标死亡', async () => {
      ctx = await createHostGame(TEMPLATE_NAME, createRoleAssignment());

      const result = await ctx.runNight({
        guard: 8,
        wolfRobot: null,
        wolf: null,
        witch: null,
        witchPoison: 2, // 女巫毒 2 号
        psychic: null,
        hunter: null,
      });

      expect(result.completed).toBe(true);
      expect(result.deaths).toEqual([2]);
      expect(result.info).toContain('3号');
    });

    it('狼人刀机械狼：机械狼死亡（队友可刀）', async () => {
      ctx = await createHostGame(TEMPLATE_NAME, createRoleAssignment());

      const result = await ctx.runNight({
        guard: 0,
        wolfRobot: null,
        wolf: 7, // 狼人刀机械狼（非参会狼不互知）
        witch: null,
        psychic: null,
        hunter: null,
      });

      expect(result.completed).toBe(true);
      expect(result.deaths).toEqual([7]);
    });

    it('守卫守机械狼 + 狼刀机械狼：平安夜', async () => {
      ctx = await createHostGame(TEMPLATE_NAME, createRoleAssignment());

      const result = await ctx.runNight({
        guard: 7, // 守卫守机械狼
        wolfRobot: null,
        wolf: 7, // 狼人刀机械狼
        witch: null,
        psychic: null,
        hunter: null,
      });

      expect(result.completed).toBe(true);
      expect(result.deaths).toEqual([]);
      expect(result.info).toContain('平安夜');
    });

    it('同守同救必死：守卫守 + 女巫救同一目标', async () => {
      ctx = await createHostGame(TEMPLATE_NAME, createRoleAssignment());

      const result = await ctx.runNight({
        guard: 0, // 守卫守 0 号
        wolfRobot: null,
        wolf: 0, // 狼人杀 0 号
        witch: 0, // 女巫救 0 号
        psychic: null,
        hunter: null,
      });

      expect(result.completed).toBe(true);
      // 同守同救必死规则
      expect(result.deaths).toContain(0);
    });

    it('狼人刀通灵师：通灵师死亡', async () => {
      ctx = await createHostGame(TEMPLATE_NAME, createRoleAssignment());

      const result = await ctx.runNight({
        guard: 0,
        wolfRobot: null,
        wolf: 8, // 狼人杀通灵师
        witch: null,
        psychic: null,
        hunter: null,
      });

      expect(result.completed).toBe(true);
      expect(result.deaths).toEqual([8]);
    });

    it('女巫毒守卫：守卫死亡，守护仍生效', async () => {
      ctx = await createHostGame(TEMPLATE_NAME, createRoleAssignment());

      const result = await ctx.runNight({
        guard: 0, // 守卫守 0 号
        wolfRobot: null,
        wolf: 0, // 狼人杀 0 号
        witch: null,
        witchPoison: 11, // 女巫毒守卫
        psychic: null,
        hunter: null,
      });

      expect(result.completed).toBe(true);
      // 守卫被毒，但守护仍生效，0 号不死
      expect(result.deaths).toEqual([11]);
    });
  });

  describe('Private Reveal 存在性锁', () => {
    it('机械狼查验触发 WOLF_ROBOT_REVEAL 私信', async () => {
      ctx = await createHostGame(TEMPLATE_NAME, createRoleAssignment());

      await ctx.runNight({
        guard: 0,
        wolfRobot: 2, // 机械狼查 2 号（村民）
        wolf: 0,
        witch: null,
        psychic: null,
        hunter: null,
      });

      // 验证 WOLF_ROBOT_REVEAL 私信被发送
      const wolfRobotRevealCalls = mockSendPrivate.mock.calls.filter(
        (call: unknown[]) =>
          (call[0] as { type: string }).type === 'PRIVATE_EFFECT' &&
          (call[0] as { payload?: { kind: string } }).payload?.kind === 'WOLF_ROBOT_REVEAL',
      );
      expect(wolfRobotRevealCalls.length).toBe(1);
      expect(wolfRobotRevealCalls[0][0]).toMatchObject({
        type: 'PRIVATE_EFFECT',
        payload: {
          kind: 'WOLF_ROBOT_REVEAL',
          targetSeat: 2,
        },
      });
    });

    // NOTE: psychic 查验第一夜无死者，不会触发 reveal
    // 这里测试结构性验证 - psychic 查验会触发私信（如果有死者）
    it('通灵师在有死者时触发 PSYCHIC_REVEAL 私信（第一夜验证）', async () => {
      // 第一夜死者：0 号被杀
      ctx = await createHostGame(TEMPLATE_NAME, createRoleAssignment());

      await ctx.runNight({
        guard: 8, // 守卫守通灵师
        wolfRobot: null,
        wolf: 0, // 狼人杀 0 号（村民）
        witch: null,
        psychic: 0, // 通灵师查 0 号（本夜被杀的村民）
        hunter: null,
      });

      // 验证 PSYCHIC_REVEAL 私信被发送
      const psychicRevealCalls = mockSendPrivate.mock.calls.filter(
        (call: unknown[]) =>
          (call[0] as { type: string }).type === 'PRIVATE_EFFECT' &&
          (call[0] as { payload?: { kind: string } }).payload?.kind === 'PSYCHIC_REVEAL',
      );
      expect(psychicRevealCalls.length).toBe(1);
      expect(psychicRevealCalls[0][0]).toMatchObject({
        type: 'PRIVATE_EFFECT',
        payload: {
          kind: 'PSYCHIC_REVEAL',
          targetSeat: 0,
          result: '普通村民', // 查验到村民（displayName）
        },
      });
    });
  });
});
