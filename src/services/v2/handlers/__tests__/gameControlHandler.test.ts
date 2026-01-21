/**
 * gameControlHandler Unit Tests
 */

import {
  handleAssignRoles,
  handleStartGame,
  handleStartNight,
  handleRestartGame,
} from '../gameControlHandler';
import type { HandlerContext } from '../types';
import type {
  AssignRolesIntent,
  StartGameIntent,
  StartNightIntent,
  RestartGameIntent,
} from '../../intents/types';
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
    myUid: 'host-1',
    mySeat: 0,
    ...overrides,
  };
}

// =============================================================================
// handleAssignRoles tests (PR1)
// =============================================================================

describe('handleAssignRoles', () => {
  const seatedState = createMinimalState({
    status: 'seated',
    players: {
      0: { uid: 'p1', seatNumber: 0, role: null, hasViewedRole: false },
      1: { uid: 'p2', seatNumber: 1, role: null, hasViewedRole: false },
      2: { uid: 'p3', seatNumber: 2, role: null, hasViewedRole: false },
    },
  });

  it('should succeed when host and status is seated (happy path)', () => {
    const context = createContext(seatedState);
    const intent: AssignRolesIntent = { type: 'ASSIGN_ROLES' };

    const result = handleAssignRoles(intent, context);

    expect(result.success).toBe(true);
    // PR1: 只产生 ASSIGN_ROLES，不产生 START_NIGHT
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0].type).toBe('ASSIGN_ROLES');
  });

  it('should assign all template roles', () => {
    const context = createContext(seatedState);
    const intent: AssignRolesIntent = { type: 'ASSIGN_ROLES' };

    const result = handleAssignRoles(intent, context);

    const assignAction = result.actions.find((a) => a.type === 'ASSIGN_ROLES');
    expect(assignAction).toBeDefined();
    if (assignAction?.type === 'ASSIGN_ROLES') {
      const assignedRoles = Object.values(assignAction.payload.assignments);
      const sortedRoles = [...assignedRoles].sort((a, b) => a.localeCompare(b));
      expect(sortedRoles).toEqual(['seer', 'villager', 'wolf']);
    }
  });

  it('should fail when not host (edge case)', () => {
    const context = createContext(seatedState, { isHost: false });
    const intent: AssignRolesIntent = { type: 'ASSIGN_ROLES' };

    const result = handleAssignRoles(intent, context);

    expect(result.success).toBe(false);
    expect(result.reason).toBe('host_only');
  });

  it('should fail when status is not seated (edge case)', () => {
    const state = createMinimalState({ status: 'unseated' });
    const context = createContext(state);
    const intent: AssignRolesIntent = { type: 'ASSIGN_ROLES' };

    const result = handleAssignRoles(intent, context);

    expect(result.success).toBe(false);
    expect(result.reason).toBe('invalid_status');
  });

  it('should fail when status is assigned (edge case)', () => {
    const state = createMinimalState({
      status: 'assigned',
      players: {
        0: { uid: 'p1', seatNumber: 0, role: 'villager', hasViewedRole: false },
        1: { uid: 'p2', seatNumber: 1, role: 'wolf', hasViewedRole: false },
        2: { uid: 'p3', seatNumber: 2, role: 'seer', hasViewedRole: false },
      },
    });
    const context = createContext(state);
    const intent: AssignRolesIntent = { type: 'ASSIGN_ROLES' };

    const result = handleAssignRoles(intent, context);

    expect(result.success).toBe(false);
    expect(result.reason).toBe('invalid_status');
  });

  it('should fail when role count mismatches seat count', () => {
    const state = createMinimalState({
      status: 'seated',
      templateRoles: ['villager', 'wolf'], // 2 roles but 3 seats
      players: {
        0: { uid: 'p1', seatNumber: 0, role: null, hasViewedRole: false },
        1: { uid: 'p2', seatNumber: 1, role: null, hasViewedRole: false },
        2: { uid: 'p3', seatNumber: 2, role: null, hasViewedRole: false },
      },
    });
    const context = createContext(state);
    const intent: AssignRolesIntent = { type: 'ASSIGN_ROLES' };

    const result = handleAssignRoles(intent, context);

    expect(result.success).toBe(false);
    expect(result.reason).toBe('role_count_mismatch');
  });

  it('should include side effects', () => {
    const context = createContext(seatedState);
    const intent: AssignRolesIntent = { type: 'ASSIGN_ROLES' };

    const result = handleAssignRoles(intent, context);

    expect(result.sideEffects).toContainEqual({ type: 'BROADCAST_STATE' });
    expect(result.sideEffects).toContainEqual({ type: 'SAVE_STATE' });
  });
});

// =============================================================================
// handleStartGame tests (legacy, will be modified in PR3)
// =============================================================================

describe('handleStartGame', () => {
  const seatedState = createMinimalState({
    status: 'seated',
    players: {
      0: { uid: 'p1', seatNumber: 0, role: null, hasViewedRole: false },
      1: { uid: 'p2', seatNumber: 1, role: null, hasViewedRole: false },
      2: { uid: 'p3', seatNumber: 2, role: null, hasViewedRole: false },
    },
  });

  it('should succeed when host and all seated', () => {
    const context = createContext(seatedState);
    const intent: StartGameIntent = { type: 'START_GAME' };

    const result = handleStartGame(intent, context);

    expect(result.success).toBe(true);
    expect(result.actions).toHaveLength(2);
    expect(result.actions[0].type).toBe('ASSIGN_ROLES');
    expect(result.actions[1].type).toBe('START_NIGHT');
  });

  it('should assign all template roles', () => {
    const context = createContext(seatedState);
    const intent: StartGameIntent = { type: 'START_GAME' };

    const result = handleStartGame(intent, context);

    const assignAction = result.actions.find((a) => a.type === 'ASSIGN_ROLES');
    expect(assignAction).toBeDefined();
    if (assignAction?.type === 'ASSIGN_ROLES') {
      const assignedRoles = Object.values(assignAction.payload.assignments);
      const sortedRoles = [...assignedRoles].sort((a, b) => a.localeCompare(b));
      expect(sortedRoles).toEqual(['seer', 'villager', 'wolf']);
    }
  });

  it('should fail when not host', () => {
    const context = createContext(seatedState, { isHost: false });
    const intent: StartGameIntent = { type: 'START_GAME' };

    const result = handleStartGame(intent, context);

    expect(result.success).toBe(false);
    expect(result.reason).toBe('host_only');
  });

  it('should fail when not all seated', () => {
    const state = createMinimalState({ status: 'unseated' });
    const context = createContext(state);
    const intent: StartGameIntent = { type: 'START_GAME' };

    const result = handleStartGame(intent, context);

    expect(result.success).toBe(false);
    expect(result.reason).toBe('not_all_seated');
  });

  it('should fail when role count mismatches seat count', () => {
    const state = createMinimalState({
      status: 'seated',
      templateRoles: ['villager', 'wolf'], // 2 roles but 3 seats
      players: {
        0: { uid: 'p1', seatNumber: 0, role: null, hasViewedRole: false },
        1: { uid: 'p2', seatNumber: 1, role: null, hasViewedRole: false },
        2: { uid: 'p3', seatNumber: 2, role: null, hasViewedRole: false },
      },
    });
    const context = createContext(state);
    const intent: StartGameIntent = { type: 'START_GAME' };

    const result = handleStartGame(intent, context);

    expect(result.success).toBe(false);
    expect(result.reason).toBe('role_count_mismatch');
  });

  it('should include side effects', () => {
    const context = createContext(seatedState);
    const intent: StartGameIntent = { type: 'START_GAME' };

    const result = handleStartGame(intent, context);

    expect(result.sideEffects).toContainEqual({ type: 'BROADCAST_STATE' });
    expect(result.sideEffects).toContainEqual({ type: 'SAVE_STATE' });
  });
});

// =============================================================================
// handleStartNight tests (PR3: ready → ongoing)
// =============================================================================

describe('handleStartNight', () => {
  const readyState = createMinimalState({
    status: 'ready',
    players: {
      0: { uid: 'p1', seatNumber: 0, role: 'villager', hasViewedRole: true },
      1: { uid: 'p2', seatNumber: 1, role: 'wolf', hasViewedRole: true },
      2: { uid: 'p3', seatNumber: 2, role: 'seer', hasViewedRole: true },
    },
  });

  it('should succeed when host and status is ready (happy path)', () => {
    const context = createContext(readyState);
    const intent: StartNightIntent = { type: 'START_NIGHT' };

    const result = handleStartNight(intent, context);

    expect(result.success).toBe(true);
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0].type).toBe('START_NIGHT');
  });

  it('should set currentActionerIndex to 0', () => {
    const context = createContext(readyState);
    const intent: StartNightIntent = { type: 'START_NIGHT' };

    const result = handleStartNight(intent, context);

    const startNightAction = result.actions.find((a) => a.type === 'START_NIGHT');
    expect(startNightAction).toBeDefined();
    if (startNightAction?.type === 'START_NIGHT') {
      expect(startNightAction.payload.currentActionerIndex).toBe(0);
    }
  });

  it('should fail when not host (gate: host_only)', () => {
    const context = createContext(readyState, { isHost: false });
    const intent: StartNightIntent = { type: 'START_NIGHT' };

    const result = handleStartNight(intent, context);

    expect(result.success).toBe(false);
    expect(result.reason).toBe('host_only');
  });

  it('should fail when state is null (gate: no_state)', () => {
    const context: HandlerContext = {
      state: null,
      isHost: true,
      myUid: 'host-1',
      mySeat: 0,
    };
    const intent: StartNightIntent = { type: 'START_NIGHT' };

    const result = handleStartNight(intent, context);

    expect(result.success).toBe(false);
    expect(result.reason).toBe('no_state');
  });

  it('should fail when status is assigned (gate: invalid_status)', () => {
    const state = createMinimalState({
      status: 'assigned',
      players: {
        0: { uid: 'p1', seatNumber: 0, role: 'villager', hasViewedRole: false },
        1: { uid: 'p2', seatNumber: 1, role: 'wolf', hasViewedRole: false },
        2: { uid: 'p3', seatNumber: 2, role: 'seer', hasViewedRole: false },
      },
    });
    const context = createContext(state);
    const intent: StartNightIntent = { type: 'START_NIGHT' };

    const result = handleStartNight(intent, context);

    expect(result.success).toBe(false);
    expect(result.reason).toBe('invalid_status');
  });

  it('should fail when status is ongoing (gate: invalid_status)', () => {
    const state = createMinimalState({
      status: 'ongoing',
      players: {
        0: { uid: 'p1', seatNumber: 0, role: 'villager', hasViewedRole: true },
        1: { uid: 'p2', seatNumber: 1, role: 'wolf', hasViewedRole: true },
        2: { uid: 'p3', seatNumber: 2, role: 'seer', hasViewedRole: true },
      },
    });
    const context = createContext(state);
    const intent: StartNightIntent = { type: 'START_NIGHT' };

    const result = handleStartNight(intent, context);

    expect(result.success).toBe(false);
    expect(result.reason).toBe('invalid_status');
  });

  it('should fail when status is ended (gate: invalid_status)', () => {
    const state = createMinimalState({ status: 'ended' });
    const context = createContext(state);
    const intent: StartNightIntent = { type: 'START_NIGHT' };

    const result = handleStartNight(intent, context);

    expect(result.success).toBe(false);
    expect(result.reason).toBe('invalid_status');
  });

  it('should include side effects', () => {
    const context = createContext(readyState);
    const intent: StartNightIntent = { type: 'START_NIGHT' };

    const result = handleStartNight(intent, context);

    expect(result.sideEffects).toContainEqual({ type: 'BROADCAST_STATE' });
    expect(result.sideEffects).toContainEqual({ type: 'SAVE_STATE' });
  });
});

describe('handleRestartGame', () => {
  it('should succeed when host', () => {
    const state = createMinimalState({ status: 'ended' });
    const context = createContext(state);
    const intent: RestartGameIntent = { type: 'RESTART_GAME' };

    const result = handleRestartGame(intent, context);

    expect(result.success).toBe(true);
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0].type).toBe('RESTART_GAME');
  });

  it('should fail when not host', () => {
    const state = createMinimalState({ status: 'ended' });
    const context = createContext(state, { isHost: false });
    const intent: RestartGameIntent = { type: 'RESTART_GAME' };

    const result = handleRestartGame(intent, context);

    expect(result.success).toBe(false);
    expect(result.reason).toBe('host_only');
  });

  it('should include side effects', () => {
    const state = createMinimalState({ status: 'ended' });
    const context = createContext(state);
    const intent: RestartGameIntent = { type: 'RESTART_GAME' };

    const result = handleRestartGame(intent, context);

    expect(result.sideEffects).toContainEqual({ type: 'BROADCAST_STATE' });
    expect(result.sideEffects).toContainEqual({ type: 'SAVE_STATE' });
  });
});
