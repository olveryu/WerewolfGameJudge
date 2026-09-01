/**
 * gameControlHandler Unit Tests
 */

import {
  handleAssignRoles as executeAssignRoles,
  handleRestartGame as executeRestartGame,
  handleShareNightReview,
  handleStartNight as executeStartNight,
  handleUpdateTemplate,
} from '@game-judge/game-engine/games/werewolf/domain/handlers/gameControlHandler';
import type { HandlerContext } from '@game-judge/game-engine/games/werewolf/domain/handlers/types';
import type {
  AssignRolesIntent,
  RestartGameIntent,
  ShareNightReviewIntent,
  StartNightIntent,
  UpdateTemplateIntent,
} from '@game-judge/game-engine/games/werewolf/domain/intents/types';
import { GameStatus } from '@game-judge/game-engine/games/werewolf/domain/models/GameStatus';
import { gameReducer } from '@game-judge/game-engine/games/werewolf/domain/reducer/gameReducer';
import { normalizeState } from '@game-judge/game-engine/games/werewolf/domain/state/normalize';
import type { GameState } from '@game-judge/game-engine/games/werewolf/public';
import { WEREWOLF_STATE_IDENTITY } from '@game-judge/game-engine/games/werewolf/state/version';

import { expectError, expectSuccess, TEST_HANDLER_EXECUTION } from './handlerTestUtils';

function createMinimalState(overrides?: Partial<GameState>): GameState {
  return {
    ...WEREWOLF_STATE_IDENTITY,
    roomCode: 'TEST',
    hostUserId: 'host-1',
    status: GameStatus.Unseated,
    templateRoles: ['villager', 'wolf', 'seer'],
    players: { 0: null, 1: null, 2: null },
    currentStepIndex: -1,
    isAudioPlaying: false,
    actions: [],
    pendingRevealAcks: [],
    hypnotizedSeats: [],
    piperRevealAcks: [],
    conversionRevealAcks: [],
    cupidLoversRevealAcks: [],
    seedWolfInfectionRevealAcks: [],
    roster: {},
    ...overrides,
  };
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

function handleStartNight(intent: StartNightIntent, context: HandlerContext) {
  return executeStartNight(intent, context, TEST_HANDLER_EXECUTION);
}

function handleRestartGame(intent: RestartGameIntent, context: HandlerContext) {
  return executeRestartGame(intent, context, TEST_HANDLER_EXECUTION);
}

// =============================================================================
// handleAssignRoles tests (PR1)
// =============================================================================

describe('handleAssignRoles', () => {
  const seatedState = createMinimalState({
    status: GameStatus.Seated,
    players: {
      0: { userId: 'p1', seat: 0, role: null, hasViewedRole: false },
      1: { userId: 'p2', seat: 1, role: null, hasViewedRole: false },
      2: { userId: 'p3', seat: 2, role: null, hasViewedRole: false },
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
        0: { userId: 'p1', seat: 0, role: null, hasViewedRole: false },
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
        0: { userId: 'p1', seat: 0, role: null, hasViewedRole: false },
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
        0: { userId: 'p1', seat: 0, role: 'villager', hasViewedRole: false },
        1: { userId: 'p2', seat: 1, role: 'wolf', hasViewedRole: false },
        2: { userId: 'p3', seat: 2, role: 'seer', hasViewedRole: false },
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
        0: { userId: 'p1', seat: 0, role: null, hasViewedRole: false },
        1: { userId: 'p2', seat: 1, role: null, hasViewedRole: false },
        2: { userId: 'p3', seat: 2, role: null, hasViewedRole: false },
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

describe('handleStartNight', () => {
  const readyState = createMinimalState({
    status: GameStatus.Ready,
    players: {
      0: { userId: 'p1', seat: 0, role: 'villager', hasViewedRole: true },
      1: { userId: 'p2', seat: 1, role: 'wolf', hasViewedRole: true },
      2: { userId: 'p3', seat: 2, role: 'seer', hasViewedRole: true },
    },
  });

  it('should succeed when host and status is ready (happy path)', () => {
    const context = createContext(readyState);
    const intent: StartNightIntent = { type: 'START_NIGHT' };

    const result = handleStartNight(intent, context);

    const success = expectSuccess(result);
    expect(success.actions).toHaveLength(3);
    expect(success.actions[0]!.type).toBe('START_NIGHT');
  });

  it('should set currentStepIndex to 0', () => {
    const context = createContext(readyState);
    const intent: StartNightIntent = { type: 'START_NIGHT' };

    const result = handleStartNight(intent, context);

    const success = expectSuccess(result);
    const startNightAction = success.actions.find((a) => a.type === 'START_NIGHT');
    expect(startNightAction).toBeDefined();
    if (startNightAction?.type === 'START_NIGHT') {
      expect(startNightAction.payload.currentStepIndex).toBe(0);
    }
  });

  it('should set currentStepId from buildNightPlan (table-driven single source, filtered by templateRoles)', () => {
    const context = createContext(readyState);
    const intent: StartNightIntent = { type: 'START_NIGHT' };

    const result = handleStartNight(intent, context);

    const success = expectSuccess(result);
    const startNightAction = success.actions.find((a) => a.type === 'START_NIGHT');
    expect(startNightAction).toBeDefined();
    if (startNightAction?.type === 'START_NIGHT') {
      // First step comes from buildNightPlan's table-driven single source, filtered by template roles
      // readyState has villager/wolf/seer -> first step is 'wolfKill' (not magicianSwap, since no magician)
      expect(startNightAction.payload.currentStepId).toBe('wolfKill');
    }
  });

  it('should set witchContext when first step is witchAction (no wolf template)', () => {
    // No-wolf board: only witch + villagers
    const noWolfState = createMinimalState({
      status: GameStatus.Ready,
      templateRoles: ['villager', 'villager', 'witch'],
      players: {
        0: { userId: 'p1', seat: 0, role: 'villager', hasViewedRole: true },
        1: { userId: 'p2', seat: 1, role: 'villager', hasViewedRole: true },
        2: { userId: 'p3', seat: 2, role: 'witch', hasViewedRole: true },
      },
    });
    const context = createContext(noWolfState);
    const intent: StartNightIntent = { type: 'START_NIGHT' };

    const result = handleStartNight(intent, context);

    const success = expectSuccess(result);

    // START_NIGHT + SET_WITCH_CONTEXT + authoritative audio queue pair.
    expect(success.actions.length).toBe(4);

    const startNightAction = success.actions.find((a) => a.type === 'START_NIGHT');
    expect(startNightAction).toBeDefined();
    if (startNightAction?.type === 'START_NIGHT') {
      // First step should be witchAction (no wolf, wolfKill skipped)
      expect(startNightAction.payload.currentStepId).toBe('witchAction');
    }

    const witchContextAction = success.actions.find((a) => a.type === 'SET_WITCH_CONTEXT');
    expect(witchContextAction).toBeDefined();
    if (witchContextAction?.type === 'SET_WITCH_CONTEXT') {
      // No one died
      expect(witchContextAction.payload.killedSeat).toBe(-1);
      // No one to save
      expect(witchContextAction.payload.canSave).toBe(false);
      // Poison available
      expect(witchContextAction.payload.canPoison).toBe(true);
    }
  });

  it('should fail when status is assigned (gate: invalid_status)', () => {
    const state = createMinimalState({
      status: GameStatus.Assigned,
      players: {
        0: { userId: 'p1', seat: 0, role: 'villager', hasViewedRole: false },
        1: { userId: 'p2', seat: 1, role: 'wolf', hasViewedRole: false },
        2: { userId: 'p3', seat: 2, role: 'seer', hasViewedRole: false },
      },
    });
    const context = createContext(state);
    const intent: StartNightIntent = { type: 'START_NIGHT' };

    const result = handleStartNight(intent, context);

    const err = expectError(result);
    expect(err.reason).toBe('invalid_status');
  });

  it('should fail when status is ongoing (gate: invalid_status)', () => {
    const state = createMinimalState({
      status: GameStatus.Ongoing,
      players: {
        0: { userId: 'p1', seat: 0, role: 'villager', hasViewedRole: true },
        1: { userId: 'p2', seat: 1, role: 'wolf', hasViewedRole: true },
        2: { userId: 'p3', seat: 2, role: 'seer', hasViewedRole: true },
      },
    });
    const context = createContext(state);
    const intent: StartNightIntent = { type: 'START_NIGHT' };

    const result = handleStartNight(intent, context);

    const err = expectError(result);
    expect(err.reason).toBe('invalid_status');
  });

  it('should fail when status is ended (gate: invalid_status)', () => {
    const state = createMinimalState({ status: GameStatus.Ended });
    const context = createContext(state);
    const intent: StartNightIntent = { type: 'START_NIGHT' };

    const result = handleStartNight(intent, context);

    const err = expectError(result);
    expect(err.reason).toBe('invalid_status');
  });

  it('should write the ordered Host audio queue into state actions', () => {
    const context = createContext(readyState);
    const intent: StartNightIntent = { type: 'START_NIGHT' };

    const result = handleStartNight(intent, context);

    const success = expectSuccess(result);
    expect(success.actions).toContainEqual({
      type: 'SET_PENDING_AUDIO_EFFECTS',
      payload: {
        effects: [
          { audioKey: 'night', isEndAudio: false },
          { audioKey: 'wolf', isEndAudio: false },
        ],
      },
    });
    expect(success.actions).toContainEqual({
      type: 'SET_AUDIO_PLAYING',
      payload: { isPlaying: true },
    });
  });

  it('initializes and ends an empty night plan with canonical results', () => {
    const allVillagerState = createMinimalState({
      status: GameStatus.Ready,
      templateRoles: ['villager', 'villager', 'villager'],
      players: {
        0: { userId: 'p1', seat: 0, role: 'villager', hasViewedRole: true },
        1: { userId: 'p2', seat: 1, role: 'villager', hasViewedRole: true },
        2: { userId: 'p3', seat: 2, role: 'villager', hasViewedRole: true },
      },
    });
    const context = createContext(allVillagerState);
    const intent: StartNightIntent = { type: 'START_NIGHT' };

    const result = handleStartNight(intent, context);

    const success = expectSuccess(result);
    expect(success.actions).toEqual([
      {
        type: 'START_NIGHT',
        payload: { currentStepIndex: -1, currentStepId: null },
      },
      { type: 'END_NIGHT', payload: { deaths: [] } },
    ]);
    const finalState = success.actions.reduce(gameReducer, allVillagerState);
    expect(normalizeState(finalState)).toMatchObject({
      status: GameStatus.Ended,
      currentNightResults: {},
      lastNightDeaths: [],
    });
  });
});

describe('handleRestartGame', () => {
  it('should succeed when host', () => {
    const state = createMinimalState({ status: GameStatus.Ended });
    const context = createContext(state);
    const intent: RestartGameIntent = { type: 'RESTART_GAME' };

    const result = handleRestartGame(intent, context);

    const success = expectSuccess(result);
    expect(success.actions).toHaveLength(1);
    expect(success.actions[0]!.type).toBe('RESTART_GAME');
    if (success.actions[0]!.type === 'RESTART_GAME') {
      expect(success.actions[0].nonce).toBe(TEST_HANDLER_EXECUTION.randomSeed);
    }
  });
});

// =============================================================================
// handleUpdateTemplate tests (PR?: allow before view role)
// =============================================================================

describe('handleUpdateTemplate', () => {
  const updateIntent: UpdateTemplateIntent = {
    type: 'UPDATE_TEMPLATE',
    payload: { templateRoles: ['villager', 'wolf', 'seer', 'witch'] },
  };

  it('should succeed when status is unseated', () => {
    const state = createMinimalState({ status: GameStatus.Unseated });
    const context = createContext(state);

    const result = handleUpdateTemplate(updateIntent, context);

    const success = expectSuccess(result);
    expect(success.actions).toHaveLength(1);
    expect(success.actions[0]!.type).toBe('UPDATE_TEMPLATE');
  });

  it('should succeed when status is seated', () => {
    const state = createMinimalState({
      status: GameStatus.Seated,
      players: {
        0: { userId: 'p1', seat: 0, role: null, hasViewedRole: false },
        1: { userId: 'p2', seat: 1, role: null, hasViewedRole: false },
        2: { userId: 'p3', seat: 2, role: null, hasViewedRole: false },
      },
    });
    const context = createContext(state);

    const result = handleUpdateTemplate(updateIntent, context);

    const success = expectSuccess(result);
    expect(success.actions).toHaveLength(1);
    expect(success.actions[0]!.type).toBe('UPDATE_TEMPLATE');
  });

  it.each([GameStatus.Assigned, GameStatus.Ready, GameStatus.Ongoing, GameStatus.Ended] as const)(
    'should fail when status is %s (before_view_only message)',
    (status) => {
      const state = createMinimalState({ status });
      const context = createContext(state);

      const result = handleUpdateTemplate(updateIntent, context);

      const err = expectError(result);
      expect(err.reason).toContain('只能在"分配角色"前修改设置');
    },
  );
});

// =============================================================================
// handleShareNightReview tests
// =============================================================================

describe('handleShareNightReview', () => {
  const endedState = createMinimalState({
    status: GameStatus.Ended,
    players: {
      0: { userId: 'p1', seat: 0, role: 'villager', hasViewedRole: true },
      1: { userId: 'p2', seat: 1, role: 'wolf', hasViewedRole: true },
      2: { userId: 'p3', seat: 2, role: 'seer', hasViewedRole: true },
    },
  });

  const intent: ShareNightReviewIntent = {
    type: 'SHARE_NIGHT_REVIEW',
    allowedSeats: [0, 2],
  };

  it('should succeed for host in ended phase', () => {
    const context = createContext(endedState);
    const result = handleShareNightReview(intent, context);

    const success = expectSuccess(result);
    expect(success.actions).toHaveLength(1);
    expect(success.actions[0]).toEqual({
      type: 'SET_NIGHT_REVIEW_ALLOWED_SEATS',
      allowedSeats: [0, 2],
    });
  });

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
