/**
 * handleClearAllSeats Unit Tests
 */

import { handleClearAllSeats } from '@werewolf/game-engine/engine/handlers/seatHandler';
import type { HandlerContext } from '@werewolf/game-engine/engine/handlers/types';
import type { ClearAllSeatsIntent } from '@werewolf/game-engine/engine/intents/types';
import type { GameState } from '@werewolf/game-engine/engine/store/types';
import { GameStatus } from '@werewolf/game-engine/models/GameStatus';

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

function createContext(state: GameState, overrides?: Partial<HandlerContext>): HandlerContext {
  return {
    state,
    isHost: true,
    myUid: 'host-1',
    mySeat: null,
    ...overrides,
  };
}

const intent: ClearAllSeatsIntent = { type: 'CLEAR_ALL_SEATS' };

describe('handleClearAllSeats', () => {
  const seatedState = createMinimalState({
    status: GameStatus.Seated,
    players: {
      0: { uid: 'p1', seatNumber: 0, role: null, hasViewedRole: false },
      1: { uid: 'p2', seatNumber: 1, role: null, hasViewedRole: false },
      2: { uid: 'p3', seatNumber: 2, role: null, hasViewedRole: false },
    },
  });

  it('should succeed and emit PLAYER_LEAVE for all seated players', () => {
    const context = createContext(seatedState);
    const result = handleClearAllSeats(intent, context);
    expect(result.success).toBe(true);
    expect(result.actions).toHaveLength(3);
    expect(result.actions).toEqual(
      expect.arrayContaining([
        { type: 'PLAYER_LEAVE', payload: { seat: 0 } },
        { type: 'PLAYER_LEAVE', payload: { seat: 1 } },
        { type: 'PLAYER_LEAVE', payload: { seat: 2 } },
      ]),
    );
  });

  it('should succeed in unseated status with partial seats', () => {
    const state = createMinimalState({
      status: GameStatus.Unseated,
      players: {
        0: { uid: 'p1', seatNumber: 0, role: null, hasViewedRole: false },
        1: null,
        2: null,
      },
    });
    const context = createContext(state);
    const result = handleClearAllSeats(intent, context);
    expect(result.success).toBe(true);
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0]).toEqual({ type: 'PLAYER_LEAVE', payload: { seat: 0 } });
  });

  it('should succeed with 0 actions when no players seated', () => {
    const state = createMinimalState({ status: GameStatus.Unseated });
    const context = createContext(state);
    const result = handleClearAllSeats(intent, context);
    expect(result.success).toBe(true);
    expect(result.actions).toHaveLength(0);
  });

  it('should reject when not host', () => {
    const context = createContext(seatedState, { isHost: false });
    const result = handleClearAllSeats(intent, context);
    expect(result.success).toBe(false);
    expect(result.reason).toBe('host_only');
  });

  it('should reject when state is null', () => {
    const context: HandlerContext = { state: null, isHost: true, myUid: 'host-1', mySeat: null };
    const result = handleClearAllSeats(intent, context);
    expect(result.success).toBe(false);
    expect(result.reason).toBe('no_state');
  });

  it('should reject when status is assigned', () => {
    const state = createMinimalState({ status: GameStatus.Assigned });
    const context = createContext(state);
    const result = handleClearAllSeats(intent, context);
    expect(result.success).toBe(false);
    expect(result.reason).toBe('game_in_progress');
  });

  it('should reject when status is ongoing', () => {
    const state = createMinimalState({ status: GameStatus.Ongoing });
    const context = createContext(state);
    const result = handleClearAllSeats(intent, context);
    expect(result.success).toBe(false);
    expect(result.reason).toBe('game_in_progress');
  });

  it('should include BROADCAST_STATE and SAVE_STATE side effects', () => {
    const context = createContext(seatedState);
    const result = handleClearAllSeats(intent, context);
    expect(result.sideEffects).toEqual(
      expect.arrayContaining([{ type: 'BROADCAST_STATE' }, { type: 'SAVE_STATE' }]),
    );
  });
});
