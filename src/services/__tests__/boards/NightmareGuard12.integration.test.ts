/**
 * 梦魇守卫12人 - Host Runtime Integration Tests
 *
 * 角色配置：4村民 + 3狼人 + 梦魇 + 预言家 + 女巫 + 猎人 + 守卫
 * 行动顺序：nightmare(2) → guard(3) → wolf(5) → witch(10) → seer(15) → hunter(20)
 *
 * 梦魇特性：
 * - 每晚可以封锁一名玩家的技能
 * - 被封锁的玩家当晚技能无效
 * - 梦魇是狼人阵营（技能狼）
 */

import { createHostGame, cleanupHostGame, HostGameContext } from './hostGameFactory';
import { NightPhase, NightEvent } from '../../NightFlowController';
import { RoleName } from '../../../models/roles';

const TEMPLATE_NAME = '梦魇守卫12人';

const createRoleAssignment = (): Map<number, RoleName> => {
  const assignment = new Map<number, RoleName>();
  assignment.set(0, 'villager');
  assignment.set(1, 'villager');
  assignment.set(2, 'villager');
  assignment.set(3, 'villager');
  assignment.set(4, 'wolf');
  assignment.set(5, 'wolf');
  assignment.set(6, 'wolf');
  assignment.set(7, 'nightmare');
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
        nightmare: 0, // 梦魇封锁0号（村民，无技能）
        wolf: 1,
        witch: null,
        seer: 4,
        hunter: null,
      });

      expect(result.completed).toBe(true);
      expect(result.deaths).toEqual([1]);
      expect(result.info).toContain('2号');
    });

    it('守卫保护：狼刀目标被守不死', async () => {
      ctx = await createHostGame(TEMPLATE_NAME, createRoleAssignment());

      const result = await ctx.runNight({
        guard: 0, // 守座位0
        nightmare: 1,
        wolf: 0,  // 狼刀座位0
        witch: null,
        seer: 4,
        hunter: null,
      });

      expect(result.completed).toBe(true);
      expect(result.deaths).toEqual([]);
      expect(result.info).toContain('平安夜');
    });
  });

  // DeathCalculator 封锁规则单测已迁移到 src/services/__tests__/DeathCalculator.test.ts
  // 这里只保留 Host Authoritative Gate 的 integration 测试

  describe('Host Authoritative Gate: 被封锁玩家 action 被拒绝', () => {
    /**
     * 验证 Host authoritative gate：
     * 当 seat 被梦魇封锁时，Host 对该 seat 发来的 action 必须 idempotent no-op，
     * 且不记录 action、不推进夜晚流程、不产生副作用。
     * 
     * 使用 GameStateService.__testOnly__simulatePlayerMessage() 模拟真实的玩家消息路径。
     * 行动顺序从 roles registry 派生：nightmare(2) → guard(3) → wolf(5) → ...
     * 
     * 注意：submitAction() 会同时推进测试工厂的 nightFlow 和 service 内部状态，
     * 所以我们用 submitAction 完成 nightmare 行动后，nightFlow 会自动进入 guard 阶段。
     */

    it('blocked seat 的非空 target 被拒绝（不记录 action，不推进流程）', async () => {
      ctx = await createHostGame(TEMPLATE_NAME, createRoleAssignment());
      const service = ctx.service;
      const state = ctx.getState()!;
      const nightFlow = ctx.getNightFlow()!;

      // 1. nightmare 封锁守卫（seat 11）- submitAction 会推进到 guard 阶段
      await ctx.submitAction(11);

      // 验证 nightmare action 已记录
      const nightmareAction = state.actions.get('nightmare');
      expect(nightmareAction?.kind).toBe('target');
      if (nightmareAction?.kind === 'target') {
        expect(nightmareAction.targetSeat).toBe(11);
      }

      // 2. submitAction 会推进 nightFlow 到下一个角色的 RoleBeginAudio 阶段
      // 我们需要再派发 RoleBeginAudioDone 来进入 WaitingForAction
      if (nightFlow.phase === NightPhase.RoleBeginAudio) {
        nightFlow.dispatch(NightEvent.RoleBeginAudioDone);
      }

      // 3. 现在是 guard 的回合，且在 WaitingForAction 阶段
      expect(nightFlow.currentRole).toBe('guard');
      expect(nightFlow.phase).toBe(NightPhase.WaitingForAction);
      const guardActionBefore = state.actions.get('guard');
      expect(guardActionBefore).toBeUndefined();

      // 4. 模拟被封锁的守卫发送非空 target 的 action
      await (service as any).handlePlayerAction(11, 'guard', 0);

      // 5. 验证：action 没有被记录（被 nightmare gate 拦截）
      const guardActionAfter = state.actions.get('guard');
      expect(guardActionAfter).toBeUndefined();

      // 6. 验证：nightFlow 没有被推进（currentRole 和 phase 保持不变）
      expect(nightFlow.currentRole).toBe('guard');
      expect(nightFlow.phase).toBe(NightPhase.WaitingForAction);
    });

    it('blocked seat 的 skip（target=null）允许推进流程', async () => {
      ctx = await createHostGame(TEMPLATE_NAME, createRoleAssignment());
      const state = ctx.getState()!;
      const nightFlow = ctx.getNightFlow()!;

      // 1. nightmare 封锁守卫（seat 11）
      await ctx.submitAction(11);

      // 2. submitAction 会推进 nightFlow 到下一个角色的 RoleBeginAudio 阶段
      // 我们需要再派发 RoleBeginAudioDone 来进入 WaitingForAction
      if (nightFlow.phase === NightPhase.RoleBeginAudio) {
        nightFlow.dispatch(NightEvent.RoleBeginAudioDone);
      }

      // 3. 现在是 guard 的回合，且在 WaitingForAction 阶段
      expect(nightFlow.currentRole).toBe('guard');
      expect(nightFlow.phase).toBe(NightPhase.WaitingForAction);

      // 4. 被封锁的守卫提交 skip（通过 handlePlayerAction）
      // target=null, extra=undefined 是允许的 skip
      await (ctx.service as any).handlePlayerAction(11, 'guard', null, undefined);

      // 5. 验证：guard action 没有被记录（skip 不记录 action）
      const guardActionAfter = state.actions.get('guard');
      expect(guardActionAfter).toBeUndefined();

      // 6. 验证：流程推进到下一个角色（wolf）
      // handlePlayerAction 完整流程：
      //   - dispatch ActionSubmitted → phase: RoleEndAudio
      //   - advanceToNextAction → dispatch RoleEndAudioDone → advance to wolf, phase: RoleBeginAudio
      //   - playCurrentRoleAudio → dispatch RoleBeginAudioDone → phase: WaitingForAction
      // 所以最终状态是 wolf 的 WaitingForAction 阶段
      expect(nightFlow.currentRole).toBe('wolf');
      expect(nightFlow.phase).toBe(NightPhase.WaitingForAction);
    });

    it('blocked seat 的 target=null 但带 extra 也必须 no-op（防止 extra 绕过）', async () => {
      ctx = await createHostGame(TEMPLATE_NAME, createRoleAssignment());
      const state = ctx.getState()!;
      const nightFlow = ctx.getNightFlow()!;

      // 1. nightmare 封锁守卫（seat 11）
      await ctx.submitAction(11);

      // 2. submitAction 会推进 nightFlow 到下一个角色的 RoleBeginAudio 阶段
      // 我们需要再派发 RoleBeginAudioDone 来进入 WaitingForAction
      if (nightFlow.phase === NightPhase.RoleBeginAudio) {
        nightFlow.dispatch(NightEvent.RoleBeginAudioDone);
      }

      // 3. 现在是 guard 的回合，且在 WaitingForAction 阶段
      expect(nightFlow.currentRole).toBe('guard');
      expect(nightFlow.phase).toBe(NightPhase.WaitingForAction);

      // 4. 模拟恶意 payload：target=null 但带 extra
      await (ctx.service as any).handlePlayerAction(11, 'guard', null, { malicious: 'payload' });

      // 5. 验证：action 没有被记录
      const guardActionAfter = state.actions.get('guard');
      expect(guardActionAfter).toBeUndefined();

      // 6. 验证：nightFlow 没有被推进（被 gate 拦截）
      expect(nightFlow.currentRole).toBe('guard');
      expect(nightFlow.phase).toBe(NightPhase.WaitingForAction);
    });
  });
});

// DeathCalculator unit tests for Nightmare Block are in src/services/__tests__/DeathCalculator.test.ts
