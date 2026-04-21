/**
 * uiHint Unit Tests
 *
 * Covers: maybeCreateUiHintAction
 */

import type { NightPlanStep } from '../../../models';
import { GameStatus } from '../../../models/GameStatus';
import type { NonNullState } from '../types';
import { maybeCreateUiHintAction } from '../uiHint';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function step(roleId: string, stepId: string, order = 0): NightPlanStep {
  return { roleId, stepId, order, displayName: roleId, audioKey: roleId } as NightPlanStep;
}

function createMinimalState(overrides?: Partial<NonNullState>): NonNullState {
  return {
    roomCode: 'TEST',
    hostUserId: 'host-1',
    status: GameStatus.Ongoing,
    templateRoles: ['wolf', 'seer', 'villager'],
    players: {
      0: { userId: 'p0', seat: 0, displayName: 'P0', role: 'seer', hasViewedRole: true },
      1: { userId: 'p1', seat: 1, displayName: 'P1', role: 'wolf', hasViewedRole: true },
      2: { userId: 'p2', seat: 2, displayName: 'P2', role: 'villager', hasViewedRole: true },
    },
    currentStepIndex: 0,
    isAudioPlaying: false,
    actions: [],
    pendingRevealAcks: [],
    ...overrides,
  } as NonNullState;
}

// =============================================================================
// maybeCreateUiHintAction
// =============================================================================

describe('maybeCreateUiHintAction', () => {
  it('should clear hint when nextStep is null (night ends)', () => {
    const state = createMinimalState();
    const action = maybeCreateUiHintAction(null, state);
    expect(action.type).toBe('SET_UI_HINT');
    expect(action.payload.currentActorHint).toBeNull();
  });

  it('should clear hint for normal step without block or override', () => {
    const state = createMinimalState();
    const action = maybeCreateUiHintAction(step('seer', 'seerCheck', 1), state);
    expect(action.payload.currentActorHint).toBeNull();
  });

  it('should set blocked_by_nightmare when next actor is blocked', () => {
    const state = createMinimalState({ nightmareBlockedSeat: 0 } as Partial<NonNullState>);
    const nextStep = step('seer', 'seerCheck', 1);
    const action = maybeCreateUiHintAction(nextStep, state);
    expect(action.payload.currentActorHint).not.toBeNull();
    expect(action.payload.currentActorHint!.kind).toBe('blocked_by_nightmare');
    expect(action.payload.currentActorHint!.targetRoleIds).toEqual(['seer']);
    expect(action.payload.currentActorHint!.bottomAction).toBe('skipOnly');
  });

  it('should not set blocked hint when a different seat is blocked', () => {
    // seat 2 is blocked, but next actor (seer) is at seat 0
    const state = createMinimalState({ nightmareBlockedSeat: 2 } as Partial<NonNullState>);
    const nextStep = step('seer', 'seerCheck', 1);
    const action = maybeCreateUiHintAction(nextStep, state);
    expect(action.payload.currentActorHint).toBeNull();
  });

  it('should set wolf_kill_disabled when wolfKillOverride present on wolfVote step', () => {
    const state = createMinimalState({
      wolfKillOverride: {
        source: 'nightmare',
        ui: {
          promptTitle: '空刀',
          promptMessage: '狼人无法袭击',
          emptyVoteText: '空刀（被封锁）',
        },
      },
    } as Partial<NonNullState>);
    const action = maybeCreateUiHintAction(step('wolf', 'wolfKill', 2), state);
    expect(action.payload.currentActorHint).not.toBeNull();
    expect(action.payload.currentActorHint!.kind).toBe('wolf_kill_disabled');
    expect(action.payload.currentActorHint!.message).toBe('空刀（被封锁）');
  });

  it('should set wolf_unanimity_required when cupid is in template on wolfVote step', () => {
    const state = createMinimalState({
      templateRoles: ['wolf', 'seer', 'villager', 'cupid'],
    });
    const action = maybeCreateUiHintAction(step('wolf', 'wolfKill', 2), state);
    expect(action.payload.currentActorHint).not.toBeNull();
    expect(action.payload.currentActorHint!.kind).toBe('wolf_unanimity_required');
  });

  it('should prioritize wolfKillOverride over cupid unanimity', () => {
    const state = createMinimalState({
      templateRoles: ['wolf', 'seer', 'villager', 'cupid'],
      wolfKillOverride: {
        source: 'nightmare',
        ui: {
          promptTitle: '空刀',
          promptMessage: '狼人无法袭击',
          emptyVoteText: '空刀',
        },
      },
    } as Partial<NonNullState>);
    const action = maybeCreateUiHintAction(step('wolf', 'wolfKill', 2), state);
    // wolfKillOverride check (Case 1) is before cupid check (Case 1.5)
    expect(action.payload.currentActorHint!.kind).toBe('wolf_kill_disabled');
  });
});
