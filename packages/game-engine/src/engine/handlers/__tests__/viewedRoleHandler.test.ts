/**
 * viewedRoleHandler Unit Tests
 *
 * Covers: handleViewedRole — seat ownership, status validation, action generation
 */

import { GameStatus } from '../../../models/GameStatus';
import type { ViewedRoleIntent } from '../../intents/types';
import type { GameState } from '../../store/types';
import type { HandlerContext } from '../types';
import { handleViewedRole } from '../viewedRoleHandler';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMinimalState(overrides?: Partial<GameState>): GameState {
  return {
    roomCode: 'TEST',
    hostUid: 'host-1',
    status: GameStatus.Assigned,
    templateRoles: ['wolf', 'seer', 'villager'],
    players: {
      0: { uid: 'p0', seatNumber: 0, displayName: 'P0', role: 'seer', hasViewedRole: false },
      1: { uid: 'p1', seatNumber: 1, displayName: 'P1', role: 'wolf', hasViewedRole: false },
    },
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
  return { state, myUid: 'p0', mySeat: 0, ...overrides };
}

function intent(seat: number): ViewedRoleIntent {
  return { type: 'VIEWED_ROLE', payload: { seat } };
}

// =============================================================================
// Tests
// =============================================================================

describe('handleViewedRole', () => {
  it('should reject when state is null', () => {
    const result = handleViewedRole(intent(0), createContext(null));
    expect(result.success).toBe(false);
    expect(result.reason).toBe('no_state');
  });

  it('should reject when non-host tries to mark another seat', () => {
    const state = createMinimalState();
    const ctx = createContext(state, { myUid: 'p1', mySeat: 1 });
    const result = handleViewedRole(intent(0), ctx);
    expect(result.success).toBe(false);
    expect(result.reason).toBe('not_my_seat');
  });

  it('should allow host to mark any seat (bot control)', () => {
    const state = createMinimalState();
    const ctx = createContext(state, { myUid: 'host-1', mySeat: 0 });
    const result = handleViewedRole(intent(1), ctx);
    expect(result.success).toBe(true);
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0].type).toBe('PLAYER_VIEWED_ROLE');
  });

  it('should allow player to mark their own seat', () => {
    const state = createMinimalState();
    const ctx = createContext(state, { myUid: 'p0', mySeat: 0 });
    const result = handleViewedRole(intent(0), ctx);
    expect(result.success).toBe(true);
    expect(result.actions[0]).toEqual({
      type: 'PLAYER_VIEWED_ROLE',
      payload: { seat: 0 },
    });
  });

  it('should reject when status is not Assigned', () => {
    const state = createMinimalState({ status: GameStatus.Ongoing });
    const result = handleViewedRole(intent(0), createContext(state));
    expect(result.success).toBe(false);
    expect(result.reason).toBe('invalid_status');
  });

  it('should reject when seat has no player', () => {
    const state = createMinimalState({
      players: { 0: null, 1: null },
    });
    const ctx = createContext(state, { myUid: 'host-1', mySeat: 0 });
    const result = handleViewedRole(intent(0), ctx);
    expect(result.success).toBe(false);
    expect(result.reason).toBe('not_seated');
  });

  it('should include BROADCAST_STATE and SAVE_STATE side effects on success', () => {
    const state = createMinimalState();
    const ctx = createContext(state, { myUid: 'p0', mySeat: 0 });
    const result = handleViewedRole(intent(0), ctx);
    expect(result.success).toBe(true);
    expect(result.sideEffects).toBeDefined();
    const types = result.sideEffects!.map((se) => se.type);
    expect(types).toContain('BROADCAST_STATE');
    expect(types).toContain('SAVE_STATE');
  });
});
