/**
 * seatHandler Unit Tests
 */

import {
  handleJoinSeat,
  handleLeaveMySeat,
} from '@werewolf/game-engine/engine/handlers/seatHandler';
import type { HandlerContext } from '@werewolf/game-engine/engine/handlers/types';
import type { JoinSeatIntent, LeaveMySeatIntent } from '@werewolf/game-engine/engine/intents/types';
import type { GameState } from '@werewolf/game-engine/engine/store/types';
import { GameStatus } from '@werewolf/game-engine/models/GameStatus';
import {
  REASON_GAME_IN_PROGRESS,
  REASON_INVALID_SEAT,
  REASON_NO_STATE,
  REASON_NOT_AUTHENTICATED,
  REASON_NOT_SEATED,
  REASON_SEAT_TAKEN,
} from '@werewolf/game-engine/protocol/reasonCodes';

function createMinimalState(overrides?: Partial<GameState>): GameState {
  return {
    roomCode: 'TEST',
    hostUid: 'host-1',
    status: GameStatus.Unseated,
    templateRoles: ['villager', 'wolf', 'seer'],
    players: { 0: null, 1: null, 2: null },
    currentStepIndex: -1,
    isAudioPlaying: false,
    actions: [],
    pendingRevealAcks: [],
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
    const state = createMinimalState({ status: GameStatus.Ongoing });
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
      status: GameStatus.Ongoing,
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
