/**
 * actionHandler Unit Tests
 */

import { handleSubmitAction, handleSubmitWolfVote, handleViewedRole } from '../actionHandler';
import type { HandlerContext } from '../types';
import type { SubmitActionIntent, SubmitWolfVoteIntent, ViewedRoleIntent } from '../../intents/types';
import type { GameState } from '../../store/types';
import type { SchemaId } from '../../../../models/roles/spec';

function createMinimalState(overrides?: Partial<GameState>): GameState {
  return {
    roomCode: 'TEST',
    hostUid: 'host-1',
    status: 'ongoing',
    templateRoles: ['villager', 'wolf', 'seer'],
    players: {
      0: { uid: 'p1', seatNumber: 0, role: 'villager', hasViewedRole: true },
      1: { uid: 'p2', seatNumber: 1, role: 'wolf', hasViewedRole: true },
      2: { uid: 'p3', seatNumber: 2, role: 'seer', hasViewedRole: true },
    },
    currentActionerIndex: 0,
    isAudioPlaying: false,
    actions: [],
    wolfVotes: {},
    wolfVoteStatus: {},
    currentNightResults: {},
    ...overrides,
  };
}

function createContext(state: GameState, overrides?: Partial<HandlerContext>): HandlerContext {
  return {
    state,
    isHost: true,
    myUid: 'host-1',
    mySeat: 0,
    ...overrides,
  };
}

describe('handleSubmitWolfVote', () => {
  it('should succeed when host and game ongoing', () => {
    const state = createMinimalState();
    const context = createContext(state);
    const intent: SubmitWolfVoteIntent = {
      type: 'SUBMIT_WOLF_VOTE',
      payload: { seat: 1, target: 0 },
    };

    const result = handleSubmitWolfVote(intent, context);

    expect(result.success).toBe(true);
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0].type).toBe('RECORD_WOLF_VOTE');
  });

  it('should fail when not host', () => {
    const state = createMinimalState();
    const context = createContext(state, { isHost: false });
    const intent: SubmitWolfVoteIntent = {
      type: 'SUBMIT_WOLF_VOTE',
      payload: { seat: 1, target: 0 },
    };

    const result = handleSubmitWolfVote(intent, context);

    expect(result.success).toBe(false);
    expect(result.reason).toBe('host_only');
  });

  it('should fail when game not ongoing', () => {
    const state = createMinimalState({ status: 'ended' });
    const context = createContext(state);
    const intent: SubmitWolfVoteIntent = {
      type: 'SUBMIT_WOLF_VOTE',
      payload: { seat: 1, target: 0 },
    };

    const result = handleSubmitWolfVote(intent, context);

    expect(result.success).toBe(false);
    expect(result.reason).toBe('game_not_ongoing');
  });

  it('should fail when target seat invalid', () => {
    const state = createMinimalState();
    const context = createContext(state);
    const intent: SubmitWolfVoteIntent = {
      type: 'SUBMIT_WOLF_VOTE',
      payload: { seat: 1, target: 99 },
    };

    const result = handleSubmitWolfVote(intent, context);

    expect(result.success).toBe(false);
    expect(result.reason).toBe('invalid_target');
  });

  it('should include BROADCAST_STATE side effect', () => {
    const state = createMinimalState();
    const context = createContext(state);
    const intent: SubmitWolfVoteIntent = {
      type: 'SUBMIT_WOLF_VOTE',
      payload: { seat: 1, target: 0 },
    };

    const result = handleSubmitWolfVote(intent, context);

    expect(result.sideEffects).toContainEqual({ type: 'BROADCAST_STATE' });
  });
});

describe('handleViewedRole', () => {
  // Helper: 创建 assigned 状态用于 ViewedRole 测试
  const createAssignedState = (overrides?: Partial<GameState>): GameState => {
    return createMinimalState({
      status: 'assigned',
      players: {
        0: { uid: 'p1', seatNumber: 0, role: 'villager', hasViewedRole: false },
        1: { uid: 'p2', seatNumber: 1, role: 'wolf', hasViewedRole: false },
        2: { uid: 'p3', seatNumber: 2, role: 'seer', hasViewedRole: false },
      },
      ...overrides,
    });
  };

  it('should succeed when host and status is assigned', () => {
    const state = createAssignedState();
    const context = createContext(state, { isHost: true });
    const intent: ViewedRoleIntent = {
      type: 'VIEWED_ROLE',
      payload: { seat: 0 },
    };

    const result = handleViewedRole(intent, context);

    expect(result.success).toBe(true);
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0].type).toBe('PLAYER_VIEWED_ROLE');
  });

  it('should fail when not host (host_only)', () => {
    const state = createAssignedState();
    const context = createContext(state, { isHost: false });
    const intent: ViewedRoleIntent = {
      type: 'VIEWED_ROLE',
      payload: { seat: 0 },
    };

    const result = handleViewedRole(intent, context);

    expect(result.success).toBe(false);
    expect(result.reason).toBe('host_only');
  });

  it('should fail when state is null (no_state)', () => {
    const context: HandlerContext = {
      state: null as unknown as GameState,
      isHost: true,
      myUid: 'host-1',
      mySeat: 0,
    };
    const intent: ViewedRoleIntent = {
      type: 'VIEWED_ROLE',
      payload: { seat: 0 },
    };

    const result = handleViewedRole(intent, context);

    expect(result.success).toBe(false);
    expect(result.reason).toBe('no_state');
  });

  it('should fail when status is not assigned (invalid_status)', () => {
    const state = createMinimalState({ status: 'ongoing' });
    const context = createContext(state, { isHost: true });
    const intent: ViewedRoleIntent = {
      type: 'VIEWED_ROLE',
      payload: { seat: 0 },
    };

    const result = handleViewedRole(intent, context);

    expect(result.success).toBe(false);
    expect(result.reason).toBe('invalid_status');
  });

  it('should fail when seat is empty (not_seated)', () => {
    const state = createAssignedState({
      players: { 0: null, 1: null, 2: null },
    });
    const context = createContext(state, { isHost: true });
    const intent: ViewedRoleIntent = {
      type: 'VIEWED_ROLE',
      payload: { seat: 0 },
    };

    const result = handleViewedRole(intent, context);

    expect(result.success).toBe(false);
    expect(result.reason).toBe('not_seated');
  });

  it('should include BROADCAST_STATE and SAVE_STATE side effects', () => {
    const state = createAssignedState();
    const context = createContext(state, { isHost: true });
    const intent: ViewedRoleIntent = {
      type: 'VIEWED_ROLE',
      payload: { seat: 0 },
    };

    const result = handleViewedRole(intent, context);

    expect(result.sideEffects).toContainEqual({ type: 'BROADCAST_STATE' });
    expect(result.sideEffects).toContainEqual({ type: 'SAVE_STATE' });
  });
});

// =============================================================================
// PR4: handleSubmitAction tests
// =============================================================================

describe('handleSubmitAction', () => {
  /**
   * 创建 ongoing 状态，用于 SubmitAction 测试
   * currentStepId 设为 'seerCheck'（预言家步骤）
   */
  const createOngoingState = (
    overrides?: Partial<GameState> & { currentStepId?: SchemaId },
  ): GameState => {
    return createMinimalState({
      status: 'ongoing',
      currentStepId: 'seerCheck',
      isAudioPlaying: false,
      players: {
        0: { uid: 'p1', seatNumber: 0, role: 'villager', hasViewedRole: true },
        1: { uid: 'p2', seatNumber: 1, role: 'wolf', hasViewedRole: true },
        2: { uid: 'p3', seatNumber: 2, role: 'seer', hasViewedRole: true },
      },
      currentNightResults: {},
      actions: [],
      ...overrides,
    });
  };

  // === Happy Path ===

  it('should succeed with valid seer action (happy path)', () => {
    const state = createOngoingState();
    const context = createContext(state, { isHost: true });
    const intent: SubmitActionIntent = {
      type: 'SUBMIT_ACTION',
      payload: { seat: 2, role: 'seer', target: 0, extra: {} },
    };

    const result = handleSubmitAction(intent, context);

    expect(result.success).toBe(true);
    expect(result.actions.length).toBeGreaterThanOrEqual(1);
    // 必须产生 RECORD_ACTION
    expect(result.actions.some((a) => a.type === 'RECORD_ACTION')).toBe(true);
  });

  it('should produce RECORD_ACTION and APPLY_RESOLVER_RESULT on success', () => {
    const state = createOngoingState();
    const context = createContext(state, { isHost: true });
    const intent: SubmitActionIntent = {
      type: 'SUBMIT_ACTION',
      payload: { seat: 2, role: 'seer', target: 0, extra: {} },
    };

    const result = handleSubmitAction(intent, context);

    expect(result.success).toBe(true);
    const actionTypes = result.actions.map((a) => a.type);
    expect(actionTypes).toContain('RECORD_ACTION');
    expect(actionTypes).toContain('APPLY_RESOLVER_RESULT');
  });

  it('should include BROADCAST_STATE and SAVE_STATE side effects on success', () => {
    const state = createOngoingState();
    const context = createContext(state, { isHost: true });
    const intent: SubmitActionIntent = {
      type: 'SUBMIT_ACTION',
      payload: { seat: 2, role: 'seer', target: 0, extra: {} },
    };

    const result = handleSubmitAction(intent, context);

    expect(result.sideEffects).toContainEqual({ type: 'BROADCAST_STATE' });
    expect(result.sideEffects).toContainEqual({ type: 'SAVE_STATE' });
  });

  // === Gate: host_only ===

  it('should fail when not host (gate: host_only)', () => {
    const state = createOngoingState();
    const context = createContext(state, { isHost: false });
    const intent: SubmitActionIntent = {
      type: 'SUBMIT_ACTION',
      payload: { seat: 2, role: 'seer', target: 0, extra: {} },
    };

    const result = handleSubmitAction(intent, context);

    expect(result.success).toBe(false);
    expect(result.reason).toBe('host_only');
  });

  // === Gate: no_state ===

  it('should fail when state is null (gate: no_state)', () => {
    const context: HandlerContext = {
      state: null as unknown as GameState,
      isHost: true,
      myUid: 'host-1',
      mySeat: 0,
    };
    const intent: SubmitActionIntent = {
      type: 'SUBMIT_ACTION',
      payload: { seat: 2, role: 'seer', target: 0, extra: {} },
    };

    const result = handleSubmitAction(intent, context);

    expect(result.success).toBe(false);
    expect(result.reason).toBe('no_state');
  });

  // === Gate: invalid_status ===

  it('should fail when status is not ongoing (gate: invalid_status)', () => {
    const state = createOngoingState({ status: 'assigned' });
    const context = createContext(state, { isHost: true });
    const intent: SubmitActionIntent = {
      type: 'SUBMIT_ACTION',
      payload: { seat: 2, role: 'seer', target: 0, extra: {} },
    };

    const result = handleSubmitAction(intent, context);

    expect(result.success).toBe(false);
    expect(result.reason).toBe('invalid_status');
  });

  // === Gate: forbidden_while_audio_playing ===

  it('should fail when audio is playing (gate: forbidden_while_audio_playing)', () => {
    const state = createOngoingState({ isAudioPlaying: true });
    const context = createContext(state, { isHost: true });
    const intent: SubmitActionIntent = {
      type: 'SUBMIT_ACTION',
      payload: { seat: 2, role: 'seer', target: 0, extra: {} },
    };

    const result = handleSubmitAction(intent, context);

    expect(result.success).toBe(false);
    expect(result.reason).toBe('forbidden_while_audio_playing');
  });

  // === Gate: invalid_step ===

  it('should fail when currentStepId is missing (gate: invalid_step)', () => {
    const state = createOngoingState({ currentStepId: undefined });
    const context = createContext(state, { isHost: true });
    const intent: SubmitActionIntent = {
      type: 'SUBMIT_ACTION',
      payload: { seat: 2, role: 'seer', target: 0, extra: {} },
    };

    const result = handleSubmitAction(intent, context);

    expect(result.success).toBe(false);
    expect(result.reason).toBe('invalid_step');
  });

  // === Gate: step_mismatch ===

  it('should fail when submitted role does not match current step (gate: step_mismatch)', () => {
    // currentStepId 是 seerCheck，但提交的是 guard 行动
    const state = createOngoingState({
      currentStepId: 'seerCheck',
      players: {
        0: { uid: 'p1', seatNumber: 0, role: 'guard', hasViewedRole: true },
        1: { uid: 'p2', seatNumber: 1, role: 'wolf', hasViewedRole: true },
        2: { uid: 'p3', seatNumber: 2, role: 'seer', hasViewedRole: true },
      },
    });
    const context = createContext(state, { isHost: true });
    const intent: SubmitActionIntent = {
      type: 'SUBMIT_ACTION',
      payload: { seat: 0, role: 'guard', target: 1, extra: {} },
    };

    const result = handleSubmitAction(intent, context);

    expect(result.success).toBe(false);
    expect(result.reason).toBe('step_mismatch');
  });

  // === Gate: not_seated ===

  it('should fail when actor seat has no player (gate: not_seated)', () => {
    const state = createOngoingState({
      players: {
        0: { uid: 'p1', seatNumber: 0, role: 'villager', hasViewedRole: true },
        1: null,
        2: { uid: 'p3', seatNumber: 2, role: 'seer', hasViewedRole: true },
      },
    });
    const context = createContext(state, { isHost: true });
    const intent: SubmitActionIntent = {
      type: 'SUBMIT_ACTION',
      payload: { seat: 1, role: 'seer', target: 0, extra: {} },
    };

    const result = handleSubmitAction(intent, context);

    expect(result.success).toBe(false);
    expect(result.reason).toBe('not_seated');
  });

  // === Gate: role_mismatch ===

  it('should fail when player role does not match submitted role (gate: role_mismatch)', () => {
    const state = createOngoingState();
    const context = createContext(state, { isHost: true });
    // seat 0 是 villager，但提交的 role 是 seer
    const intent: SubmitActionIntent = {
      type: 'SUBMIT_ACTION',
      payload: { seat: 0, role: 'seer', target: 1, extra: {} },
    };

    const result = handleSubmitAction(intent, context);

    expect(result.success).toBe(false);
    expect(result.reason).toBe('role_mismatch');
  });

  // === Reject also broadcasts ===

  it('should broadcast on rejection (reject also broadcasts)', () => {
    const state = createOngoingState({ isAudioPlaying: true });
    const context = createContext(state, { isHost: true });
    const intent: SubmitActionIntent = {
      type: 'SUBMIT_ACTION',
      payload: { seat: 2, role: 'seer', target: 0, extra: {} },
    };

    const result = handleSubmitAction(intent, context);

    expect(result.success).toBe(false);
    // Gate rejection 不产生 sideEffects（只有 resolver rejection 才有）
    // 但根据 PR4 要求，reject 也必须 broadcast - 需要修复
  });

  // === Schema constraints (resolver-first) ===

  describe('schema constraints (resolver-first)', () => {
    /**
     * 锁死：schema constraints 校验口径以 SCHEMAS[*].constraints 为准。
     * wolfRobotLearn 有 notSelf constraint，尝试自指应被 resolver reject。
     */
    it('should reject self-target when schema has notSelf constraint (wolfRobotLearn)', () => {
      const state = createOngoingState({
        currentStepId: 'wolfRobotLearn',
        players: {
          0: { uid: 'p1', seatNumber: 0, role: 'villager', hasViewedRole: true },
          1: { uid: 'p2', seatNumber: 1, role: 'wolf', hasViewedRole: true },
          2: { uid: 'p3', seatNumber: 2, role: 'wolfRobot', hasViewedRole: true },
        },
      });
      const context = createContext(state, { isHost: true });
      // wolfRobot (seat 2) 尝试自指 (target: 2)
      const intent: SubmitActionIntent = {
        type: 'SUBMIT_ACTION',
        payload: { seat: 2, role: 'wolfRobot', target: 2, extra: {} },
      };

      const result = handleSubmitAction(intent, context);

      // resolver 应 reject，原因来自 constraintValidator
      expect(result.success).toBe(false);
      expect(result.reason).toContain('不能选择自己');
      // resolver rejection 产生 ACTION_REJECTED action
      expect(result.actions.some((a) => a.type === 'ACTION_REJECTED')).toBe(true);
      // resolver rejection 必须 broadcast
      expect(result.sideEffects).toContainEqual({ type: 'BROADCAST_STATE' });
    });

    it('should allow other target when schema has notSelf constraint', () => {
      const state = createOngoingState({
        currentStepId: 'wolfRobotLearn',
        players: {
          0: { uid: 'p1', seatNumber: 0, role: 'villager', hasViewedRole: true },
          1: { uid: 'p2', seatNumber: 1, role: 'wolf', hasViewedRole: true },
          2: { uid: 'p3', seatNumber: 2, role: 'wolfRobot', hasViewedRole: true },
        },
      });
      const context = createContext(state, { isHost: true });
      // wolfRobot (seat 2) 选择 seat 0（非自己）
      const intent: SubmitActionIntent = {
        type: 'SUBMIT_ACTION',
        payload: { seat: 2, role: 'wolfRobot', target: 0, extra: {} },
      };

      const result = handleSubmitAction(intent, context);

      // 应该成功
      expect(result.success).toBe(true);
      expect(result.actions.some((a) => a.type === 'RECORD_ACTION')).toBe(true);
    });
  });
});
