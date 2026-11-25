/**
 * gameControlHandler Unit Tests
 */

import {
  handleAbortGame as executeAbortGame,
  handleAssignRoles as executeAssignRoles,
  handleReturnToLobbyGame as executeReturnToLobbyGame,
  handleShareNightReview,
} from '@game-judge/game-engine/games/werewolf/domain/handlers/gameControlHandler';
import type { HandlerContext } from '@game-judge/game-engine/games/werewolf/domain/handlers/types';
import type {
  AbortGameIntent,
  AssignRolesIntent,
  ReturnToLobbyIntent,
  ShareNightReviewIntent,
} from '@game-judge/game-engine/games/werewolf/domain/intents/types';
import { GameStatus } from '@game-judge/game-engine/games/werewolf/domain/models/GameStatus';
import type { WerewolfHumanSeat } from '@game-judge/game-engine/games/werewolf/domain/protocol/types';
import type { GameState } from '@game-judge/game-engine/games/werewolf/public';

import { expectError, expectSuccess, TEST_HANDLER_EXECUTION } from './handlerTestUtils';

function createMinimalState(overrides?: Partial<GameState>): GameState {
  const state: GameState = {
    gameType: 'werewolf',
    roomCode: 'TEST',
    hostUserId: 'host-1',
    status: GameStatus.Unseated,
    templateRoles: ['villager', 'wolf', 'seer'],
    players: { 0: null, 1: null, 2: null },
    roleViewedSeats: [],
    nightState: null,
    isAudioPlaying: false,
    audioBatchId: 0,
    gameSequence: 0,
    pendingAudioEffects: [],
    roster: {},
    ...overrides,
  };
  // Every fixture in this file seats user `p<seat + 1>` at each occupied seat;
  // derive the occupancy roster from the effective players map to match.
  if (overrides?.roster === undefined) {
    const roster: Record<number, WerewolfHumanSeat> = {};
    for (const player of Object.values(state.players)) {
      if (player !== null) {
        roster[player.seat] = {
          seat: player.seat,
          userId: `p${player.seat + 1}`,
          profile: { displayName: 'P' },
        };
      }
    }
    return { ...state, roster };
  }
  return state;
}

function createContext(state: GameState, overrides?: Partial<HandlerContext>): HandlerContext {
  return {
    state,
    myUserId: 'host-1',
    mySeat: 0,
    ...overrides,
  };
}

function handleAssignRoles(intent: AssignRolesIntent, context: HandlerContext) {
  return executeAssignRoles(intent, context, TEST_HANDLER_EXECUTION);
}

function handleAbortGame(intent: AbortGameIntent, context: HandlerContext) {
  return executeAbortGame(intent, context, TEST_HANDLER_EXECUTION);
}

function handleReturnToLobbyGame(intent: ReturnToLobbyIntent, context: HandlerContext) {
  return executeReturnToLobbyGame(intent, context, TEST_HANDLER_EXECUTION);
}

// =============================================================================
// handleAssignRoles tests (PR1)
// =============================================================================

describe('handleAssignRoles', () => {
  const seatedState = createMinimalState({
    status: GameStatus.Seated,
    players: {
      0: { seat: 0, role: null },
      1: { seat: 1, role: null },
      2: { seat: 2, role: null },
    },
  });

  it('should succeed when host and status is seated (happy path)', () => {
    const context = createContext(seatedState);
    const intent: AssignRolesIntent = { type: 'ASSIGN_ROLES' };

    const result = handleAssignRoles(intent, context);

    const success = expectSuccess(result);
    // PR1: only produces ASSIGN_ROLES, no START_NIGHT
    expect(success.actions).toHaveLength(1);
    expect(success.actions[0]!.type).toBe('ASSIGN_ROLES');
  });

  it('should assign all template roles', () => {
    const context = createContext(seatedState);
    const intent: AssignRolesIntent = { type: 'ASSIGN_ROLES' };

    const result = handleAssignRoles(intent, context);

    const success = expectSuccess(result);
    const assignAction = success.actions.find((a) => a.type === 'ASSIGN_ROLES');
    expect(assignAction).toBeDefined();
    if (assignAction?.type === 'ASSIGN_ROLES') {
      const assignedRoles = Object.values(assignAction.payload.assignments);
      const sortedRoles = [...assignedRoles].sort((a, b) => a.localeCompare(b));
      expect(sortedRoles).toEqual(['seer', 'villager', 'wolf']);
    }
  });

  it('produces identical assignments for the same server random seed', () => {
    const context = createContext(seatedState);
    const intent: AssignRolesIntent = { type: 'ASSIGN_ROLES' };

    expect(handleAssignRoles(intent, context)).toEqual(handleAssignRoles(intent, context));
  });

  it('deals treasure-master cards from one legal physical partition', () => {
    const state = createMinimalState({
      status: GameStatus.Seated,
      templateRoles: ['treasureMaster', 'wolf', 'seer', 'villager'],
      players: {
        0: { seat: 0, role: null },
      },
    });

    const success = expectSuccess(
      handleAssignRoles({ type: 'ASSIGN_ROLES' }, createContext(state)),
    );
    const action = success.actions[0];
    expect(action?.type).toBe('ASSIGN_ROLES');
    if (action?.type !== 'ASSIGN_ROLES') throw new Error('expected ASSIGN_ROLES');
    const bottomCards = action.payload.bottomCards;
    if (bottomCards === undefined) throw new Error('expected treasure-master bottom cards');
    expect(action.payload.assignments).toEqual({ 0: 'treasureMaster' });
    expect([...bottomCards].sort()).toEqual(['seer', 'villager', 'wolf']);
    expect(action.payload.treasureMasterSeat).toBe(0);
    expect(action.payload.thiefSeat).toBeUndefined();
  });

  it('deals transformed thief cards in plague mode instead of dropping the deck', () => {
    const state = createMinimalState({
      status: GameStatus.Seated,
      templateRoles: ['thief', 'wolf', 'seer'],
      rules: { isPlagueMode: true },
      players: {
        0: { seat: 0, role: null },
      },
    });

    const success = expectSuccess(
      handleAssignRoles({ type: 'ASSIGN_ROLES' }, createContext(state)),
    );
    const action = success.actions[0];
    expect(action?.type).toBe('ASSIGN_ROLES');
    if (action?.type !== 'ASSIGN_ROLES') throw new Error('expected ASSIGN_ROLES');
    const bottomCards = action.payload.bottomCards;
    if (bottomCards === undefined) throw new Error('expected thief bottom cards');
    expect(action.payload.assignments).toEqual({ 0: 'thief' });
    expect([...bottomCards].sort()).toEqual(['seer', 'villager']);
    expect(action.payload.thiefSeat).toBe(0);
  });

  it('should fail when status is not seated (edge case)', () => {
    const state = createMinimalState({ status: GameStatus.Unseated });
    const context = createContext(state);
    const intent: AssignRolesIntent = { type: 'ASSIGN_ROLES' };

    const result = handleAssignRoles(intent, context);

    const err = expectError(result);
    expect(err.reason).toBe('invalid_status');
  });

  it('should fail when status is assigned (edge case)', () => {
    const state = createMinimalState({
      status: GameStatus.Assigned,
      players: {
        0: { seat: 0, role: 'villager' },
        1: { seat: 1, role: 'wolf' },
        2: { seat: 2, role: 'seer' },
      },
    });
    const context = createContext(state);
    const intent: AssignRolesIntent = { type: 'ASSIGN_ROLES' };

    const result = handleAssignRoles(intent, context);

    const err = expectError(result);
    expect(err.reason).toBe('invalid_status');
  });

  it('should fail when role count mismatches seat count', () => {
    const state = createMinimalState({
      status: GameStatus.Seated,
      templateRoles: ['villager', 'wolf'], // 2 roles but 3 seats
      players: {
        0: { seat: 0, role: null },
        1: { seat: 1, role: null },
        2: { seat: 2, role: null },
      },
    });
    const context = createContext(state);
    const intent: AssignRolesIntent = { type: 'ASSIGN_ROLES' };

    const result = handleAssignRoles(intent, context);

    const err = expectError(result);
    expect(err.reason).toBe('role_count_mismatch');
  });
});

// =============================================================================
// handleStartNight tests (PR3: ready → ongoing)
// =============================================================================

describe('handleAbortGame / handleReturnToLobbyGame', () => {
  it('returnToLobby should succeed when host and the game has ended', () => {
    const state = createMinimalState({ status: GameStatus.Ended });
    const context = createContext(state);
    const intent: ReturnToLobbyIntent = { type: 'RETURN_TO_LOBBY' };

    const result = handleReturnToLobbyGame(intent, context);

    const success = expectSuccess(result);
    expect(success.actions).toHaveLength(1);
    expect(success.actions[0]!.type).toBe('RESTART_GAME');
    if (success.actions[0]!.type === 'RESTART_GAME') {
      expect(success.actions[0].nonce).toBe(TEST_HANDLER_EXECUTION.randomSeed);
    }
  });

  it('returnToLobby should fail while a game is in progress', () => {
    const state = createMinimalState({ status: GameStatus.Ongoing });
    const context = createContext(state);
    const intent: ReturnToLobbyIntent = { type: 'RETURN_TO_LOBBY' };

    const result = handleReturnToLobbyGame(intent, context);

    const err = expectError(result);
    expect(err.reason).toBe('invalid_status');
  });

  it('abort should succeed while a game is in progress', () => {
    const state = createMinimalState({ status: GameStatus.Ongoing });
    const context = createContext(state);
    const intent: AbortGameIntent = { type: 'ABORT_GAME' };

    const result = handleAbortGame(intent, context);

    const success = expectSuccess(result);
    expect(success.actions).toHaveLength(1);
    expect(success.actions[0]!.type).toBe('RESTART_GAME');
    if (success.actions[0]!.type === 'RESTART_GAME') {
      expect(success.actions[0].nonce).toBe(TEST_HANDLER_EXECUTION.randomSeed);
    }
  });

  it('abort should fail once the game has ended', () => {
    const state = createMinimalState({ status: GameStatus.Ended });
    const context = createContext(state);
    const intent: AbortGameIntent = { type: 'ABORT_GAME' };

    const result = handleAbortGame(intent, context);

    const err = expectError(result);
    expect(err.reason).toBe('invalid_status');
  });

  it('abort should fail while narration audio is playing', () => {
    const state = createMinimalState({ status: GameStatus.Ongoing, isAudioPlaying: true });
    const context = createContext(state);
    const intent: AbortGameIntent = { type: 'ABORT_GAME' };

    const result = handleAbortGame(intent, context);

    const err = expectError(result);
    expect(err.reason).toBe('forbidden_while_audio_playing');
  });

  it('abort status gate still wins over the audio gate once the game has ended', () => {
    const state = createMinimalState({ status: GameStatus.Ended, isAudioPlaying: true });
    const context = createContext(state);
    const intent: AbortGameIntent = { type: 'ABORT_GAME' };

    const result = handleAbortGame(intent, context);

    const err = expectError(result);
    expect(err.reason).toBe('invalid_status');
  });

  it('returnToLobby should fail while narration audio is playing', () => {
    const state = createMinimalState({ status: GameStatus.Ended, isAudioPlaying: true });
    const context = createContext(state);
    const intent: ReturnToLobbyIntent = { type: 'RETURN_TO_LOBBY' };

    const result = handleReturnToLobbyGame(intent, context);

    const err = expectError(result);
    expect(err.reason).toBe('forbidden_while_audio_playing');
  });

  it('returnToLobby status gate still wins over the audio gate while a game is in progress', () => {
    const state = createMinimalState({ status: GameStatus.Ongoing, isAudioPlaying: true });
    const context = createContext(state);
    const intent: ReturnToLobbyIntent = { type: 'RETURN_TO_LOBBY' };

    const result = handleReturnToLobbyGame(intent, context);

    const err = expectError(result);
    expect(err.reason).toBe('invalid_status');
  });
});

// (The config update's status gate is pinned at the decide level in
// games/werewolf/__tests__/roomCommands.contract.test.ts — the
// command is decided by the room-command skeleton, not a handler.)

// =============================================================================
// handleShareNightReview tests
// =============================================================================

describe('handleShareNightReview', () => {
  const endedState = createMinimalState({
    status: GameStatus.Ended,
    players: {
      0: { seat: 0, role: 'villager' },
      1: { seat: 1, role: 'wolf' },
      2: { seat: 2, role: 'seer' },
    },
  });

  const intent: ShareNightReviewIntent = {
    type: 'SHARE_NIGHT_REVIEW',
    allowedSeats: [0, 2],
  };

  it.each([GameStatus.Day, GameStatus.Ended] as const)(
    'should succeed for host when status is %s',
    (status) => {
      const context = createContext({ ...endedState, status });
      const result = handleShareNightReview(intent, context);

      const success = expectSuccess(result);
      expect(success.actions).toHaveLength(1);
      expect(success.actions[0]).toEqual({
        type: 'SET_NIGHT_REVIEW_ALLOWED_SEATS',
        allowedSeats: [0, 2],
      });
    },
  );

  it.each([
    GameStatus.Unseated,
    GameStatus.Seated,
    GameStatus.Assigned,
    GameStatus.Ready,
    GameStatus.Ongoing,
  ] as const)('should fail when status is %s', (status) => {
    const state = createMinimalState({ status });
    const context = createContext(state);
    const result = handleShareNightReview(intent, context);

    const err = expectError(result);
    expect(err.reason).toBe('invalid_status');
  });

  it('should accept empty allowedSeats (revoke all)', () => {
    const context = createContext(endedState);
    const result = handleShareNightReview(
      { type: 'SHARE_NIGHT_REVIEW', allowedSeats: [] },
      context,
    );

    const success = expectSuccess(result);
    expect(success.actions[0]).toEqual({
      type: 'SET_NIGHT_REVIEW_ALLOWED_SEATS',
      allowedSeats: [],
    });
  });
});
