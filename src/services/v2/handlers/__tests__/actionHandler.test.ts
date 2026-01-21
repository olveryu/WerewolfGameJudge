/**
 * actionHandler Unit Tests
 */

import { handleSubmitWolfVote, handleViewedRole } from '../actionHandler';
import type { HandlerContext } from '../types';
import type { SubmitWolfVoteIntent, ViewedRoleIntent } from '../../intents/types';
import type { GameState } from '../../store/types';

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
