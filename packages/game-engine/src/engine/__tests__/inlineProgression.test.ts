/**
 * inlineProgression.test.ts
 *
 * Tests for runInlineProgression — 服务端内联推进纯函数
 *
 * 测试策略：
 * - 构建已完成 action 的 GameState
 * - 调用 runInlineProgression 验证：推进步数、audioEffects、finalState
 */

import type { GameState } from '@werewolf/game-engine';
import { GameStatus, runInlineProgression } from '@werewolf/game-engine';
import { buildNightPlan } from '@werewolf/game-engine/models/roles/spec/plan';

// =============================================================================
// Test Helpers
// =============================================================================

const TEMPLATE_2P: GameState['templateRoles'] = ['wolf', 'villager'];
const TEMPLATE_5P: GameState['templateRoles'] = ['wolf', 'wolf', 'seer', 'witch', 'villager'];

function make2PlayerState(overrides: Partial<GameState> = {}): GameState {
  const plan = buildNightPlan(TEMPLATE_2P);
  const firstStep = plan.steps[0];
  return {
    roomCode: 'TEST',
    hostUid: 'host',
    status: GameStatus.Ongoing,
    templateRoles: TEMPLATE_2P,
    players: {
      0: { uid: 'p0', seatNumber: 0, hasViewedRole: true, role: 'wolf' },
      1: { uid: 'p1', seatNumber: 1, hasViewedRole: true, role: 'villager' },
    },
    currentStepIndex: 0,
    currentStepId: firstStep?.stepId,
    isAudioPlaying: false,
    actions: [],
    pendingRevealAcks: [],
    ...overrides,
  };
}

function make5PlayerState(overrides: Partial<GameState> = {}): GameState {
  const plan = buildNightPlan(TEMPLATE_5P);
  const firstStep = plan.steps[0];
  return {
    roomCode: 'TEST',
    hostUid: 'host',
    status: GameStatus.Ongoing,
    templateRoles: TEMPLATE_5P,
    players: {
      0: { uid: 'p0', seatNumber: 0, hasViewedRole: true, role: 'wolf' },
      1: { uid: 'p1', seatNumber: 1, hasViewedRole: true, role: 'wolf' },
      2: { uid: 'p2', seatNumber: 2, hasViewedRole: true, role: 'seer' },
      3: { uid: 'p3', seatNumber: 3, hasViewedRole: true, role: 'witch' },
      4: { uid: 'p4', seatNumber: 4, hasViewedRole: true, role: 'villager' },
    },
    currentStepIndex: 0,
    currentStepId: firstStep?.stepId,
    isAudioPlaying: false,
    actions: [],
    pendingRevealAcks: [],
    ...overrides,
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('runInlineProgression', () => {
  describe('不推进的情况', () => {
    it('status !== ongoing → stepsAdvanced=0', () => {
      const state = make2PlayerState({ status: GameStatus.Ended });
      const result = runInlineProgression(state, 'host');
      expect(result.stepsAdvanced).toBe(0);
      expect(result.audioEffects).toEqual([]);
      expect(result.actions).toEqual([]);
    });

    it('isAudioPlaying=true → stepsAdvanced=0', () => {
      const state = make2PlayerState({ isAudioPlaying: true });
      const result = runInlineProgression(state, 'host');
      expect(result.stepsAdvanced).toBe(0);
    });

    it('pendingRevealAcks 非空 → stepsAdvanced=0', () => {
      const state = make2PlayerState({
        pendingRevealAcks: ['seer:host'],
        currentNightResults: {
          wolfVotesBySeat: { '0': 1 },
        },
        actions: [{ schemaId: 'wolfKill', actorSeat: 0, timestamp: 1 }],
      });
      const result = runInlineProgression(state, 'host');
      expect(result.stepsAdvanced).toBe(0);
    });

    it('wolfKill step 未全部投票 → stepsAdvanced=0', () => {
      const state = make2PlayerState({
        currentStepId: 'wolfKill',
        currentNightResults: {}, // 没有 wolfVotes
      });
      const result = runInlineProgression(state, 'host');
      expect(result.stepsAdvanced).toBe(0);
    });

    it('wolfKill countdown 未到期 → stepsAdvanced=0', () => {
      const state = make2PlayerState({
        currentStepId: 'wolfKill',
        currentNightResults: {
          wolfVotesBySeat: { '0': 1 },
        },
        wolfVoteDeadline: Date.now() + 10000, // 10s in future
      });
      const result = runInlineProgression(state, 'host', Date.now());
      expect(result.stepsAdvanced).toBe(0);
    });

    it('wolfKill countdown 已过期 → should advance', () => {
      const now = Date.now();
      const state = make2PlayerState({
        currentStepId: 'wolfKill',
        currentStepIndex: 0,
        currentNightResults: {
          wolfVotesBySeat: { '0': 1 },
        },
        wolfVoteDeadline: now - 1000, // 1s in the past
      });
      const result = runInlineProgression(state, 'host', now);
      expect(result.stepsAdvanced).toBeGreaterThanOrEqual(1);
    });
  });

  describe('2-player template (wolf + villager)', () => {
    it('wolfKill 完成 → advance to end → endNight (产生 audioEffects)', () => {
      // In 2-player template, only step is wolfKill.
      // When wolf vote is complete (and no countdown), should advance past wolfKill → endNight
      const state = make2PlayerState({
        currentStepId: 'wolfKill',
        currentStepIndex: 0,
        currentNightResults: {
          wolfVotesBySeat: { '0': 1 },
        },
      });

      const result = runInlineProgression(state, 'host');

      // Should have advanced at least once (advance) + end_night
      expect(result.stepsAdvanced).toBeGreaterThanOrEqual(1);
      expect(result.audioEffects.length).toBeGreaterThan(0);
      // Final state should be GameStatus.Ended
      expect(result.finalState.status).toBe(GameStatus.Ended);
      // Should have SET_PENDING_AUDIO_EFFECTS + SET_AUDIO_PLAYING in actions
      const hasPendingAudio = result.actions.some((a) => a.type === 'SET_PENDING_AUDIO_EFFECTS');
      expect(hasPendingAudio).toBe(true);
    });
  });

  describe('5-player template (wolf*2 + seer + witch + villager)', () => {
    it('wolfKill 全投完 → advance 到 witchAction (不 endNight)', () => {
      const plan = buildNightPlan(TEMPLATE_5P);
      // wolfKill is always the first step
      const wolfIdx = plan.steps.findIndex((s) => s.stepId === 'wolfKill');
      expect(wolfIdx).toBeGreaterThanOrEqual(0);

      const state = make5PlayerState({
        currentStepIndex: wolfIdx,
        currentStepId: 'wolfKill',
        currentNightResults: {
          wolfVotesBySeat: { '0': 4, '1': 4 },
        },
      });

      const result = runInlineProgression(state, 'host');

      // Should advance once (wolfKill → witchAction)
      expect(result.stepsAdvanced).toBeGreaterThanOrEqual(1);
      // Should NOT end night (witch + seer still need to act)
      expect(result.finalState.status).toBe(GameStatus.Ongoing);
      // Audio effects from advance
      expect(result.audioEffects.length).toBeGreaterThan(0);
    });
  });

  describe('audioEffects 收集', () => {
    it('advance 产生结束 + 开始音频', () => {
      const plan = buildNightPlan(TEMPLATE_5P);
      const wolfIdx = plan.steps.findIndex((s) => s.stepId === 'wolfKill');
      expect(wolfIdx).toBeGreaterThanOrEqual(0);

      const state = make5PlayerState({
        currentStepIndex: wolfIdx,
        currentStepId: 'wolfKill',
        currentNightResults: {
          wolfVotesBySeat: { '0': 4, '1': 4 },
        },
      });

      const result = runInlineProgression(state, 'host');
      // Each advance step produces: current step end audio + next step begin audio
      // At least 1 end + 1 begin
      const endAudios = result.audioEffects.filter((e) => e.isEndAudio === true);
      const beginAudios = result.audioEffects.filter((e) => !e.isEndAudio);
      expect(endAudios.length).toBeGreaterThanOrEqual(1);
      expect(beginAudios.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('底牌空步骤 autoSkipDeadline', () => {
    /**
     * Scenario: treasureMaster chose 'seer', and there's a 'poisoner' in bottom cards.
     * When poisoner's step is current & no player has that role → vacant step.
     * runInlineProgression should set autoSkipDeadline and NOT advance immediately.
     */
    it('should set autoSkipDeadline for vacant bottom card step instead of instant advance', () => {
      // Template includes treasureMaster + seer + poisoner (poisoner also in bottom cards)
      const templateRoles = ['treasureMaster', 'wolf', 'seer', 'poisoner', 'villager'] as const;
      const plan = buildNightPlan(templateRoles);
      const poisonerIdx = plan.steps.findIndex((s) => s.stepId === 'poisonerPoison');
      expect(poisonerIdx).toBeGreaterThanOrEqual(0);

      const nowMs = Date.now();
      const state: GameState = {
        roomCode: 'TEST',
        hostUid: 'host',
        status: GameStatus.Ongoing,
        templateRoles: [...templateRoles],
        players: {
          // No player has 'poisoner' role — it's in bottom cards
          0: { uid: 'p0', seatNumber: 0, hasViewedRole: true, role: 'treasureMaster' },
          1: { uid: 'p1', seatNumber: 1, hasViewedRole: true, role: 'wolf' },
          2: { uid: 'p2', seatNumber: 2, hasViewedRole: true, role: 'seer' },
          3: { uid: 'p3', seatNumber: 3, hasViewedRole: true, role: 'villager' },
        },
        currentStepIndex: poisonerIdx,
        currentStepId: 'poisonerPoison',
        isAudioPlaying: false,
        actions: [],
        pendingRevealAcks: [],
        treasureMasterChosenCard: 'seer',
        bottomCardStepRoles: ['poisoner', 'wolf', 'villager'],
        treasureMasterSeat: 0,
      };

      const result = runInlineProgression(state, 'host', nowMs);

      // Should NOT advance past this step (deadline is in the future)
      expect(result.stepsAdvanced).toBe(0);
      // autoSkipDeadline should be set
      expect(result.finalState.autoSkipDeadline).toBeDefined();
      expect(result.finalState.autoSkipDeadline!).toBeGreaterThanOrEqual(nowMs + 5000);
      expect(result.finalState.autoSkipDeadline!).toBeLessThanOrEqual(nowMs + 10000);
    });

    it('should advance vacant step when autoSkipDeadline has passed', () => {
      const templateRoles = ['treasureMaster', 'wolf', 'seer', 'poisoner', 'villager'] as const;
      const plan = buildNightPlan(templateRoles);
      const poisonerIdx = plan.steps.findIndex((s) => s.stepId === 'poisonerPoison');
      expect(poisonerIdx).toBeGreaterThanOrEqual(0);

      const nowMs = Date.now();
      const state: GameState = {
        roomCode: 'TEST',
        hostUid: 'host',
        status: GameStatus.Ongoing,
        templateRoles: [...templateRoles],
        players: {
          0: { uid: 'p0', seatNumber: 0, hasViewedRole: true, role: 'treasureMaster' },
          1: { uid: 'p1', seatNumber: 1, hasViewedRole: true, role: 'wolf' },
          2: { uid: 'p2', seatNumber: 2, hasViewedRole: true, role: 'seer' },
          3: { uid: 'p3', seatNumber: 3, hasViewedRole: true, role: 'villager' },
        },
        currentStepIndex: poisonerIdx,
        currentStepId: 'poisonerPoison',
        isAudioPlaying: false,
        actions: [],
        pendingRevealAcks: [],
        treasureMasterChosenCard: 'seer',
        bottomCardStepRoles: ['poisoner', 'wolf', 'villager'],
        treasureMasterSeat: 0,
        // Deadline already passed
        autoSkipDeadline: nowMs - 1000,
      };

      const result = runInlineProgression(state, 'host', nowMs);

      // Should advance past the vacant step
      expect(result.stepsAdvanced).toBeGreaterThanOrEqual(1);
      // autoSkipDeadline should be cleared (advance clears it)
      expect(result.finalState.currentStepId).not.toBe('poisonerPoison');
    });
  });
});
