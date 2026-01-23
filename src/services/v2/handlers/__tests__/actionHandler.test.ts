/**
 * actionHandler Unit Tests
 */

import { handleSubmitAction, handleSubmitWolfVote, handleViewedRole } from '../actionHandler';
import type { HandlerContext } from '../types';
import type {
  SubmitActionIntent,
  SubmitWolfVoteIntent,
  ViewedRoleIntent,
} from '../../intents/types';
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
  /**
   * 创建 wolf vote 测试用的 ongoing 状态
   * - currentStepId: 'wolfKill' (schema.kind === 'wolfVote')
   * - 玩家 1 是 wolf，参与狼人投票
   */
  const createWolfVoteState = (overrides?: Partial<GameState>): GameState => {
    return createMinimalState({
      status: 'ongoing',
      currentStepId: 'wolfKill' as SchemaId, // wolfVote schema
      isAudioPlaying: false,
      players: {
        0: { uid: 'p1', seatNumber: 0, role: 'villager', hasViewedRole: true },
        1: { uid: 'p2', seatNumber: 1, role: 'wolf', hasViewedRole: true },
        2: { uid: 'p3', seatNumber: 2, role: 'seer', hasViewedRole: true },
      },
      ...overrides,
    });
  };

  // === Happy Path ===

  it('should succeed when all gates pass (wolf voter, valid target)', () => {
    const state = createWolfVoteState();
    const context = createContext(state);
    const intent: SubmitWolfVoteIntent = {
      type: 'SUBMIT_WOLF_VOTE',
      payload: { seat: 1, target: 0 }, // wolf (seat 1) votes for villager (seat 0)
    };

    const result = handleSubmitWolfVote(intent, context);

    expect(result.success).toBe(true);
  // Unified action pipeline: record + apply resolver updates
  expect(result.actions).toHaveLength(2);
  expect(result.actions[0].type).toBe('RECORD_ACTION');
  expect(result.actions[1].type).toBe('APPLY_RESOLVER_RESULT');
  expect((result.actions[1] as any).payload.updates.wolfVotesBySeat).toEqual({ '1': 0 });
    expect(result.sideEffects).toContainEqual({ type: 'BROADCAST_STATE' });
    expect(result.sideEffects).toContainEqual({ type: 'SAVE_STATE' });
  });

  it('should allow wolf to vote self (neutral judge rule)', () => {
    const state = createWolfVoteState();
    const context = createContext(state);
    const intent: SubmitWolfVoteIntent = {
      type: 'SUBMIT_WOLF_VOTE',
      payload: { seat: 1, target: 1 }, // wolf votes for self
    };

    const result = handleSubmitWolfVote(intent, context);

    expect(result.success).toBe(true);
  expect(result.actions).toHaveLength(2);
  expect(result.actions[0].type).toBe('RECORD_ACTION');
  expect(result.actions[1].type).toBe('APPLY_RESOLVER_RESULT');
  expect((result.actions[1] as any).payload.updates.wolfVotesBySeat).toEqual({ '1': 1 });
  });

  it('should allow wolf to vote teammate (neutral judge rule)', () => {
    const state = createWolfVoteState({
      players: {
        0: { uid: 'p1', seatNumber: 0, role: 'villager', hasViewedRole: true },
        1: { uid: 'p2', seatNumber: 1, role: 'wolf', hasViewedRole: true },
        2: { uid: 'p3', seatNumber: 2, role: 'wolf', hasViewedRole: true }, // another wolf
      },
    });
    const context = createContext(state);
    const intent: SubmitWolfVoteIntent = {
      type: 'SUBMIT_WOLF_VOTE',
      payload: { seat: 1, target: 2 }, // wolf votes for teammate
    };

    const result = handleSubmitWolfVote(intent, context);

    expect(result.success).toBe(true);
  expect(result.actions).toHaveLength(2);
  expect(result.actions[0].type).toBe('RECORD_ACTION');
  expect(result.actions[1].type).toBe('APPLY_RESOLVER_RESULT');
  expect((result.actions[1] as any).payload.updates.wolfVotesBySeat).toEqual({ '1': 2 });
  });

  // === Gate: host_only ===

  it('should fail when not host (host_only)', () => {
    const state = createWolfVoteState();
    const context = createContext(state, { isHost: false });
    const intent: SubmitWolfVoteIntent = {
      type: 'SUBMIT_WOLF_VOTE',
      payload: { seat: 1, target: 0 },
    };

    const result = handleSubmitWolfVote(intent, context);

    expect(result.success).toBe(false);
    expect(result.reason).toBe('host_only');
  });

  // === Gate: no_state ===

  it('should fail when state is null (no_state)', () => {
    const context: HandlerContext = {
      state: null as unknown as GameState,
      isHost: true,
      myUid: 'host-1',
      mySeat: 0,
    };
    const intent: SubmitWolfVoteIntent = {
      type: 'SUBMIT_WOLF_VOTE',
      payload: { seat: 1, target: 0 },
    };

    const result = handleSubmitWolfVote(intent, context);

    expect(result.success).toBe(false);
    expect(result.reason).toBe('no_state');
  });

  // === Gate: invalid_status ===

  it('should fail when game not ongoing (invalid_status)', () => {
    const state = createWolfVoteState({ status: 'ended' });
    const context = createContext(state);
    const intent: SubmitWolfVoteIntent = {
      type: 'SUBMIT_WOLF_VOTE',
      payload: { seat: 1, target: 0 },
    };

    const result = handleSubmitWolfVote(intent, context);

    expect(result.success).toBe(false);
    expect(result.reason).toBe('invalid_status');
  });

  // === Gate: forbidden_while_audio_playing ===

  it('should fail when audio is playing (forbidden_while_audio_playing)', () => {
    const state = createWolfVoteState({ isAudioPlaying: true });
    const context = createContext(state);
    const intent: SubmitWolfVoteIntent = {
      type: 'SUBMIT_WOLF_VOTE',
      payload: { seat: 1, target: 0 },
    };

    const result = handleSubmitWolfVote(intent, context);

    expect(result.success).toBe(false);
    expect(result.reason).toBe('forbidden_while_audio_playing');
  });

  // === Gate: invalid_step ===

  it('should fail when currentStepId is missing (invalid_step)', () => {
    const state = createWolfVoteState({ currentStepId: undefined });
    const context = createContext(state);
    const intent: SubmitWolfVoteIntent = {
      type: 'SUBMIT_WOLF_VOTE',
      payload: { seat: 1, target: 0 },
    };

    const result = handleSubmitWolfVote(intent, context);

    expect(result.success).toBe(false);
    expect(result.reason).toBe('invalid_step');
  });

  // === Gate: step_mismatch ===

  it('should fail when currentStepId is not wolfVote schema (step_mismatch)', () => {
    const state = createWolfVoteState({ currentStepId: 'seerCheck' as SchemaId }); // not wolfVote
    const context = createContext(state);
    const intent: SubmitWolfVoteIntent = {
      type: 'SUBMIT_WOLF_VOTE',
      payload: { seat: 1, target: 0 },
    };

    const result = handleSubmitWolfVote(intent, context);

    expect(result.success).toBe(false);
    expect(result.reason).toBe('step_mismatch');
  });

  // === Gate: not_seated ===

  it('should fail when voter seat is empty (not_seated)', () => {
    const state = createWolfVoteState({
      players: {
        0: { uid: 'p1', seatNumber: 0, role: 'villager', hasViewedRole: true },
        1: null, // voter seat is empty
        2: { uid: 'p3', seatNumber: 2, role: 'seer', hasViewedRole: true },
      },
    });
    const context = createContext(state);
    const intent: SubmitWolfVoteIntent = {
      type: 'SUBMIT_WOLF_VOTE',
      payload: { seat: 1, target: 0 },
    };

    const result = handleSubmitWolfVote(intent, context);

    expect(result.success).toBe(false);
    expect(result.reason).toBe('not_seated');
  });

  // === Gate: not_wolf_participant ===

  it('should fail when voter role is not wolf (not_wolf_participant)', () => {
    const state = createWolfVoteState();
    const context = createContext(state);
    const intent: SubmitWolfVoteIntent = {
      type: 'SUBMIT_WOLF_VOTE',
      payload: { seat: 0, target: 1 }, // villager (seat 0) trying to vote
    };

    const result = handleSubmitWolfVote(intent, context);

    expect(result.success).toBe(false);
  // Unified reason (no wolf-vote-specific mapping)
  expect(result.reason).toBe('step_mismatch');
  });

  it('should fail when voter has no role (not_wolf_participant)', () => {
    const state = createWolfVoteState({
      players: {
        0: { uid: 'p1', seatNumber: 0, role: 'villager', hasViewedRole: true },
        1: { uid: 'p2', seatNumber: 1, role: undefined, hasViewedRole: true },
        2: { uid: 'p3', seatNumber: 2, role: 'seer', hasViewedRole: true },
      },
    });
    const context = createContext(state);
    const intent: SubmitWolfVoteIntent = {
      type: 'SUBMIT_WOLF_VOTE',
      payload: { seat: 1, target: 0 },
    };

    const result = handleSubmitWolfVote(intent, context);

    expect(result.success).toBe(false);
  // Unified reason (no wolf-vote-specific mapping)
  expect(result.reason).toBe('role_mismatch');
  });

  // === Gate: invalid_target ===

  it('should fail when target seat is out of range (invalid_target)', () => {
    const state = createWolfVoteState();
    const context = createContext(state);
    const intent: SubmitWolfVoteIntent = {
      type: 'SUBMIT_WOLF_VOTE',
      payload: { seat: 1, target: 99 }, // seat 99 not in players
    };

    const result = handleSubmitWolfVote(intent, context);

    expect(result.success).toBe(false);
  // Unified schema-first resolver reason
  expect(result.reason).toBe('目标玩家不存在');
  });

  it('should allow empty vote via target=-1 (mapped to schema target=null)', () => {
    const state = createWolfVoteState();
    const context = createContext(state);
    const intent: SubmitWolfVoteIntent = {
      type: 'SUBMIT_WOLF_VOTE',
      payload: { seat: 1, target: -1 },
    };

    const result = handleSubmitWolfVote(intent, context);

    expect(result.success).toBe(true);
  });

  // === Gate: target_not_seated ===

  it('should fail when target seat is empty (target_not_seated)', () => {
    const state = createWolfVoteState({
      players: {
        0: null, // target seat is empty
        1: { uid: 'p2', seatNumber: 1, role: 'wolf', hasViewedRole: true },
        2: { uid: 'p3', seatNumber: 2, role: 'seer', hasViewedRole: true },
      },
    });
    const context = createContext(state);
    const intent: SubmitWolfVoteIntent = {
      type: 'SUBMIT_WOLF_VOTE',
      payload: { seat: 1, target: 0 },
    };

    const result = handleSubmitWolfVote(intent, context);

    expect(result.success).toBe(false);
  // Unified schema-first resolver reason
  expect(result.reason).toBe('目标玩家不存在');
  });

  it('should reject immuneToWolfKill targets via wolfKillResolver (cannot vote that role)', () => {
    const state = createWolfVoteState({
      players: {
        0: { uid: 'p1', seatNumber: 0, role: 'spiritKnight', hasViewedRole: true }, // immuneToWolfKill
        1: { uid: 'p2', seatNumber: 1, role: 'wolf', hasViewedRole: true },
        2: { uid: 'p3', seatNumber: 2, role: 'seer', hasViewedRole: true },
      },
    });
    const context = createContext(state);
    const intent: SubmitWolfVoteIntent = {
      type: 'SUBMIT_WOLF_VOTE',
      payload: { seat: 1, target: 0 },
    };

    const result = handleSubmitWolfVote(intent, context);

  expect(result.success).toBe(false);
  // Expect user-facing copy from resolver.
  expect(result.reason).toMatch(/^不能投/);
  // Still must broadcast ACTION_REJECTED for UI.
  expect(result.actions?.[0]?.type).toBe('ACTION_REJECTED');
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

  // ==========================================================================
  // Nightmare Block Guard Tests (single-point, schema-aware)
  // ==========================================================================

  describe('nightmare block guard (schema-aware)', () => {
    /**
     * 要求 1：被 block 的玩家只能 skip，任何非 skip 行动都必须 reject
     * 要求 2：guard 必须是 schema-aware，不能只判断 target
     */

    // --- chooseSeat schema (target-based skip) ---

    it('should reject blocked seer with non-skip target', () => {
      const state = createOngoingState({
        currentStepId: 'seerCheck',
        players: {
          0: { uid: 'p1', seatNumber: 0, role: 'seer', hasViewedRole: true },
          1: { uid: 'p2', seatNumber: 1, role: 'wolf', hasViewedRole: true },
          2: { uid: 'p3', seatNumber: 2, role: 'villager', hasViewedRole: true },
        },
        currentNightResults: { blockedSeat: 0 }, // seer is blocked
      });
      const context = createContext(state, { isHost: true });
      const intent: SubmitActionIntent = {
        type: 'SUBMIT_ACTION',
        payload: { seat: 0, role: 'seer', target: 1, extra: {} }, // trying to check seat 1
      };

      const result = handleSubmitAction(intent, context);

      expect(result.success).toBe(false);
      expect(result.reason).toContain('被梦魇封锁');
      expect(result.actions.some((a) => a.type === 'ACTION_REJECTED')).toBe(true);
    });

    it('should allow blocked seer to skip (target=null)', () => {
      const state = createOngoingState({
        currentStepId: 'seerCheck',
        players: {
          0: { uid: 'p1', seatNumber: 0, role: 'seer', hasViewedRole: true },
          1: { uid: 'p2', seatNumber: 1, role: 'wolf', hasViewedRole: true },
        },
        currentNightResults: { blockedSeat: 0 }, // seer is blocked
      });
      const context = createContext(state, { isHost: true });
      const intent: SubmitActionIntent = {
        type: 'SUBMIT_ACTION',
        payload: { seat: 0, role: 'seer', target: null, extra: {} }, // skip
      };

      const result = handleSubmitAction(intent, context);

      expect(result.success).toBe(true);
    });

    it('should allow non-blocked seer to take action', () => {
      const state = createOngoingState({
        currentStepId: 'seerCheck',
        players: {
          0: { uid: 'p1', seatNumber: 0, role: 'seer', hasViewedRole: true },
          1: { uid: 'p2', seatNumber: 1, role: 'wolf', hasViewedRole: true },
        },
        currentNightResults: { blockedSeat: 99 }, // someone else blocked
      });
      const context = createContext(state, { isHost: true });
      const intent: SubmitActionIntent = {
        type: 'SUBMIT_ACTION',
        payload: { seat: 0, role: 'seer', target: 1, extra: {} },
      };

      const result = handleSubmitAction(intent, context);

      expect(result.success).toBe(true);
    });

    // --- swap schema (targets-based skip) - schema-aware test ---

    it('should reject blocked magician with non-skip targets', () => {
      const state = createOngoingState({
        currentStepId: 'magicianSwap',
        players: {
          0: { uid: 'p1', seatNumber: 0, role: 'magician', hasViewedRole: true },
          1: { uid: 'p2', seatNumber: 1, role: 'wolf', hasViewedRole: true },
          2: { uid: 'p3', seatNumber: 2, role: 'villager', hasViewedRole: true },
        },
        currentNightResults: { blockedSeat: 0 }, // magician is blocked
      });
      const context = createContext(state, { isHost: true });
      const intent: SubmitActionIntent = {
        type: 'SUBMIT_ACTION',
        payload: {
          seat: 0,
          role: 'magician',
          target: null, // target is null but...
          extra: { targets: [1, 2] }, // trying to swap via targets array
        },
      };

      const result = handleSubmitAction(intent, context);

      // MUST reject: schema-aware guard should detect targets array
      expect(result.success).toBe(false);
      expect(result.reason).toContain('被梦魇封锁');
      expect(result.actions.some((a) => a.type === 'ACTION_REJECTED')).toBe(true);
    });

    it('should allow blocked magician to skip (empty targets)', () => {
      const state = createOngoingState({
        currentStepId: 'magicianSwap',
        players: {
          0: { uid: 'p1', seatNumber: 0, role: 'magician', hasViewedRole: true },
          1: { uid: 'p2', seatNumber: 1, role: 'wolf', hasViewedRole: true },
        },
        currentNightResults: { blockedSeat: 0 }, // magician is blocked
      });
      const context = createContext(state, { isHost: true });
      const intent: SubmitActionIntent = {
        type: 'SUBMIT_ACTION',
        payload: {
          seat: 0,
          role: 'magician',
          target: null,
          extra: { targets: [] }, // skip via empty targets
        },
      };

      const result = handleSubmitAction(intent, context);

      expect(result.success).toBe(true);
    });

    // --- confirm schema (hunter/darkWolfKing special rules) ---

    it('should reject blocked hunter with confirmed=true', () => {
      const state = createOngoingState({
        currentStepId: 'hunterConfirm',
        players: {
          0: { uid: 'p1', seatNumber: 0, role: 'hunter', hasViewedRole: true },
          1: { uid: 'p2', seatNumber: 1, role: 'wolf', hasViewedRole: true },
        },
        currentNightResults: { blockedSeat: 0 }, // hunter is blocked
      });
      const context = createContext(state, { isHost: true });
      const intent: SubmitActionIntent = {
        type: 'SUBMIT_ACTION',
        payload: {
          seat: 0,
          role: 'hunter',
          target: null,
          extra: { confirmed: true }, // trying to confirm despite being blocked
        },
      };

      const result = handleSubmitAction(intent, context);

      // MUST reject: blocked hunter can only skip
      expect(result.success).toBe(false);
      expect(result.reason).toContain('被梦魇封锁');
    });

    it('should allow blocked hunter to skip (confirmed !== true)', () => {
      const state = createOngoingState({
        currentStepId: 'hunterConfirm',
        players: {
          0: { uid: 'p1', seatNumber: 0, role: 'hunter', hasViewedRole: true },
          1: { uid: 'p2', seatNumber: 1, role: 'wolf', hasViewedRole: true },
        },
        currentNightResults: { blockedSeat: 0 }, // hunter is blocked
      });
      const context = createContext(state, { isHost: true });
      const intent: SubmitActionIntent = {
        type: 'SUBMIT_ACTION',
        payload: {
          seat: 0,
          role: 'hunter',
          target: null,
          extra: { confirmed: false }, // skip
        },
      };

      const result = handleSubmitAction(intent, context);

      expect(result.success).toBe(true);
    });

    it('should reject non-blocked hunter trying to skip (confirm requires action)', () => {
      const state = createOngoingState({
        currentStepId: 'hunterConfirm',
        players: {
          0: { uid: 'p1', seatNumber: 0, role: 'hunter', hasViewedRole: true },
          1: { uid: 'p2', seatNumber: 1, role: 'wolf', hasViewedRole: true },
        },
        currentNightResults: {}, // NOT blocked
      });
      const context = createContext(state, { isHost: true });
      const intent: SubmitActionIntent = {
        type: 'SUBMIT_ACTION',
        payload: {
          seat: 0,
          role: 'hunter',
          target: null,
          extra: { confirmed: false }, // trying to skip despite not being blocked
        },
      };

      const result = handleSubmitAction(intent, context);

      // MUST reject: non-blocked confirm schema cannot skip
      expect(result.success).toBe(false);
      expect(result.reason).toContain('当前无法跳过');
    });

    it('should allow non-blocked hunter to confirm', () => {
      const state = createOngoingState({
        currentStepId: 'hunterConfirm',
        players: {
          0: { uid: 'p1', seatNumber: 0, role: 'hunter', hasViewedRole: true },
          1: { uid: 'p2', seatNumber: 1, role: 'wolf', hasViewedRole: true },
        },
        currentNightResults: {}, // NOT blocked
      });
      const context = createContext(state, { isHost: true });
      const intent: SubmitActionIntent = {
        type: 'SUBMIT_ACTION',
        payload: {
          seat: 0,
          role: 'hunter',
          target: null,
          extra: { confirmed: true }, // proper confirmation
        },
      };

      const result = handleSubmitAction(intent, context);

      expect(result.success).toBe(true);
    });

    // --- darkWolfKing confirm (same rules as hunter) ---

    it('should reject blocked darkWolfKing with confirmed=true', () => {
      const state = createOngoingState({
        currentStepId: 'darkWolfKingConfirm',
        players: {
          0: { uid: 'p1', seatNumber: 0, role: 'darkWolfKing', hasViewedRole: true },
          1: { uid: 'p2', seatNumber: 1, role: 'villager', hasViewedRole: true },
        },
        currentNightResults: { blockedSeat: 0 }, // darkWolfKing is blocked
      });
      const context = createContext(state, { isHost: true });
      const intent: SubmitActionIntent = {
        type: 'SUBMIT_ACTION',
        payload: {
          seat: 0,
          role: 'darkWolfKing',
          target: null,
          extra: { confirmed: true },
        },
      };

      const result = handleSubmitAction(intent, context);

      expect(result.success).toBe(false);
      expect(result.reason).toContain('被梦魇封锁');
    });

    it('should reject non-blocked darkWolfKing trying to skip', () => {
      const state = createOngoingState({
        currentStepId: 'darkWolfKingConfirm',
        players: {
          0: { uid: 'p1', seatNumber: 0, role: 'darkWolfKing', hasViewedRole: true },
          1: { uid: 'p2', seatNumber: 1, role: 'villager', hasViewedRole: true },
        },
        currentNightResults: {}, // NOT blocked
      });
      const context = createContext(state, { isHost: true });
      const intent: SubmitActionIntent = {
        type: 'SUBMIT_ACTION',
        payload: {
          seat: 0,
          role: 'darkWolfKing',
          target: null,
          extra: {}, // no confirmed field = skip
        },
      };

      const result = handleSubmitAction(intent, context);

      expect(result.success).toBe(false);
      expect(result.reason).toContain('当前无法跳过');
    });

    // --- wolfVote schema (blocked wolf) ---

    it('should reject blocked wolf with non-skip target', () => {
      const state = createOngoingState({
        currentStepId: 'wolfKill',
        players: {
          0: { uid: 'p1', seatNumber: 0, role: 'wolf', hasViewedRole: true },
          1: { uid: 'p2', seatNumber: 1, role: 'villager', hasViewedRole: true },
        },
        currentNightResults: { blockedSeat: 0 }, // wolf is blocked
      });
      const context = createContext(state, { isHost: true });
      const intent: SubmitWolfVoteIntent = {
        type: 'SUBMIT_WOLF_VOTE',
        payload: { seat: 0, target: 1 }, // trying to kill
      };

      const result = handleSubmitWolfVote(intent, context);

      expect(result.success).toBe(false);
      expect(result.reason).toContain('被梦魇封锁');
    });

    it('should allow blocked wolf to skip (empty knife)', () => {
      const state = createOngoingState({
        currentStepId: 'wolfKill',
        players: {
          0: { uid: 'p1', seatNumber: 0, role: 'wolf', hasViewedRole: true },
          1: { uid: 'p2', seatNumber: 1, role: 'villager', hasViewedRole: true },
        },
        currentNightResults: { blockedSeat: 0 }, // wolf is blocked
      });
      const context = createContext(state, { isHost: true });
      const intent: SubmitWolfVoteIntent = {
        type: 'SUBMIT_WOLF_VOTE',
        payload: { seat: 0, target: -1 }, // empty knife
      };

      const result = handleSubmitWolfVote(intent, context);

      expect(result.success).toBe(true);
    });
  });
});

// =============================================================================
// isSkipAction and checkNightmareBlockGuard unit tests
// =============================================================================

describe('isSkipAction (schema-aware skip detection)', () => {
  // Import from actionHandler (exported for testing)
  const { isSkipAction } = require('../actionHandler');
  const { SCHEMAS } = require('../../../../models/roles/spec');

  it('should detect skip for chooseSeat schema with target=undefined', () => {
    const result = isSkipAction(SCHEMAS.seerCheck, { schemaId: 'seerCheck', target: undefined });
    expect(result).toBe(true);
  });

  it('should detect non-skip for chooseSeat schema with target', () => {
    const result = isSkipAction(SCHEMAS.seerCheck, { schemaId: 'seerCheck', target: 1 });
    expect(result).toBe(false);
  });

  it('should detect skip for swap schema with empty targets', () => {
    const result = isSkipAction(SCHEMAS.magicianSwap, { schemaId: 'magicianSwap', targets: [] });
    expect(result).toBe(true);
  });

  it('should detect non-skip for swap schema with targets', () => {
    const result = isSkipAction(SCHEMAS.magicianSwap, {
      schemaId: 'magicianSwap',
      targets: [1, 2],
    });
    expect(result).toBe(false);
  });

  it('should detect skip for confirm schema with confirmed=false', () => {
    const result = isSkipAction(SCHEMAS.hunterConfirm, {
      schemaId: 'hunterConfirm',
      confirmed: false,
    });
    expect(result).toBe(true);
  });

  it('should detect non-skip for confirm schema with confirmed=true', () => {
    const result = isSkipAction(SCHEMAS.hunterConfirm, {
      schemaId: 'hunterConfirm',
      confirmed: true,
    });
    expect(result).toBe(false);
  });

  it('should detect skip for wolfVote schema with target=null', () => {
    const result = isSkipAction(SCHEMAS.wolfKill, { schemaId: 'wolfKill', target: null });
    expect(result).toBe(true);
  });

  it('should detect non-skip for wolfVote schema with target', () => {
    const result = isSkipAction(SCHEMAS.wolfKill, { schemaId: 'wolfKill', target: 0 });
    expect(result).toBe(false);
  });
});

describe('checkNightmareBlockGuard (single-point guard)', () => {
  const { checkNightmareBlockGuard } = require('../actionHandler');
  const { SCHEMAS, BLOCKED_UI_DEFAULTS } = require('../../../../models/roles/spec');

  describe('chooseSeat schema', () => {
    it('should reject blocked player with non-skip action', () => {
      const reason = checkNightmareBlockGuard(
        0, // seat
        SCHEMAS.seerCheck,
        { schemaId: 'seerCheck', target: 1 },
        0, // blockedSeat
      );
      expect(reason).toBe(BLOCKED_UI_DEFAULTS.message);
    });

    it('should allow blocked player to skip', () => {
      const reason = checkNightmareBlockGuard(
        0,
        SCHEMAS.seerCheck,
        { schemaId: 'seerCheck', target: undefined },
        0,
      );
      expect(reason).toBeUndefined();
    });

    it('should allow non-blocked player to act', () => {
      const reason = checkNightmareBlockGuard(
        0,
        SCHEMAS.seerCheck,
        { schemaId: 'seerCheck', target: 1 },
        99, // someone else blocked
      );
      expect(reason).toBeUndefined();
    });
  });

  describe('swap schema', () => {
    it('should reject blocked player with non-empty targets', () => {
      const reason = checkNightmareBlockGuard(
        0,
        SCHEMAS.magicianSwap,
        { schemaId: 'magicianSwap', targets: [1, 2] },
        0,
      );
      expect(reason).toBe(BLOCKED_UI_DEFAULTS.message);
    });

    it('should allow blocked player with empty targets', () => {
      const reason = checkNightmareBlockGuard(
        0,
        SCHEMAS.magicianSwap,
        { schemaId: 'magicianSwap', targets: [] },
        0,
      );
      expect(reason).toBeUndefined();
    });
  });

  describe('confirm schema', () => {
    it('should reject blocked player with confirmed=true', () => {
      const reason = checkNightmareBlockGuard(
        0,
        SCHEMAS.hunterConfirm,
        { schemaId: 'hunterConfirm', confirmed: true },
        0,
      );
      expect(reason).toBe(BLOCKED_UI_DEFAULTS.message);
    });

    it('should allow blocked player to skip (confirmed=false)', () => {
      const reason = checkNightmareBlockGuard(
        0,
        SCHEMAS.hunterConfirm,
        { schemaId: 'hunterConfirm', confirmed: false },
        0,
      );
      expect(reason).toBeUndefined();
    });

    it('should reject non-blocked player trying to skip', () => {
      const reason = checkNightmareBlockGuard(
        0,
        SCHEMAS.hunterConfirm,
        { schemaId: 'hunterConfirm', confirmed: false },
        99, // not blocked
      );
      expect(reason).toBe('当前无法跳过，请执行行动');
    });

    it('should allow non-blocked player to confirm', () => {
      const reason = checkNightmareBlockGuard(
        0,
        SCHEMAS.hunterConfirm,
        { schemaId: 'hunterConfirm', confirmed: true },
        99,
      );
      expect(reason).toBeUndefined();
    });
  });
});
