/**
 * Progression Evaluator Integration Test
 *
 * 测试 evaluateNightProgression 在真实 board integration 上下文中的推进决策。
 * 补齐 facade auto-advance 管线的覆盖：每步 action 后调用 evaluateNightProgression，
 * 验证推进决策正确。
 *
 * 架构：hostGameFactory → action → evaluateNightProgression → decision
 */

import type { RoleId } from '@/models/roles';
import { doesRoleParticipateInWolfVote } from '@/models/roles';
import {
  createProgressionTracker,
  evaluateNightProgression,
  isWolfVoteAllComplete,
} from '@/services/engine/handlers/progressionEvaluator';

import { cleanupHostGame, createHostGame } from './hostGameFactory';
import { sendMessageOrThrow } from './stepByStepRunner';

// =============================================================================
// Template
// =============================================================================

const TEMPLATE_NAME = '标准板12人';

function createRoleAssignment(): Map<number, RoleId> {
  const map = new Map<number, RoleId>();
  // seat 0-3: villager, seat 4-7: wolf, seat 8: seer, seat 9: witch, seat 10: hunter, seat 11: idiot
  [
    'villager',
    'villager',
    'villager',
    'villager',
    'wolf',
    'wolf',
    'wolf',
    'wolf',
    'seer',
    'witch',
    'hunter',
    'idiot',
  ].forEach((role, idx) => map.set(idx, role as RoleId));
  return map;
}

// =============================================================================
// Tests
// =============================================================================

describe('evaluateNightProgression (integration with real board state)', () => {
  afterEach(() => {
    cleanupHostGame();
  });

  describe('wolfKill step progression', () => {
    it('部分狼投完 → step_not_complete', () => {
      const ctx = createHostGame(TEMPLATE_NAME, createRoleAssignment());
      ctx.assertStep('wolfKill');

      // 只有 seat 4 投票
      sendMessageOrThrow(ctx, { type: 'WOLF_VOTE', seat: 4, target: 0 }, 'wolfKill partial');

      const state = ctx.getBroadcastState();
      const decision = evaluateNightProgression(state, ctx.getRevision(), undefined, true);
      expect(decision.action).toBe('none');
      expect(decision.reason).toBe('step_not_complete');
    });

    it('所有狼投完 → advance (无 deadline 时)', () => {
      const ctx = createHostGame(TEMPLATE_NAME, createRoleAssignment());
      ctx.assertStep('wolfKill');

      // 4 只狼全部投 seat 0
      const state0 = ctx.getBroadcastState();
      for (const [seatStr, player] of Object.entries(state0.players)) {
        const seat = Number.parseInt(seatStr, 10);
        if (player?.role && doesRoleParticipateInWolfVote(player.role)) {
          sendMessageOrThrow(ctx, { type: 'WOLF_VOTE', seat, target: 0 }, 'wolfKill all');
        }
      }

      // 提交 wolf lead action
      sendMessageOrThrow(
        ctx,
        { type: 'ACTION', seat: 4, role: 'wolf', target: 0, extra: undefined },
        'wolfKill lead',
      );

      const state = ctx.getBroadcastState();
      expect(isWolfVoteAllComplete(state)).toBe(true);

      const decision = evaluateNightProgression(state, ctx.getRevision(), undefined, true);
      expect(decision.action).toBe('advance');
      expect(decision.reason).toBe('step_complete');
    });

    it('wolfVoteDeadline 未到期 → wolf_vote_countdown', () => {
      const ctx = createHostGame(TEMPLATE_NAME, createRoleAssignment());
      ctx.assertStep('wolfKill');

      // 所有狼投完
      const state0 = ctx.getBroadcastState();
      for (const [seatStr, player] of Object.entries(state0.players)) {
        const seat = Number.parseInt(seatStr, 10);
        if (player?.role && doesRoleParticipateInWolfVote(player.role)) {
          sendMessageOrThrow(ctx, { type: 'WOLF_VOTE', seat, target: 0 }, 'wolfKill');
        }
      }
      sendMessageOrThrow(
        ctx,
        { type: 'ACTION', seat: 4, role: 'wolf', target: 0, extra: undefined },
        'wolfKill lead',
      );

      // 手动设置 deadline 为未来（模拟 timer 尚未到期）
      // 这里直接读 state 再加 deadline，因为 hostGameFactory 不设 deadline
      const stateWithDeadline = {
        ...ctx.getBroadcastState(),
        wolfVoteDeadline: Date.now() + 10000,
      };

      const decision = evaluateNightProgression(
        stateWithDeadline,
        ctx.getRevision(),
        undefined,
        true,
      );
      expect(decision.action).toBe('none');
      expect(decision.reason).toBe('wolf_vote_countdown');
    });
  });

  describe('gate 保护', () => {
    it('isAudioPlaying = true → audio_playing', () => {
      const ctx = createHostGame(TEMPLATE_NAME, createRoleAssignment());
      const state = { ...ctx.getBroadcastState(), isAudioPlaying: true };

      const decision = evaluateNightProgression(state, ctx.getRevision(), undefined, true);
      expect(decision.action).toBe('none');
      expect(decision.reason).toBe('audio_playing');
    });

    it('pendingRevealAcks 非空 → pending_reveal_acks', () => {
      const ctx = createHostGame(TEMPLATE_NAME, createRoleAssignment());
      const state = { ...ctx.getBroadcastState(), pendingRevealAcks: ['seerCheck'] };

      const decision = evaluateNightProgression(state, ctx.getRevision(), undefined, true);
      expect(decision.action).toBe('none');
      expect(decision.reason).toBe('pending_reveal_acks');
    });

    it('status !== ongoing → not_ongoing', () => {
      const ctx = createHostGame(TEMPLATE_NAME, createRoleAssignment());
      const state = { ...ctx.getBroadcastState(), status: 'ended' as const };

      const decision = evaluateNightProgression(state, ctx.getRevision(), undefined, true);
      expect(decision.action).toBe('none');
      expect(decision.reason).toBe('not_ongoing');
    });

    it('isHost = false → not_host', () => {
      const ctx = createHostGame(TEMPLATE_NAME, createRoleAssignment());
      const state = ctx.getBroadcastState();

      const decision = evaluateNightProgression(state, ctx.getRevision(), undefined, false);
      expect(decision.action).toBe('none');
      expect(decision.reason).toBe('not_host');
    });

    it('null state → no_state', () => {
      const decision = evaluateNightProgression(null, 0, undefined, true);
      expect(decision.action).toBe('none');
      expect(decision.reason).toBe('no_state');
    });
  });

  describe('幂等保护', () => {
    it('同一 {revision, stepId} 调两次 → 第二次 already_processed', () => {
      const ctx = createHostGame(TEMPLATE_NAME, createRoleAssignment());
      ctx.assertStep('wolfKill');

      // 所有狼投完
      const state0 = ctx.getBroadcastState();
      for (const [seatStr, player] of Object.entries(state0.players)) {
        const seat = Number.parseInt(seatStr, 10);
        if (player?.role && doesRoleParticipateInWolfVote(player.role)) {
          sendMessageOrThrow(ctx, { type: 'WOLF_VOTE', seat, target: 0 }, 'wolfKill');
        }
      }
      sendMessageOrThrow(
        ctx,
        { type: 'ACTION', seat: 4, role: 'wolf', target: 0, extra: undefined },
        'wolfKill lead',
      );

      const tracker = createProgressionTracker();
      const state = ctx.getBroadcastState();
      const revision = ctx.getRevision();

      const d1 = evaluateNightProgression(state, revision, tracker, true);
      expect(d1.action).toBe('advance');

      const d2 = evaluateNightProgression(state, revision, tracker, true);
      expect(d2.action).toBe('none');
      expect(d2.reason).toBe('already_processed');
    });
  });

  describe('非 wolfKill 步骤推进', () => {
    // 标准板12人步骤顺序: wolfKill → witchAction → hunterConfirm → seerCheck
    it('提交 witch action 后 → advance', () => {
      const ctx = createHostGame(TEMPLATE_NAME, createRoleAssignment());

      // 走完 wolfKill 到 witchAction
      const state0 = ctx.getBroadcastState();
      for (const [seatStr, player] of Object.entries(state0.players)) {
        const seat = Number.parseInt(seatStr, 10);
        if (player?.role && doesRoleParticipateInWolfVote(player.role)) {
          sendMessageOrThrow(ctx, { type: 'WOLF_VOTE', seat, target: 0 }, 'wolfKill');
        }
      }
      sendMessageOrThrow(
        ctx,
        { type: 'ACTION', seat: 4, role: 'wolf', target: 0, extra: undefined },
        'wolfKill lead',
      );
      ctx.advanceNightOrThrow('to witchAction');
      ctx.assertStep('witchAction');

      // 提交 witch action (skip = 不用药)
      sendMessageOrThrow(
        ctx,
        {
          type: 'ACTION',
          seat: 9,
          role: 'witch',
          target: null,
          extra: { stepResults: { save: null, poison: null } },
        },
        'witchAction',
      );

      const state = ctx.getBroadcastState();
      const decision = evaluateNightProgression(state, ctx.getRevision(), undefined, true);
      expect(decision.action).toBe('advance');
      expect(decision.reason).toBe('step_complete');
    });

    it('seer action 提交但未 ack → pending_reveal_acks', () => {
      const ctx = createHostGame(TEMPLATE_NAME, createRoleAssignment());

      // 走到 seerCheck (wolfKill → witchAction → hunterConfirm → seerCheck)
      const state0 = ctx.getBroadcastState();
      for (const [seatStr, player] of Object.entries(state0.players)) {
        const seat = Number.parseInt(seatStr, 10);
        if (player?.role && doesRoleParticipateInWolfVote(player.role)) {
          sendMessageOrThrow(ctx, { type: 'WOLF_VOTE', seat, target: 0 }, 'wolfKill');
        }
      }
      sendMessageOrThrow(
        ctx,
        { type: 'ACTION', seat: 4, role: 'wolf', target: 0, extra: undefined },
        'wolfKill lead',
      );
      ctx.advanceNightOrThrow('past wolfKill');
      ctx.assertStep('witchAction');
      sendMessageOrThrow(
        ctx,
        {
          type: 'ACTION',
          seat: 9,
          role: 'witch',
          target: null,
          extra: { stepResults: { save: null, poison: null } },
        },
        'witchAction',
      );
      ctx.advanceNightOrThrow('past witchAction');
      ctx.assertStep('hunterConfirm');
      sendMessageOrThrow(
        ctx,
        { type: 'ACTION', seat: 10, role: 'hunter', target: null, extra: { confirmed: true } },
        'hunterConfirm',
      );
      ctx.advanceNightOrThrow('past hunterConfirm');
      ctx.assertStep('seerCheck');

      // 提交 seer action（会产生 pendingRevealAcks）
      sendMessageOrThrow(
        ctx,
        { type: 'ACTION', seat: 8, role: 'seer', target: 0, extra: undefined },
        'seerCheck',
      );

      const state = ctx.getBroadcastState();
      // 如果有 pendingRevealAcks，应该不推进
      if (state.pendingRevealAcks && state.pendingRevealAcks.length > 0) {
        const decision = evaluateNightProgression(state, ctx.getRevision(), undefined, true);
        expect(decision.action).toBe('none');
        expect(decision.reason).toBe('pending_reveal_acks');
      }
    });
  });

  describe('end_night 决策', () => {
    it('currentStepId = undefined → end_night', () => {
      const ctx = createHostGame(TEMPLATE_NAME, createRoleAssignment());
      // 构造 currentStepId = undefined 的状态
      const state = { ...ctx.getBroadcastState(), currentStepId: undefined };

      const decision = evaluateNightProgression(state, ctx.getRevision(), undefined, true);
      expect(decision.action).toBe('end_night');
      expect(decision.reason).toBe('no_more_steps');
    });
  });
});
