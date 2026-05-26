/**
 * WolfRobot Hunter Status Gate Server Enforcement Contract Tests
 *
 * Gate 5 trigger conditions (blocks only when all three are met):
 * 1. currentStepId === 'wolfRobotLearn'
 * 2. wolfRobotReveal.learnedRoleId === 'hunter'
 * 3. wolfRobotHunterStatusViewed === false
 *
 * Verifies:
 * 1. Server rejects advance when all 3 conditions met (server enforce)
 * 2. Server allows advance after gate is viewed
 * 3. Server allows advance when not applicable (wrong step or not hunter)
 * 4. Handler correctly validates and returns SET_WOLF_ROBOT_HUNTER_STATUS_VIEWED action
 *
 * This test file only tests Gate logic in handleAdvanceNight.
 * Facade security validation tests should go in gameActions unit tests.
 */

import { handleAdvanceNight } from '@werewolf/game-engine/engine/handlers/stepTransitionHandler';
import type { HandlerContext } from '@werewolf/game-engine/engine/handlers/types';
import { handleSetWolfRobotHunterStatusViewed } from '@werewolf/game-engine/engine/handlers/wolfRobotHunterGateHandler';
import { GameStatus } from '@werewolf/game-engine/models/GameStatus';
import type { GameState } from '@werewolf/game-engine/protocol/types';

import { expectError, expectSuccess } from './handlerTestUtils';

// Create minimal state for testing
function createTestState(overrides?: Partial<GameState>): GameState {
  return {
    roomCode: 'TEST',
    hostUserId: 'HOST',
    status: GameStatus.Ongoing,
    templateRoles: ['wolfRobot', 'hunter', 'villager'],
    players: {
      0: { userId: 'U1', seat: 0, role: 'wolfRobot', hasViewedRole: true },
      1: { userId: 'U2', seat: 1, role: 'hunter', hasViewedRole: true },
      2: { userId: 'U3', seat: 2, role: 'villager', hasViewedRole: true },
    },
    currentStepIndex: 0,
    currentStepId: 'wolfRobotLearn',
    isAudioPlaying: false,
    actions: [],
    pendingRevealAcks: [],
    hypnotizedSeats: [],
    piperRevealAcks: [],
    conversionRevealAcks: [],
    cupidLoversRevealAcks: [],
    roster: {},
    wolfRobotReveal: {
      targetSeat: 1,
      result: 'hunter',
      learnedRoleId: 'hunter',
      canShootAsHunter: true,
    },
    wolfRobotHunterStatusViewed: false,
    ...overrides,
  };
}

describe('WolfRobot Hunter Status Gate - Server Enforcement (handleAdvanceNight)', () => {
  describe('Gate 5: wolfRobotHunterStatusViewed', () => {
    it('rejects advance when wolfRobotHunterStatusViewed === false (server enforce)', () => {
      const state = createTestState({
        wolfRobotHunterStatusViewed: false,
      });

      const context: HandlerContext = {
        state,
        myUserId: 'HOST',
        mySeat: 0,
      };

      const result = handleAdvanceNight({ type: 'ADVANCE_NIGHT' }, context);

      const err = expectError(result);
      expect(err.reason).toBe('wolfrobot_hunter_status_not_viewed');
    });

    it('allows advance when wolfRobotHunterStatusViewed === true', () => {
      const state = createTestState({
        wolfRobotHunterStatusViewed: true, // viewed
      });

      const context: HandlerContext = {
        state,
        myUserId: 'HOST',
        mySeat: 0,
      };

      const result = handleAdvanceNight({ type: 'ADVANCE_NIGHT' }, context);

      expectSuccess(result);
    });

    it('allows advance when not learned hunter (no gate needed)', () => {
      const state = createTestState({
        wolfRobotReveal: {
          targetSeat: 2,
          result: 'villager',
          learnedRoleId: 'villager',
        },
        wolfRobotHunterStatusViewed: undefined, // gate not set
      });

      const context: HandlerContext = {
        state,
        myUserId: 'HOST',
        mySeat: 0,
      };

      const result = handleAdvanceNight({ type: 'ADVANCE_NIGHT' }, context);

      expectSuccess(result);
    });

    it('[boundary] must allow advance when not in wolfRobotLearn step, even if wolfRobotHunterStatusViewed === false', () => {
      const state = createTestState({
        currentStepId: 'seerCheck', // different step - NOT wolfRobotLearn
        wolfRobotHunterStatusViewed: false, // gate still false but wrong step
      });

      const context: HandlerContext = {
        state,
        myUserId: 'HOST',
        mySeat: 0,
      };

      const result = handleAdvanceNight({ type: 'ADVANCE_NIGHT' }, context);

      // Gate 5 only takes effect in wolfRobotLearn step; other steps do not block
      expectSuccess(result);
    });

    it('allows advance when canShootAsHunter === false but status is viewed', () => {
      // This test confirms gate conditions only look at learnedRoleId + wolfRobotHunterStatusViewed
      // canShootAsHunter only affects UI display, not the gate
      const state = createTestState({
        wolfRobotReveal: {
          targetSeat: 1,
          result: 'hunter',
          learnedRoleId: 'hunter',
          canShootAsHunter: false, // poisoned, cannot shoot
        },
        wolfRobotHunterStatusViewed: true, // but viewed
      });

      const context: HandlerContext = {
        state,
        myUserId: 'HOST',
        mySeat: 0,
      };

      const result = handleAdvanceNight({ type: 'ADVANCE_NIGHT' }, context);

      expectSuccess(result);
    });
  });
});

describe('handleSetWolfRobotHunterStatusViewed - Handler Contract', () => {
  describe('validation gates', () => {
    it('rejects when state is null', () => {
      const context: HandlerContext = {
        state: null, // no state
        myUserId: 'HOST',
        mySeat: 0,
      };

      const result = handleSetWolfRobotHunterStatusViewed(context, {
        type: 'SET_WOLF_ROBOT_HUNTER_STATUS_VIEWED',
        seat: 0,
      });

      const err = expectError(result);
      expect(err.reason).toBe('no_state');
    });

    it('rejects when step is not wolfRobotLearn', () => {
      const state = createTestState({
        currentStepId: 'seerCheck', // wrong step
      });
      const context: HandlerContext = {
        state,
        myUserId: 'HOST',
        mySeat: 0,
      };

      const result = handleSetWolfRobotHunterStatusViewed(context, {
        type: 'SET_WOLF_ROBOT_HUNTER_STATUS_VIEWED',
        seat: 0,
      });

      const err = expectError(result);
      expect(err.reason).toBe('invalid_step');
    });

    it('rejects when not learned hunter', () => {
      const state = createTestState({
        wolfRobotReveal: {
          targetSeat: 2,
          result: 'villager',
          learnedRoleId: 'villager',
        },
      });
      const context: HandlerContext = {
        state,
        myUserId: 'HOST',
        mySeat: 0,
      };

      const result = handleSetWolfRobotHunterStatusViewed(context, {
        type: 'SET_WOLF_ROBOT_HUNTER_STATUS_VIEWED',
        seat: 0,
      });

      const err = expectError(result);
      expect(err.reason).toBe('not_learned_hunter');
    });

    it('rejects when seat is not wolfRobot', () => {
      const state = createTestState();
      const context: HandlerContext = {
        state,
        myUserId: 'HOST',
        mySeat: 1,
      };

      const result = handleSetWolfRobotHunterStatusViewed(context, {
        type: 'SET_WOLF_ROBOT_HUNTER_STATUS_VIEWED',
        seat: 1, // hunter seat, not wolfRobot
      });

      const err = expectError(result);
      expect(err.reason).toBe('invalid_seat');
    });
  });

  describe('success path', () => {
    it('returns SET_WOLF_ROBOT_HUNTER_STATUS_VIEWED action when all validations pass', () => {
      const state = createTestState();
      const context: HandlerContext = {
        state,
        myUserId: 'HOST',
        mySeat: 0,
      };

      const result = handleSetWolfRobotHunterStatusViewed(context, {
        type: 'SET_WOLF_ROBOT_HUNTER_STATUS_VIEWED',
        seat: 0, // wolfRobot seat
      });

      const success = expectSuccess(result);
      expect(success.actions).toHaveLength(1);
      expect(success.actions[0]).toEqual({
        type: 'SET_WOLF_ROBOT_HUNTER_STATUS_VIEWED',
        payload: { viewed: true },
      });
    });
  });

  describe('gate integration (handler + advance)', () => {
    it('after handler sets viewed, advance should succeed', () => {
      // Step 1: Initial state - advance blocked
      const initialState = createTestState({
        wolfRobotHunterStatusViewed: false,
      });

      const ctx1: HandlerContext = {
        state: initialState,
        myUserId: 'HOST',
        mySeat: 0,
      };

      const advanceResult1 = handleAdvanceNight({ type: 'ADVANCE_NIGHT' }, ctx1);
      const err = expectError(advanceResult1);
      expect(err.reason).toBe('wolfrobot_hunter_status_not_viewed');

      // Step 2: Call handler to set viewed
      const handlerResult = handleSetWolfRobotHunterStatusViewed(ctx1, {
        type: 'SET_WOLF_ROBOT_HUNTER_STATUS_VIEWED',
        seat: 0,
      });
      expectSuccess(handlerResult);

      // Step 3: Simulate reducer applying the action
      const updatedState = createTestState({
        wolfRobotHunterStatusViewed: true, // simulated after reducer
      });

      const ctx2: HandlerContext = {
        state: updatedState,
        myUserId: 'HOST',
        mySeat: 0,
      };

      // Step 4: Now advance should succeed
      const advanceResult2 = handleAdvanceNight({ type: 'ADVANCE_NIGHT' }, ctx2);
      expectSuccess(advanceResult2);
    });
  });
});
