/**
 * seatHandler Unit Tests
 */

import { handleJoinSeat, handleLeaveSeat } from '../seatHandler';
import type { HandlerContext } from '../types';
import type { JoinSeatIntent, LeaveSeatIntent } from '../../intents/types';
import type { GameState } from '../../store/types';

function createMinimalState(overrides?: Partial<GameState>): GameState {
  return {
    roomCode: 'TEST',
    hostUid: 'host-1',
    status: 'unseated',
    templateRoles: ['villager', 'wolf', 'seer'],
    players: { 0: null, 1: null, 2: null },
    currentActionerIndex: -1,
    isAudioPlaying: false,
    ...overrides,
  };
}

function createContext(state: GameState, overrides?: Partial<HandlerContext>): HandlerContext {
  return {
    state,
    isHost: true,
    myUid: 'player-1',
    mySeat: null,
    ...overrides,
  };
}

describe('handleJoinSeat', () => {
  it('should succeed when seat is available', () => {
    const state = createMinimalState();
    const context = createContext(state);
    const intent: JoinSeatIntent = {
      type: 'JOIN_SEAT',
      payload: {
        seat: 0,
        uid: 'player-1',
        displayName: 'Alice',
      },
    };

    const result = handleJoinSeat(intent, context);

    expect(result.success).toBe(true);
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0].type).toBe('PLAYER_JOIN');
  });

  it('should fail when seat is taken', () => {
    const state = createMinimalState({
      players: {
        0: { uid: 'other', seatNumber: 0, role: null, hasViewedRole: false },
        1: null,
        2: null,
      },
    });
    const context = createContext(state);
    const intent: JoinSeatIntent = {
      type: 'JOIN_SEAT',
      payload: {
        seat: 0,
        uid: 'player-1',
        displayName: 'Alice',
      },
    };

    const result = handleJoinSeat(intent, context);

    expect(result.success).toBe(false);
    expect(result.reason).toBe('seat_taken');
  });

  it('should fail when seat does not exist', () => {
    const state = createMinimalState();
    const context = createContext(state);
    const intent: JoinSeatIntent = {
      type: 'JOIN_SEAT',
      payload: {
        seat: 99,
        uid: 'player-1',
        displayName: 'Alice',
      },
    };

    const result = handleJoinSeat(intent, context);

    expect(result.success).toBe(false);
    expect(result.reason).toBe('invalid_seat');
  });

  it('should fail when game is in progress', () => {
    const state = createMinimalState({ status: 'ongoing' });
    const context = createContext(state);
    const intent: JoinSeatIntent = {
      type: 'JOIN_SEAT',
      payload: {
        seat: 0,
        uid: 'player-1',
        displayName: 'Alice',
      },
    };

    const result = handleJoinSeat(intent, context);

    expect(result.success).toBe(false);
    expect(result.reason).toBe('game_in_progress');
  });

  it('should include BROADCAST_STATE and SAVE_STATE side effects', () => {
    const state = createMinimalState();
    const context = createContext(state);
    const intent: JoinSeatIntent = {
      type: 'JOIN_SEAT',
      payload: {
        seat: 0,
        uid: 'player-1',
        displayName: 'Alice',
      },
    };

    const result = handleJoinSeat(intent, context);

    expect(result.sideEffects).toContainEqual({ type: 'BROADCAST_STATE' });
    expect(result.sideEffects).toContainEqual({ type: 'SAVE_STATE' });
  });
});

describe('handleLeaveSeat', () => {
  it('should succeed when leaving own seat', () => {
    const state = createMinimalState({
      players: {
        0: { uid: 'player-1', seatNumber: 0, role: null, hasViewedRole: false },
        1: null,
        2: null,
      },
    });
    const context = createContext(state, { mySeat: 0 });
    const intent: LeaveSeatIntent = {
      type: 'LEAVE_SEAT',
      payload: {
        seat: 0,
        uid: 'player-1',
      },
    };

    const result = handleLeaveSeat(intent, context);

    expect(result.success).toBe(true);
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0].type).toBe('PLAYER_LEAVE');
  });

  it('should fail when seat is empty', () => {
    const state = createMinimalState();
    const context = createContext(state);
    const intent: LeaveSeatIntent = {
      type: 'LEAVE_SEAT',
      payload: {
        seat: 0,
        uid: 'player-1',
      },
    };

    const result = handleLeaveSeat(intent, context);

    expect(result.success).toBe(false);
    expect(result.reason).toBe('seat_empty');
  });

  it('should fail when trying to leave another player seat', () => {
    const state = createMinimalState({
      players: {
        0: { uid: 'other-player', seatNumber: 0, role: null, hasViewedRole: false },
        1: null,
        2: null,
      },
    });
    const context = createContext(state);
    const intent: LeaveSeatIntent = {
      type: 'LEAVE_SEAT',
      payload: {
        seat: 0,
        uid: 'player-1',
      },
    };

    const result = handleLeaveSeat(intent, context);

    expect(result.success).toBe(false);
    expect(result.reason).toBe('not_your_seat');
  });

  it('should fail when game is ongoing', () => {
    const state = createMinimalState({
      status: 'ongoing',
      players: {
        0: { uid: 'player-1', seatNumber: 0, role: 'villager', hasViewedRole: true },
        1: null,
        2: null,
      },
    });
    const context = createContext(state);
    const intent: LeaveSeatIntent = {
      type: 'LEAVE_SEAT',
      payload: {
        seat: 0,
        uid: 'player-1',
      },
    };

    const result = handleLeaveSeat(intent, context);

    expect(result.success).toBe(false);
    expect(result.reason).toBe('game_in_progress');
  });
});
