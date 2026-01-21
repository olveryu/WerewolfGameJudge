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
  it('should succeed when player exists at seat', () => {
    const state = createMinimalState();
    const context = createContext(state);
    const intent: ViewedRoleIntent = {
      type: 'VIEWED_ROLE',
      payload: { seat: 0 },
    };

    const result = handleViewedRole(intent, context);

    expect(result.success).toBe(true);
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0].type).toBe('PLAYER_VIEWED_ROLE');
  });

  it('should fail when seat is empty', () => {
    const state = createMinimalState({
      players: { 0: null, 1: null, 2: null },
    });
    const context = createContext(state);
    const intent: ViewedRoleIntent = {
      type: 'VIEWED_ROLE',
      payload: { seat: 0 },
    };

    const result = handleViewedRole(intent, context);

    expect(result.success).toBe(false);
    expect(result.reason).toBe('invalid_seat');
  });

  it('should include BROADCAST_STATE side effect', () => {
    const state = createMinimalState();
    const context = createContext(state);
    const intent: ViewedRoleIntent = {
      type: 'VIEWED_ROLE',
      payload: { seat: 0 },
    };

    const result = handleViewedRole(intent, context);

    expect(result.sideEffects).toContainEqual({ type: 'BROADCAST_STATE' });
  });
});
