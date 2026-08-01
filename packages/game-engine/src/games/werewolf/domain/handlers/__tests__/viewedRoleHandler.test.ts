/**
 * viewedRoleHandler Unit Tests
 *
 * Covers: handleViewedRole — seat ownership, status validation, action generation
 */

import { WEREWOLF_STATE_IDENTITY } from '../../../state/version';
import type { ViewedRoleIntent } from '../../intents/types';
import { GameStatus } from '../../models/GameStatus';
import type { GameState } from '../../protocol/types';
import type { HandlerContext } from '../types';
import { handleViewedRole } from '../viewedRoleHandler';
import { expectError, expectSuccess } from './handlerTestUtils';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMinimalState(overrides?: Partial<GameState>): GameState {
  return {
    ...WEREWOLF_STATE_IDENTITY,
    roomCode: 'TEST',
    hostUserId: 'host-1',
    status: GameStatus.Assigned,
    templateRoles: ['wolf', 'seer', 'villager'],
    players: {
      0: { userId: 'p0', seat: 0, role: 'seer', hasViewedRole: false },
      1: { userId: 'p1', seat: 1, role: 'wolf', hasViewedRole: false },
    },
    currentStepIndex: -1,
    isAudioPlaying: false,
    actions: [],
    pendingRevealAcks: [],
    hypnotizedSeats: [],
    piperRevealAcks: [],
    conversionRevealAcks: [],
    cupidLoversRevealAcks: [],
    roster: {},
    ...overrides,
  };
}

function createContext(state: GameState, overrides?: Partial<HandlerContext>): HandlerContext {
  return { state, myUserId: 'p0', mySeat: 0, ...overrides };
}

function intent(seat: number): ViewedRoleIntent {
  return { type: 'VIEWED_ROLE', payload: { seat } };
}

// =============================================================================
// Tests
// =============================================================================

describe('handleViewedRole', () => {
  it('should reject when non-host tries to mark another seat', () => {
    const state = createMinimalState();
    const ctx = createContext(state, { myUserId: 'p1', mySeat: 1 });
    const result = handleViewedRole(intent(0), ctx);
    const err = expectError(result);
    expect(err.reason).toBe('not_my_seat');
  });

  it('should allow host to mark any seat (bot control)', () => {
    const state = createMinimalState();
    const ctx = createContext(state, { myUserId: 'host-1', mySeat: 0 });
    const result = handleViewedRole(intent(1), ctx);
    const success = expectSuccess(result);
    expect(success.actions).toHaveLength(1);
    expect(success.actions[0]!.type).toBe('PLAYER_VIEWED_ROLE');
  });

  it('should allow player to mark their own seat', () => {
    const state = createMinimalState();
    const ctx = createContext(state, { myUserId: 'p0', mySeat: 0 });
    const result = handleViewedRole(intent(0), ctx);
    const success = expectSuccess(result);
    expect(success.actions[0]!).toEqual({
      type: 'PLAYER_VIEWED_ROLE',
      payload: { seat: 0 },
    });
  });

  it('should reject when status is not Assigned', () => {
    const state = createMinimalState({ status: GameStatus.Ongoing });
    const result = handleViewedRole(intent(0), createContext(state));
    const err = expectError(result);
    expect(err.reason).toBe('invalid_status');
  });

  it('should reject when seat has no player', () => {
    const state = createMinimalState({
      players: { 0: null, 1: null },
    });
    const ctx = createContext(state, { myUserId: 'host-1', mySeat: 0 });
    const result = handleViewedRole(intent(0), ctx);
    const err = expectError(result);
    expect(err.reason).toBe('not_seated');
  });
});
