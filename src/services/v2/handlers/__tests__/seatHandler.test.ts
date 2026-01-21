/**
 * seatHandler Unit Tests
 */

import { handleJoinSeat, handleLeaveSeat, handleLeaveMySeat } from '../seatHandler';
import type { HandlerContext } from '../types';
import type { JoinSeatIntent, LeaveSeatIntent, LeaveMySeatIntent } from '../../intents/types';
import type { GameState } from '../../store/types';
import {
  REASON_NO_STATE,
  REASON_NOT_AUTHENTICATED,
  REASON_INVALID_SEAT,
  REASON_SEAT_TAKEN,
  REASON_SEAT_EMPTY,
  REASON_NOT_YOUR_SEAT,
  REASON_GAME_IN_PROGRESS,
  REASON_NOT_SEATED,
} from '../../protocol/reasonCodes';

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

function createContext(
  state: GameState | null,
  overrides?: Partial<HandlerContext>,
): HandlerContext {
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
    expect(result.reason).toBe(REASON_SEAT_TAKEN);
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
    expect(result.reason).toBe(REASON_INVALID_SEAT);
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
    expect(result.reason).toBe(REASON_GAME_IN_PROGRESS);
  });

  it('should fail when state is null (no_state)', () => {
    const context = createContext(null);
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
    expect(result.reason).toBe(REASON_NO_STATE);
  });

  it('should fail when uid is empty (not_authenticated)', () => {
    const state = createMinimalState();
    const context = createContext(state);
    const intent: JoinSeatIntent = {
      type: 'JOIN_SEAT',
      payload: {
        seat: 0,
        uid: '', // empty uid
        displayName: 'Alice',
      },
    };

    const result = handleJoinSeat(intent, context);

    expect(result.success).toBe(false);
    expect(result.reason).toBe(REASON_NOT_AUTHENTICATED);
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

  it('should handle seat switching (leave old seat, join new seat)', () => {
    const state = createMinimalState({
      players: {
        0: {
          uid: 'player-1',
          seatNumber: 0,
          role: null,
          hasViewedRole: false,
          displayName: 'Alice',
        },
        1: null,
        2: null,
      },
    });
    const context = createContext(state);
    const intent: JoinSeatIntent = {
      type: 'JOIN_SEAT',
      payload: {
        seat: 2,
        uid: 'player-1',
        displayName: 'Alice',
      },
    };

    const result = handleJoinSeat(intent, context);

    expect(result.success).toBe(true);
    expect(result.actions).toHaveLength(2);
    expect(result.actions[0].type).toBe('PLAYER_LEAVE');
    expect((result.actions[0] as { payload: { seat: number } }).payload.seat).toBe(0);
    expect(result.actions[1].type).toBe('PLAYER_JOIN');
    expect((result.actions[1] as { payload: { seat: number } }).payload.seat).toBe(2);
  });

  it('should allow player to re-sit on same seat without leaving', () => {
    const state = createMinimalState({
      players: {
        0: {
          uid: 'player-1',
          seatNumber: 0,
          role: null,
          hasViewedRole: false,
          displayName: 'Alice',
        },
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

    expect(result.success).toBe(true);
    expect(result.actions).toHaveLength(1); // Only join, no leave
    expect(result.actions[0].type).toBe('PLAYER_JOIN');
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
    expect(result.reason).toBe(REASON_SEAT_EMPTY);
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
    expect(result.reason).toBe(REASON_NOT_YOUR_SEAT);
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
    expect(result.reason).toBe(REASON_GAME_IN_PROGRESS);
  });

  it('should fail when state is null (no_state)', () => {
    const context = createContext(null);
    const intent: LeaveSeatIntent = {
      type: 'LEAVE_SEAT',
      payload: {
        seat: 0,
        uid: 'player-1',
      },
    };

    const result = handleLeaveSeat(intent, context);

    expect(result.success).toBe(false);
    expect(result.reason).toBe(REASON_NO_STATE);
  });

  it('should fail when uid is empty (not_authenticated)', () => {
    const state = createMinimalState({
      players: {
        0: { uid: 'player-1', seatNumber: 0, role: null, hasViewedRole: false },
        1: null,
        2: null,
      },
    });
    const context = createContext(state);
    const intent: LeaveSeatIntent = {
      type: 'LEAVE_SEAT',
      payload: {
        seat: 0,
        uid: '', // empty uid
      },
    };

    const result = handleLeaveSeat(intent, context);

    expect(result.success).toBe(false);
    expect(result.reason).toBe(REASON_NOT_AUTHENTICATED);
  });
});

describe('handleLeaveMySeat', () => {
  it('should succeed when leaving own seat (mySeat from context)', () => {
    const state = createMinimalState({
      players: {
        0: { uid: 'player-1', seatNumber: 0, role: null, hasViewedRole: false },
        1: null,
        2: null,
      },
    });
    const context = createContext(state, { mySeat: 0 });
    const intent: LeaveMySeatIntent = {
      type: 'LEAVE_MY_SEAT',
      payload: { uid: 'player-1' },
    };

    const result = handleLeaveMySeat(intent, context);

    expect(result.success).toBe(true);
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0].type).toBe('PLAYER_LEAVE');
    expect((result.actions[0] as { payload: { seat: number } }).payload.seat).toBe(0);
  });

  it('should fail with not_seated when mySeat is null', () => {
    const state = createMinimalState();
    const context = createContext(state, { mySeat: null });
    const intent: LeaveMySeatIntent = {
      type: 'LEAVE_MY_SEAT',
      payload: { uid: 'player-1' },
    };

    const result = handleLeaveMySeat(intent, context);

    expect(result.success).toBe(false);
    expect(result.reason).toBe(REASON_NOT_SEATED);
  });

  it('should fail with no_state when state is null', () => {
    const context = createContext(null);
    const intent: LeaveMySeatIntent = {
      type: 'LEAVE_MY_SEAT',
      payload: { uid: 'player-1' },
    };

    const result = handleLeaveMySeat(intent, context);

    expect(result.success).toBe(false);
    expect(result.reason).toBe(REASON_NO_STATE);
  });

  it('should fail with not_authenticated when uid is empty', () => {
    const state = createMinimalState({
      players: {
        0: { uid: 'player-1', seatNumber: 0, role: null, hasViewedRole: false },
        1: null,
        2: null,
      },
    });
    const context = createContext(state, { mySeat: 0 });
    const intent: LeaveMySeatIntent = {
      type: 'LEAVE_MY_SEAT',
      payload: { uid: '' },
    };

    const result = handleLeaveMySeat(intent, context);

    expect(result.success).toBe(false);
    expect(result.reason).toBe(REASON_NOT_AUTHENTICATED);
  });

  it('should fail with game_in_progress when game is ongoing', () => {
    const state = createMinimalState({
      status: 'ongoing',
      players: {
        0: { uid: 'player-1', seatNumber: 0, role: 'villager', hasViewedRole: true },
        1: null,
        2: null,
      },
    });
    const context = createContext(state, { mySeat: 0 });
    const intent: LeaveMySeatIntent = {
      type: 'LEAVE_MY_SEAT',
      payload: { uid: 'player-1' },
    };

    const result = handleLeaveMySeat(intent, context);

    expect(result.success).toBe(false);
    expect(result.reason).toBe(REASON_GAME_IN_PROGRESS);
  });

  it('should include BROADCAST_STATE and SAVE_STATE side effects on success', () => {
    const state = createMinimalState({
      players: {
        0: { uid: 'player-1', seatNumber: 0, role: null, hasViewedRole: false },
        1: null,
        2: null,
      },
    });
    const context = createContext(state, { mySeat: 0 });
    const intent: LeaveMySeatIntent = {
      type: 'LEAVE_MY_SEAT',
      payload: { uid: 'player-1' },
    };

    const result = handleLeaveMySeat(intent, context);

    expect(result.success).toBe(true);
    expect(result.sideEffects).toContainEqual({ type: 'BROADCAST_STATE' });
    expect(result.sideEffects).toContainEqual({ type: 'SAVE_STATE' });
  });
});
