/**
 * seatHandler Unit Tests
 */

import {
  handleJoinSeat,
  handleKickPlayer,
  handleLeaveMySeat,
  handleUpdatePlayerProfile,
} from '@werewolf/game-engine/engine/handlers/seatHandler';
import type { HandlerContext } from '@werewolf/game-engine/engine/handlers/types';
import type {
  JoinSeatIntent,
  KickPlayerIntent,
  LeaveMySeatIntent,
  UpdatePlayerProfileIntent,
} from '@werewolf/game-engine/engine/intents/types';
import type { GameStatePayload } from '@werewolf/game-engine/engine/store/types';
import { GameStatus } from '@werewolf/game-engine/models/GameStatus';
import {
  REASON_GAME_IN_PROGRESS,
  REASON_INVALID_SEAT,
  REASON_NO_STATE,
  REASON_NOT_AUTHENTICATED,
  REASON_NOT_HOST,
  REASON_NOT_SEATED,
  REASON_SEAT_EMPTY,
  REASON_SEAT_TAKEN,
} from '@werewolf/game-engine/protocol/reasonCodes';

import { expectError, expectSuccess } from './handlerTestUtils';

function createMinimalState(overrides?: Partial<GameStatePayload>): GameStatePayload {
  return {
    roomCode: 'TEST',
    hostUserId: 'host-1',
    status: GameStatus.Unseated,
    templateRoles: ['villager', 'wolf', 'seer'],
    players: { 0: null, 1: null, 2: null },
    currentStepIndex: -1,
    isAudioPlaying: false,
    actions: [],
    pendingRevealAcks: [],
    roster: {},
    ...overrides,
  };
}

function createContext(
  state: GameStatePayload | null,
  overrides?: Partial<HandlerContext>,
): HandlerContext {
  return {
    state,
    myUserId: 'player-1',
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
        userId: 'player-1',
        displayName: 'Alice',
      },
    };

    const result = handleJoinSeat(intent, context);

    const success = expectSuccess(result);
    expect(success.actions).toHaveLength(1);
    expect(success.actions[0].type).toBe('PLAYER_JOIN');
  });

  it('should fail when seat is taken', () => {
    const state = createMinimalState({
      players: {
        0: { userId: 'other', seat: 0, role: null, hasViewedRole: false },
        1: null,
        2: null,
      },
    });
    const context = createContext(state);
    const intent: JoinSeatIntent = {
      type: 'JOIN_SEAT',
      payload: {
        seat: 0,
        userId: 'player-1',
        displayName: 'Alice',
      },
    };

    const result = handleJoinSeat(intent, context);

    const err = expectError(result);
    expect(err.reason).toBe(REASON_SEAT_TAKEN);
  });

  it('should fail when seat does not exist', () => {
    const state = createMinimalState();
    const context = createContext(state);
    const intent: JoinSeatIntent = {
      type: 'JOIN_SEAT',
      payload: {
        seat: 99,
        userId: 'player-1',
        displayName: 'Alice',
      },
    };

    const result = handleJoinSeat(intent, context);

    const err = expectError(result);
    expect(err.reason).toBe(REASON_INVALID_SEAT);
  });

  it('should fail when game is in progress', () => {
    const state = createMinimalState({ status: GameStatus.Ongoing });
    const context = createContext(state);
    const intent: JoinSeatIntent = {
      type: 'JOIN_SEAT',
      payload: {
        seat: 0,
        userId: 'player-1',
        displayName: 'Alice',
      },
    };

    const result = handleJoinSeat(intent, context);

    const err = expectError(result);
    expect(err.reason).toBe(REASON_GAME_IN_PROGRESS);
  });

  it('should fail when state is null (no_state)', () => {
    const context = createContext(null);
    const intent: JoinSeatIntent = {
      type: 'JOIN_SEAT',
      payload: {
        seat: 0,
        userId: 'player-1',
        displayName: 'Alice',
      },
    };

    const result = handleJoinSeat(intent, context);

    const err = expectError(result);
    expect(err.reason).toBe(REASON_NO_STATE);
  });

  it('should fail when userId is empty (not_authenticated)', () => {
    const state = createMinimalState();
    const context = createContext(state);
    const intent: JoinSeatIntent = {
      type: 'JOIN_SEAT',
      payload: {
        seat: 0,
        userId: '', // empty userId
        displayName: 'Alice',
      },
    };

    const result = handleJoinSeat(intent, context);

    const err = expectError(result);
    expect(err.reason).toBe(REASON_NOT_AUTHENTICATED);
  });

  it('should include BROADCAST_STATE and SAVE_STATE side effects', () => {
    const state = createMinimalState();
    const context = createContext(state);
    const intent: JoinSeatIntent = {
      type: 'JOIN_SEAT',
      payload: {
        seat: 0,
        userId: 'player-1',
        displayName: 'Alice',
      },
    };

    const result = handleJoinSeat(intent, context);

    const success = expectSuccess(result);
    expect(success.sideEffects).toContainEqual({ type: 'BROADCAST_STATE' });
    expect(success.sideEffects).toContainEqual({ type: 'SAVE_STATE' });
  });

  it('should handle seat switching (leave old seat, join new seat)', () => {
    const state = createMinimalState({
      players: {
        0: {
          userId: 'player-1',
          seat: 0,
          role: null,
          hasViewedRole: false,
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
        userId: 'player-1',
        displayName: 'Alice',
      },
    };

    const result = handleJoinSeat(intent, context);

    const success = expectSuccess(result);
    expect(success.actions).toHaveLength(2);
    expect(success.actions[0].type).toBe('PLAYER_LEAVE');
    expect((success.actions[0] as { payload: { seat: number } }).payload.seat).toBe(0);
    expect(success.actions[1].type).toBe('PLAYER_JOIN');
    expect((success.actions[1] as { payload: { seat: number } }).payload.seat).toBe(2);
  });

  it('should allow player to re-sit on same seat without leaving', () => {
    const state = createMinimalState({
      players: {
        0: {
          userId: 'player-1',
          seat: 0,
          role: null,
          hasViewedRole: false,
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
        userId: 'player-1',
        displayName: 'Alice',
      },
    };

    const result = handleJoinSeat(intent, context);

    const success = expectSuccess(result);
    expect(success.actions).toHaveLength(1); // Only join, no leave
    expect(success.actions[0].type).toBe('PLAYER_JOIN');
  });
});

describe('handleLeaveMySeat', () => {
  it('should succeed when leaving own seat (mySeat from context)', () => {
    const state = createMinimalState({
      players: {
        0: { userId: 'player-1', seat: 0, role: null, hasViewedRole: false },
        1: null,
        2: null,
      },
    });
    const context = createContext(state, { mySeat: 0 });
    const intent: LeaveMySeatIntent = {
      type: 'LEAVE_MY_SEAT',
      payload: { userId: 'player-1' },
    };

    const result = handleLeaveMySeat(intent, context);

    const success = expectSuccess(result);
    expect(success.actions).toHaveLength(1);
    expect(success.actions[0].type).toBe('PLAYER_LEAVE');
    expect((success.actions[0] as { payload: { seat: number } }).payload.seat).toBe(0);
  });

  it('should fail with not_seated when mySeat is null', () => {
    const state = createMinimalState();
    const context = createContext(state, { mySeat: null });
    const intent: LeaveMySeatIntent = {
      type: 'LEAVE_MY_SEAT',
      payload: { userId: 'player-1' },
    };

    const result = handleLeaveMySeat(intent, context);

    const err = expectError(result);
    expect(err.reason).toBe(REASON_NOT_SEATED);
  });

  it('should fail with no_state when state is null', () => {
    const context = createContext(null);
    const intent: LeaveMySeatIntent = {
      type: 'LEAVE_MY_SEAT',
      payload: { userId: 'player-1' },
    };

    const result = handleLeaveMySeat(intent, context);

    const err = expectError(result);
    expect(err.reason).toBe(REASON_NO_STATE);
  });

  it('should fail with not_authenticated when userId is empty', () => {
    const state = createMinimalState({
      players: {
        0: { userId: 'player-1', seat: 0, role: null, hasViewedRole: false },
        1: null,
        2: null,
      },
    });
    const context = createContext(state, { mySeat: 0 });
    const intent: LeaveMySeatIntent = {
      type: 'LEAVE_MY_SEAT',
      payload: { userId: '' },
    };

    const result = handleLeaveMySeat(intent, context);

    const err = expectError(result);
    expect(err.reason).toBe(REASON_NOT_AUTHENTICATED);
  });

  it('should fail with game_in_progress when game is ongoing', () => {
    const state = createMinimalState({
      status: GameStatus.Ongoing,
      players: {
        0: { userId: 'player-1', seat: 0, role: 'villager', hasViewedRole: true },
        1: null,
        2: null,
      },
    });
    const context = createContext(state, { mySeat: 0 });
    const intent: LeaveMySeatIntent = {
      type: 'LEAVE_MY_SEAT',
      payload: { userId: 'player-1' },
    };

    const result = handleLeaveMySeat(intent, context);

    const err = expectError(result);
    expect(err.reason).toBe(REASON_GAME_IN_PROGRESS);
  });

  it.each([GameStatus.Assigned, GameStatus.Ready, GameStatus.Ended])(
    'should fail with game_in_progress when status is %s',
    (status) => {
      const state = createMinimalState({
        status,
        players: {
          0: { userId: 'player-1', seat: 0, role: 'villager', hasViewedRole: true },
          1: null,
          2: null,
        },
      });
      const context = createContext(state, { mySeat: 0 });
      const intent: LeaveMySeatIntent = {
        type: 'LEAVE_MY_SEAT',
        payload: { userId: 'player-1' },
      };

      const result = handleLeaveMySeat(intent, context);

      const err = expectError(result);
      expect(err.reason).toBe(REASON_GAME_IN_PROGRESS);
    },
  );

  it('should include BROADCAST_STATE and SAVE_STATE side effects on success', () => {
    const state = createMinimalState({
      players: {
        0: { userId: 'player-1', seat: 0, role: null, hasViewedRole: false },
        1: null,
        2: null,
      },
    });
    const context = createContext(state, { mySeat: 0 });
    const intent: LeaveMySeatIntent = {
      type: 'LEAVE_MY_SEAT',
      payload: { userId: 'player-1' },
    };

    const result = handleLeaveMySeat(intent, context);

    const success = expectSuccess(result);
    expect(success.sideEffects).toContainEqual({ type: 'BROADCAST_STATE' });
    expect(success.sideEffects).toContainEqual({ type: 'SAVE_STATE' });
  });
});

describe('handleUpdatePlayerProfile', () => {
  const makeIntent = (
    overrides?: Partial<UpdatePlayerProfileIntent['payload']>,
  ): UpdatePlayerProfileIntent => ({
    type: 'UPDATE_PLAYER_PROFILE',
    payload: {
      userId: 'player-1',
      displayName: 'NewName',
      ...overrides,
    },
  });

  it('should fail when state is null', () => {
    const context = createContext(null);
    const result = handleUpdatePlayerProfile(makeIntent(), context);

    const err = expectError(result);
    expect(err.reason).toBe(REASON_NO_STATE);
  });

  it('should fail when userId is missing', () => {
    const state = createMinimalState();
    const context = createContext(state);
    const result = handleUpdatePlayerProfile(makeIntent({ userId: '' }), context);

    const err = expectError(result);
    expect(err.reason).toBe(REASON_NOT_AUTHENTICATED);
  });

  it('should fail when user is not seated', () => {
    const state = createMinimalState();
    const context = createContext(state, { mySeat: null });
    const result = handleUpdatePlayerProfile(makeIntent(), context);

    const err = expectError(result);
    expect(err.reason).toBe(REASON_NOT_SEATED);
  });

  it('should succeed and produce UPDATE_PLAYER_PROFILE action when seated', () => {
    const state = createMinimalState({
      players: {
        0: { userId: 'player-1', seat: 0, role: null, hasViewedRole: false },
        1: null,
        2: null,
      },
    });
    const context = createContext(state, { mySeat: 0 });
    const intent = makeIntent({ displayName: 'Alice', avatarUrl: 'https://img/a.png' });

    const result = handleUpdatePlayerProfile(intent, context);

    const success = expectSuccess(result);
    expect(success.actions).toHaveLength(1);
    expect(success.actions[0]).toEqual({
      type: 'UPDATE_PLAYER_PROFILE',
      payload: {
        userId: 'player-1',
        displayName: 'Alice',
        avatarUrl: 'https://img/a.png',
        avatarFrame: undefined,
      },
    });
    expect(success.sideEffects).toContainEqual({ type: 'BROADCAST_STATE' });
    expect(success.sideEffects).toContainEqual({ type: 'SAVE_STATE' });
  });

  it('should pass only displayName when avatarUrl is undefined', () => {
    const state = createMinimalState({
      players: {
        0: { userId: 'player-1', seat: 0, role: null, hasViewedRole: false },
        1: null,
        2: null,
      },
    });
    const context = createContext(state, { mySeat: 0 });
    const intent = makeIntent({ displayName: 'Bob', avatarUrl: undefined });

    const result = handleUpdatePlayerProfile(intent, context);

    const success = expectSuccess(result);
    const action = success.actions[0];
    expect(action.type).toBe('UPDATE_PLAYER_PROFILE');
    expect(action).toEqual({
      type: 'UPDATE_PLAYER_PROFILE',
      payload: {
        userId: 'player-1',
        displayName: 'Bob',
        avatarUrl: undefined,
        avatarFrame: undefined,
      },
    });
  });
});

describe('handleKickPlayer', () => {
  const makeKickIntent = (targetSeat = 1): KickPlayerIntent => ({
    type: 'KICK_PLAYER',
    payload: { targetSeat },
  });

  it('should fail when state is null', () => {
    const context = createContext(null, { myUserId: 'host-1' });
    const result = handleKickPlayer(makeKickIntent(), context);
    const err = expectError(result);
    expect(err.reason).toBe(REASON_NO_STATE);
  });

  it('should fail when caller is not host', () => {
    const state = createMinimalState({
      hostUserId: 'host-1',
      players: {
        0: null,
        1: { userId: 'p2', seat: 1, role: null, hasViewedRole: false },
        2: null,
      },
    });
    const context = createContext(state, { myUserId: 'not-host' });
    const result = handleKickPlayer(makeKickIntent(1), context);
    const err = expectError(result);
    expect(err.reason).toBe(REASON_NOT_HOST);
  });

  it('should fail when game is in progress', () => {
    const state = createMinimalState({ status: GameStatus.Ongoing });
    const context = createContext(state, { myUserId: 'host-1' });
    const result = handleKickPlayer(makeKickIntent(), context);
    const err = expectError(result);
    expect(err.reason).toBe(REASON_GAME_IN_PROGRESS);
  });

  it('should fail when seat is empty', () => {
    const state = createMinimalState();
    const context = createContext(state, { myUserId: 'host-1' });
    const result = handleKickPlayer(makeKickIntent(1), context);
    const err = expectError(result);
    expect(err.reason).toBe(REASON_SEAT_EMPTY);
  });

  it('should fail when seat is invalid', () => {
    const state = createMinimalState();
    const context = createContext(state, { myUserId: 'host-1' });
    const result = handleKickPlayer(makeKickIntent(99), context);
    const err = expectError(result);
    expect(err.reason).toBe(REASON_INVALID_SEAT);
  });

  it('should succeed and return PLAYER_LEAVE action', () => {
    const state = createMinimalState({
      status: GameStatus.Seated,
      players: {
        0: { userId: 'host-1', seat: 0, role: null, hasViewedRole: false },
        1: { userId: 'p2', seat: 1, role: null, hasViewedRole: false },
        2: { userId: 'p3', seat: 2, role: null, hasViewedRole: false },
      },
    });
    const context = createContext(state, { myUserId: 'host-1' });
    const result = handleKickPlayer(makeKickIntent(1), context);
    const success = expectSuccess(result);
    expect(success.actions).toHaveLength(1);
    expect(success.actions[0]).toEqual({
      type: 'PLAYER_LEAVE',
      payload: { seat: 1 },
    });
  });
});
