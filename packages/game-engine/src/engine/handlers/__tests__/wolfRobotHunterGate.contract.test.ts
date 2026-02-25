/**
 * WolfRobot Hunter Status Gate Host Enforcement Contract Tests
 *
 * Gate 5 触发条件（三条件全满足才阻挡）:
 * 1. currentStepId === 'wolfRobotLearn'
 * 2. wolfRobotReveal.learnedRoleId === 'hunter'
 * 3. wolfRobotHunterStatusViewed === false
 *
 * Verifies:
 * 1. Host rejects advance when all 3 conditions met (Host enforce)
 * 2. Host allows advance after gate is viewed
 * 3. Host allows advance when not applicable (wrong step or not hunter)
 * 4. Handler correctly validates and returns SET_WOLF_ROBOT_HUNTER_STATUS_VIEWED action
 *
 * 本测试文件只测试 handleAdvanceNight 的 Gate 逻辑。
 * Facade 的 security validation 测试应放在 gameActions 的单元测试中。
 */

import { handleAdvanceNight } from '@werewolf/game-engine/engine/handlers/stepTransitionHandler';
import type { HandlerContext } from '@werewolf/game-engine/engine/handlers/types';
import { handleSetWolfRobotHunterStatusViewed } from '@werewolf/game-engine/engine/handlers/wolfRobotHunterGateHandler';
import { GameStatus } from '@werewolf/game-engine/models/GameStatus';
import type { GameState } from '@werewolf/game-engine/protocol/types';

// Create minimal state for testing
function createTestState(overrides?: Partial<GameState>): GameState {
  return {
    roomCode: 'TEST',
    hostUid: 'HOST',
    status: GameStatus.Ongoing,
    templateRoles: ['wolfRobot', 'hunter', 'villager'],
    players: {
      0: { uid: 'U1', seatNumber: 0, displayName: 'P1', role: 'wolfRobot', hasViewedRole: true },
      1: { uid: 'U2', seatNumber: 1, displayName: 'P2', role: 'hunter', hasViewedRole: true },
      2: { uid: 'U3', seatNumber: 2, displayName: 'P3', role: 'villager', hasViewedRole: true },
    },
    currentStepIndex: 0,
    currentStepId: 'wolfRobotLearn',
    isAudioPlaying: false,
    actions: [],
    pendingRevealAcks: [],
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

describe('WolfRobot Hunter Status Gate - Host Enforcement (handleAdvanceNight)', () => {
  describe('Gate 5: wolfRobotHunterStatusViewed', () => {
    it('rejects advance when wolfRobotHunterStatusViewed === false (Host enforce)', () => {
      const state = createTestState({
        wolfRobotHunterStatusViewed: false,
      });

      const context: HandlerContext = {
        state,
        myUid: 'HOST',
        mySeat: 0,
      };

      const result = handleAdvanceNight({ type: 'ADVANCE_NIGHT' }, context);

      expect(result.success).toBe(false);
      expect(result.reason).toBe('wolfrobot_hunter_status_not_viewed');
    });

    it('allows advance when wolfRobotHunterStatusViewed === true', () => {
      const state = createTestState({
        wolfRobotHunterStatusViewed: true, // viewed
      });

      const context: HandlerContext = {
        state,
        myUid: 'HOST',
        mySeat: 0,
      };

      const result = handleAdvanceNight({ type: 'ADVANCE_NIGHT' }, context);

      expect(result.success).toBe(true);
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
        myUid: 'HOST',
        mySeat: 0,
      };

      const result = handleAdvanceNight({ type: 'ADVANCE_NIGHT' }, context);

      expect(result.success).toBe(true);
    });

    it('[边界] 不在 wolfRobotLearn step 时，即使 wolfRobotHunterStatusViewed === false 也必须允许推进', () => {
      const state = createTestState({
        currentStepId: 'seerCheck', // different step - NOT wolfRobotLearn
        wolfRobotHunterStatusViewed: false, // gate still false but wrong step
      });

      const context: HandlerContext = {
        state,
        myUid: 'HOST',
        mySeat: 0,
      };

      const result = handleAdvanceNight({ type: 'ADVANCE_NIGHT' }, context);

      // Gate 5 只在 wolfRobotLearn step 生效，其他 step 不阻挡
      expect(result.success).toBe(true);
    });

    it('allows advance when canShootAsHunter === false but status is viewed', () => {
      // 这测试确认 gate 条件只看 learnedRoleId + wolfRobotHunterStatusViewed
      // canShootAsHunter 仅影响 UI 显示，不影响 gate
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
        myUid: 'HOST',
        mySeat: 0,
      };

      const result = handleAdvanceNight({ type: 'ADVANCE_NIGHT' }, context);

      expect(result.success).toBe(true);
    });
  });
});

describe('handleSetWolfRobotHunterStatusViewed - Handler Contract', () => {
  describe('validation gates', () => {
    it('rejects when state is null', () => {
      const context: HandlerContext = {
        state: null, // no state
        myUid: 'HOST',
        mySeat: 0,
      };

      const result = handleSetWolfRobotHunterStatusViewed(context, {
        type: 'SET_WOLF_ROBOT_HUNTER_STATUS_VIEWED',
        seat: 0,
      });

      expect(result.success).toBe(false);
      expect(result.reason).toBe('no_state');
    });

    it('rejects when step is not wolfRobotLearn', () => {
      const state = createTestState({
        currentStepId: 'seerCheck', // wrong step
      });
      const context: HandlerContext = {
        state,
        myUid: 'HOST',
        mySeat: 0,
      };

      const result = handleSetWolfRobotHunterStatusViewed(context, {
        type: 'SET_WOLF_ROBOT_HUNTER_STATUS_VIEWED',
        seat: 0,
      });

      expect(result.success).toBe(false);
      expect(result.reason).toBe('invalid_step');
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
        myUid: 'HOST',
        mySeat: 0,
      };

      const result = handleSetWolfRobotHunterStatusViewed(context, {
        type: 'SET_WOLF_ROBOT_HUNTER_STATUS_VIEWED',
        seat: 0,
      });

      expect(result.success).toBe(false);
      expect(result.reason).toBe('not_learned_hunter');
    });

    it('rejects when seat is not wolfRobot', () => {
      const state = createTestState();
      const context: HandlerContext = {
        state,
        myUid: 'HOST',
        mySeat: 1,
      };

      const result = handleSetWolfRobotHunterStatusViewed(context, {
        type: 'SET_WOLF_ROBOT_HUNTER_STATUS_VIEWED',
        seat: 1, // hunter seat, not wolfRobot
      });

      expect(result.success).toBe(false);
      expect(result.reason).toBe('invalid_seat');
    });
  });

  describe('success path', () => {
    it('returns SET_WOLF_ROBOT_HUNTER_STATUS_VIEWED action when all validations pass', () => {
      const state = createTestState();
      const context: HandlerContext = {
        state,
        myUid: 'HOST',
        mySeat: 0,
      };

      const result = handleSetWolfRobotHunterStatusViewed(context, {
        type: 'SET_WOLF_ROBOT_HUNTER_STATUS_VIEWED',
        seat: 0, // wolfRobot seat
      });

      expect(result.success).toBe(true);
      expect(result.actions).toHaveLength(1);
      expect(result.actions[0]).toEqual({
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
        myUid: 'HOST',
        mySeat: 0,
      };

      const advanceResult1 = handleAdvanceNight({ type: 'ADVANCE_NIGHT' }, ctx1);
      expect(advanceResult1.success).toBe(false);
      expect(advanceResult1.reason).toBe('wolfrobot_hunter_status_not_viewed');

      // Step 2: Call handler to set viewed
      const handlerResult = handleSetWolfRobotHunterStatusViewed(ctx1, {
        type: 'SET_WOLF_ROBOT_HUNTER_STATUS_VIEWED',
        seat: 0,
      });
      expect(handlerResult.success).toBe(true);

      // Step 3: Simulate reducer applying the action
      const updatedState = createTestState({
        wolfRobotHunterStatusViewed: true, // simulated after reducer
      });

      const ctx2: HandlerContext = {
        state: updatedState,
        myUid: 'HOST',
        mySeat: 0,
      };

      // Step 4: Now advance should succeed
      const advanceResult2 = handleAdvanceNight({ type: 'ADVANCE_NIGHT' }, ctx2);
      expect(advanceResult2.success).toBe(true);
    });
  });
});
