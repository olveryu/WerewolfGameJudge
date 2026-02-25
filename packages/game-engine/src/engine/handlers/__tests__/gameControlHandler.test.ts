/**
 * gameControlHandler Unit Tests
 */

import {
  handleAssignRoles,
  handleRestartGame,
  handleShareNightReview,
  handleStartNight,
  handleUpdateTemplate,
} from '@werewolf/game-engine/engine/handlers/gameControlHandler';
import type { HandlerContext } from '@werewolf/game-engine/engine/handlers/types';
import type {
  AssignRolesIntent,
  RestartGameIntent,
  ShareNightReviewIntent,
  StartNightIntent,
  UpdateTemplateIntent,
} from '@werewolf/game-engine/engine/intents/types';
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
    status: GameStatus.Seated,
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

  it('should fail when status is not seated (edge case)', () => {
    const state = createMinimalState({ status: GameStatus.Unseated });
    const context = createContext(state);
    const intent: AssignRolesIntent = { type: 'ASSIGN_ROLES' };

    const result = handleAssignRoles(intent, context);

    expect(result.success).toBe(false);
    expect(result.reason).toBe('invalid_status');
  });

  it('should fail when status is assigned (edge case)', () => {
    const state = createMinimalState({
      status: GameStatus.Assigned,
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
      status: GameStatus.Seated,
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
// handleStartNight tests (PR3: ready → ongoing)
// =============================================================================

describe('handleStartNight', () => {
  const readyState = createMinimalState({
    status: GameStatus.Ready,
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

  it('should set currentStepIndex to 0', () => {
    const context = createContext(readyState);
    const intent: StartNightIntent = { type: 'START_NIGHT' };

    const result = handleStartNight(intent, context);

    const startNightAction = result.actions.find((a) => a.type === 'START_NIGHT');
    expect(startNightAction).toBeDefined();
    if (startNightAction?.type === 'START_NIGHT') {
      expect(startNightAction.payload.currentStepIndex).toBe(0);
    }
  });

  it('should set currentStepId from buildNightPlan (table-driven single source, filtered by templateRoles)', () => {
    const context = createContext(readyState);
    const intent: StartNightIntent = { type: 'START_NIGHT' };

    const result = handleStartNight(intent, context);

    const startNightAction = result.actions.find((a) => a.type === 'START_NIGHT');
    expect(startNightAction).toBeDefined();
    if (startNightAction?.type === 'START_NIGHT') {
      // 首步来自 buildNightPlan 表驱动单源，按模板角色过滤
      // readyState 有 villager/wolf/seer → 首步是 'wolfKill'（不是 magicianSwap，因为没有 magician）
      expect(startNightAction.payload.currentStepId).toBe('wolfKill');
    }
  });

  it('should set witchContext when first step is witchAction (no wolf template)', () => {
    // 无狼板子：只有女巫 + 村民
    const noWolfState = createMinimalState({
      status: GameStatus.Ready,
      templateRoles: ['villager', 'villager', 'witch'],
      players: {
        0: { uid: 'p1', seatNumber: 0, role: 'villager', hasViewedRole: true },
        1: { uid: 'p2', seatNumber: 1, role: 'villager', hasViewedRole: true },
        2: { uid: 'p3', seatNumber: 2, role: 'witch', hasViewedRole: true },
      },
    });
    const context = createContext(noWolfState);
    const intent: StartNightIntent = { type: 'START_NIGHT' };

    const result = handleStartNight(intent, context);

    expect(result.success).toBe(true);

    // 应该有 START_NIGHT + SET_WITCH_CONTEXT 两个 actions
    expect(result.actions.length).toBe(2);

    const startNightAction = result.actions.find((a) => a.type === 'START_NIGHT');
    expect(startNightAction).toBeDefined();
    if (startNightAction?.type === 'START_NIGHT') {
      // 首步应该是 witchAction（无狼，跳过 wolfKill）
      expect(startNightAction.payload.currentStepId).toBe('witchAction');
    }

    const witchContextAction = result.actions.find((a) => a.type === 'SET_WITCH_CONTEXT');
    expect(witchContextAction).toBeDefined();
    if (witchContextAction?.type === 'SET_WITCH_CONTEXT') {
      // 无人死亡
      expect(witchContextAction.payload.killedSeat).toBe(-1);
      // 没有人需要救
      expect(witchContextAction.payload.canSave).toBe(false);
      // 毒药可用
      expect(witchContextAction.payload.canPoison).toBe(true);
    }
  });

  it('should fail when state is null (gate: no_state)', () => {
    const context: HandlerContext = {
      state: null,
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
      status: GameStatus.Assigned,
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
      status: GameStatus.Ongoing,
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
    const state = createMinimalState({ status: GameStatus.Ended });
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

  it('should skip night and return END_NIGHT with empty deaths for all-villager template', () => {
    const allVillagerState = createMinimalState({
      status: GameStatus.Ready,
      templateRoles: ['villager', 'villager', 'villager'],
      players: {
        0: { uid: 'p1', seatNumber: 0, role: 'villager', hasViewedRole: true },
        1: { uid: 'p2', seatNumber: 1, role: 'villager', hasViewedRole: true },
        2: { uid: 'p3', seatNumber: 2, role: 'villager', hasViewedRole: true },
      },
    });
    const context = createContext(allVillagerState);
    const intent: StartNightIntent = { type: 'START_NIGHT' };

    const result = handleStartNight(intent, context);

    expect(result.success).toBe(true);
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0].type).toBe('END_NIGHT');
    if (result.actions[0].type === 'END_NIGHT') {
      expect(result.actions[0].payload.deaths).toEqual([]);
    }
    expect(result.sideEffects).toContainEqual({ type: 'BROADCAST_STATE' });
    expect(result.sideEffects).toContainEqual({ type: 'SAVE_STATE' });
  });
});

describe('handleRestartGame', () => {
  it('should succeed when host', () => {
    const state = createMinimalState({ status: GameStatus.Ended });
    const context = createContext(state);
    const intent: RestartGameIntent = { type: 'RESTART_GAME' };

    const result = handleRestartGame(intent, context);

    expect(result.success).toBe(true);
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0].type).toBe('RESTART_GAME');
  });

  it('should include side effects', () => {
    const state = createMinimalState({ status: GameStatus.Ended });
    const context = createContext(state);
    const intent: RestartGameIntent = { type: 'RESTART_GAME' };

    const result = handleRestartGame(intent, context);

    expect(result.sideEffects).toContainEqual({ type: 'BROADCAST_STATE' });
    expect(result.sideEffects).toContainEqual({ type: 'SAVE_STATE' });
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

    expect(result.success).toBe(true);
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0].type).toBe('UPDATE_TEMPLATE');
    expect(result.sideEffects).toContainEqual({ type: 'BROADCAST_STATE' });
    expect(result.sideEffects).toContainEqual({ type: 'SAVE_STATE' });
  });

  it('should succeed when status is seated', () => {
    const state = createMinimalState({
      status: GameStatus.Seated,
      players: {
        0: { uid: 'p1', seatNumber: 0, role: null, hasViewedRole: false },
        1: { uid: 'p2', seatNumber: 1, role: null, hasViewedRole: false },
        2: { uid: 'p3', seatNumber: 2, role: null, hasViewedRole: false },
      },
    });
    const context = createContext(state);

    const result = handleUpdateTemplate(updateIntent, context);

    expect(result.success).toBe(true);
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0].type).toBe('UPDATE_TEMPLATE');
  });

  it('should fail when state is null (gate: no_state)', () => {
    const context: HandlerContext = {
      state: null,
      myUid: 'host-1',
      mySeat: 0,
    };

    const result = handleUpdateTemplate(updateIntent, context);

    expect(result.success).toBe(false);
    expect(result.reason).toBe('no_state');
  });

  it.each([GameStatus.Assigned, GameStatus.Ready, GameStatus.Ongoing, GameStatus.Ended] as const)(
    'should fail when status is %s (before_view_only message)',
    (status) => {
      const state = createMinimalState({ status });
      const context = createContext(state);

      const result = handleUpdateTemplate(updateIntent, context);

      expect(result.success).toBe(false);
      expect(result.reason).toContain('只能在“准备看牌”前修改设置');
      expect(result.actions).toHaveLength(0);
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
      0: { uid: 'p1', seatNumber: 0, role: 'villager', hasViewedRole: true },
      1: { uid: 'p2', seatNumber: 1, role: 'wolf', hasViewedRole: true },
      2: { uid: 'p3', seatNumber: 2, role: 'seer', hasViewedRole: true },
    },
  });

  const intent: ShareNightReviewIntent = {
    type: 'SHARE_NIGHT_REVIEW',
    allowedSeats: [0, 2],
  };

  it('should succeed for host in ended phase', () => {
    const context = createContext(endedState);
    const result = handleShareNightReview(intent, context);

    expect(result.success).toBe(true);
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0]).toEqual({
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

    expect(result.success).toBe(false);
    expect(result.reason).toBe('invalid_status');
  });

  it('should accept empty allowedSeats (revoke all)', () => {
    const context = createContext(endedState);
    const result = handleShareNightReview(
      { type: 'SHARE_NIGHT_REVIEW', allowedSeats: [] },
      context,
    );

    expect(result.success).toBe(true);
    expect(result.actions[0]).toEqual({
      type: 'SET_NIGHT_REVIEW_ALLOWED_SEATS',
      allowedSeats: [],
    });
  });
});
