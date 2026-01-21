/**
 * Night Flow Handler Tests
 *
 * PR6: ADVANCE_NIGHT / END_NIGHT (Night-1 only)
 *
 * Gate 测试:
 * - host_only
 * - no_state
 * - invalid_status
 * - forbidden_while_audio_playing
 *
 * Happy path 测试:
 * - advanceNight 推进 index 和 stepId
 * - endNight 调用 calculateDeaths 并产出正确 deaths
 */

import { handleAdvanceNight, handleEndNight } from '../nightFlowHandler';
import type { HandlerContext } from '../types';
import type { AdvanceNightIntent, EndNightIntent } from '../../intents/types';
import type { BroadcastGameState, BroadcastPlayer } from '../../../protocol/types';
import { NIGHT_STEPS } from '../../../../models/roles/spec';

/**
 * 创建完整的玩家对象
 */
function createPlayer(
  seat: number,
  role: string,
  overrides?: Partial<BroadcastPlayer>,
): BroadcastPlayer {
  return {
    uid: `player-${seat}`,
    seatNumber: seat,
    displayName: `Player ${seat}`,
    role: role as BroadcastPlayer['role'],
    hasViewedRole: true,
    ...overrides,
  };
}

/**
 * 创建基础的 ongoing 状态
 */
function createOngoingState(overrides?: Partial<BroadcastGameState>): BroadcastGameState {
  return {
    roomCode: 'TEST',
    hostUid: 'host-uid',
    status: 'ongoing',
    templateRoles: ['wolf', 'wolf', 'seer', 'witch', 'villager', 'villager'],
    players: {
      0: createPlayer(0, 'wolf'),
      1: createPlayer(1, 'wolf'),
      2: createPlayer(2, 'seer'),
      3: createPlayer(3, 'witch'),
      4: createPlayer(4, 'villager'),
      5: createPlayer(5, 'villager'),
    },
    currentActionerIndex: 0,
    currentStepId: NIGHT_STEPS[0]?.id,
    isAudioPlaying: false,
    actions: [],
    wolfVotes: {},
    wolfVoteStatus: {},
    currentNightResults: {},
    ...overrides,
  };
}

describe('nightFlowHandler', () => {
  // ==========================================================================
  // ADVANCE_NIGHT Handler
  // ==========================================================================
  describe('handleAdvanceNight', () => {
    const intent: AdvanceNightIntent = { type: 'ADVANCE_NIGHT' };

    describe('Gate: host_only', () => {
      it('should reject when isHost is false', () => {
        const context: HandlerContext = {
          state: createOngoingState(),
          isHost: false,
          myUid: 'player-uid',
          mySeat: 0,
        };

        const result = handleAdvanceNight(intent, context);

        expect(result.success).toBe(false);
        expect(result.reason).toBe('host_only');
        expect(result.actions).toHaveLength(0);
      });
    });

    describe('Gate: no_state', () => {
      it('should reject when state is null', () => {
        const context: HandlerContext = {
          state: null,
          isHost: true,
          myUid: 'host-uid',
          mySeat: null,
        };

        const result = handleAdvanceNight(intent, context);

        expect(result.success).toBe(false);
        expect(result.reason).toBe('no_state');
        expect(result.actions).toHaveLength(0);
      });
    });

    describe('Gate: invalid_status', () => {
      it.each(['unseated', 'seated', 'assigned', 'ready', 'ended'] as const)(
        'should reject when status is %s',
        (status) => {
          const context: HandlerContext = {
            state: createOngoingState({ status }),
            isHost: true,
            myUid: 'host-uid',
            mySeat: null,
          };

          const result = handleAdvanceNight(intent, context);

          expect(result.success).toBe(false);
          expect(result.reason).toBe('invalid_status');
          expect(result.actions).toHaveLength(0);
        },
      );
    });

    describe('Gate: forbidden_while_audio_playing', () => {
      it('should reject when audio is playing', () => {
        const context: HandlerContext = {
          state: createOngoingState({ isAudioPlaying: true }),
          isHost: true,
          myUid: 'host-uid',
          mySeat: null,
        };

        const result = handleAdvanceNight(intent, context);

        expect(result.success).toBe(false);
        expect(result.reason).toBe('forbidden_while_audio_playing');
        expect(result.actions).toHaveLength(0);
      });
    });

    describe('Happy path', () => {
      it('should advance to next action index and stepId', () => {
        const context: HandlerContext = {
          state: createOngoingState({ currentActionerIndex: 0 }),
          isHost: true,
          myUid: 'host-uid',
          mySeat: null,
        };

        const result = handleAdvanceNight(intent, context);

        expect(result.success).toBe(true);
        expect(result.actions).toHaveLength(1);

        const action = result.actions[0];
        expect(action.type).toBe('ADVANCE_TO_NEXT_ACTION');
        if (action.type === 'ADVANCE_TO_NEXT_ACTION') {
          expect(action.payload.nextActionerIndex).toBe(1);
          expect(action.payload.nextStepId).toBe(NIGHT_STEPS[1]?.id ?? null);
        }

        expect(result.sideEffects).toContainEqual({ type: 'BROADCAST_STATE' });
      });

      it('should set nextStepId to null when no more steps', () => {
        // 设置 index 到最后一步
        const lastIndex = NIGHT_STEPS.length - 1;
        const context: HandlerContext = {
          state: createOngoingState({
            currentActionerIndex: lastIndex,
            currentStepId: NIGHT_STEPS[lastIndex]?.id,
          }),
          isHost: true,
          myUid: 'host-uid',
          mySeat: null,
        };

        const result = handleAdvanceNight(intent, context);

        expect(result.success).toBe(true);
        const action = result.actions[0];
        if (action.type === 'ADVANCE_TO_NEXT_ACTION') {
          expect(action.payload.nextActionerIndex).toBe(lastIndex + 1);
          expect(action.payload.nextStepId).toBeNull();
        }
      });
    });
  });

  // ==========================================================================
  // END_NIGHT Handler
  // ==========================================================================
  describe('handleEndNight', () => {
    const intent: EndNightIntent = { type: 'END_NIGHT' };

    describe('Gate: host_only', () => {
      it('should reject when isHost is false', () => {
        const context: HandlerContext = {
          state: createOngoingState(),
          isHost: false,
          myUid: 'player-uid',
          mySeat: 0,
        };

        const result = handleEndNight(intent, context);

        expect(result.success).toBe(false);
        expect(result.reason).toBe('host_only');
        expect(result.actions).toHaveLength(0);
      });
    });

    describe('Gate: no_state', () => {
      it('should reject when state is null', () => {
        const context: HandlerContext = {
          state: null,
          isHost: true,
          myUid: 'host-uid',
          mySeat: null,
        };

        const result = handleEndNight(intent, context);

        expect(result.success).toBe(false);
        expect(result.reason).toBe('no_state');
        expect(result.actions).toHaveLength(0);
      });
    });

    describe('Gate: invalid_status', () => {
      it.each(['unseated', 'seated', 'assigned', 'ready', 'ended'] as const)(
        'should reject when status is %s',
        (status) => {
          const context: HandlerContext = {
            state: createOngoingState({ status }),
            isHost: true,
            myUid: 'host-uid',
            mySeat: null,
          };

          const result = handleEndNight(intent, context);

          expect(result.success).toBe(false);
          expect(result.reason).toBe('invalid_status');
          expect(result.actions).toHaveLength(0);
        },
      );
    });

    describe('Gate: forbidden_while_audio_playing', () => {
      it('should reject when audio is playing', () => {
        const context: HandlerContext = {
          state: createOngoingState({ isAudioPlaying: true }),
          isHost: true,
          myUid: 'host-uid',
          mySeat: null,
        };

        const result = handleEndNight(intent, context);

        expect(result.success).toBe(false);
        expect(result.reason).toBe('forbidden_while_audio_playing');
        expect(result.actions).toHaveLength(0);
      });
    });

    describe('Happy path: death calculation', () => {
      it('should produce END_NIGHT action with empty deaths when no wolf kill', () => {
        // 没有狼投票 = 空刀 = 无死亡
        const context: HandlerContext = {
          state: createOngoingState({
            wolfVotes: {},
          }),
          isHost: true,
          myUid: 'host-uid',
          mySeat: null,
        };

        const result = handleEndNight(intent, context);

        expect(result.success).toBe(true);
        expect(result.actions).toHaveLength(1);

        const action = result.actions[0];
        expect(action.type).toBe('END_NIGHT');
        if (action.type === 'END_NIGHT') {
          expect(action.payload.deaths).toEqual([]);
        }

        expect(result.sideEffects).toContainEqual({ type: 'BROADCAST_STATE' });
      });

      it('should calculate wolf kill death (simple case)', () => {
        // 两只狼都投给 4 号（villager）
        const context: HandlerContext = {
          state: createOngoingState({
            wolfVotes: {
              '0': 4, // wolf at seat 0 votes for seat 4
              '1': 4, // wolf at seat 1 votes for seat 4
            },
          }),
          isHost: true,
          myUid: 'host-uid',
          mySeat: null,
        };

        const result = handleEndNight(intent, context);

        expect(result.success).toBe(true);
        const action = result.actions[0];
        expect(action.type).toBe('END_NIGHT');
        if (action.type === 'END_NIGHT') {
          expect(action.payload.deaths).toContain(4);
        }
      });

      it('should return empty deaths on tie vote (空刀)', () => {
        // 两只狼投不同目标 = 平票 = 空刀
        const context: HandlerContext = {
          state: createOngoingState({
            wolfVotes: {
              '0': 4,
              '1': 5,
            },
          }),
          isHost: true,
          myUid: 'host-uid',
          mySeat: null,
        };

        const result = handleEndNight(intent, context);

        expect(result.success).toBe(true);
        const action = result.actions[0];
        expect(action.type).toBe('END_NIGHT');
        if (action.type === 'END_NIGHT') {
          // 平票 = 空刀 = 无死亡
          expect(action.payload.deaths).toEqual([]);
        }
      });

      it('should return empty deaths when wolfKillDisabled (nightmare blocked wolf)', () => {
        // 狼被封锁，即使投票了也无效
        const context: HandlerContext = {
          state: createOngoingState({
            wolfVotes: {
              '0': 4,
              '1': 4,
            },
            wolfKillDisabled: true,
          }),
          isHost: true,
          myUid: 'host-uid',
          mySeat: null,
        };

        const result = handleEndNight(intent, context);

        expect(result.success).toBe(true);
        const action = result.actions[0];
        expect(action.type).toBe('END_NIGHT');
        if (action.type === 'END_NIGHT') {
          expect(action.payload.deaths).toEqual([]);
        }
      });

      it('should respect guard protection (no death)', () => {
        // 狼刀 4 号，守卫守 4 号
        const context: HandlerContext = {
          state: createOngoingState({
            players: {
              0: createPlayer(0, 'wolf'),
              1: createPlayer(1, 'wolf'),
              2: createPlayer(2, 'seer'),
              3: createPlayer(3, 'guard'), // guard at seat 3
              4: createPlayer(4, 'villager'),
              5: createPlayer(5, 'villager'),
            },
            wolfVotes: {
              '0': 4,
              '1': 4,
            },
            actions: [
              { schemaId: 'guardProtect', actorSeat: 3, targetSeat: 4, timestamp: Date.now() },
            ],
          }),
          isHost: true,
          myUid: 'host-uid',
          mySeat: null,
        };

        const result = handleEndNight(intent, context);

        expect(result.success).toBe(true);
        const action = result.actions[0];
        expect(action.type).toBe('END_NIGHT');
        if (action.type === 'END_NIGHT') {
          // 被守卫保护，无死亡
          expect(action.payload.deaths).not.toContain(4);
        }
      });
    });
  });
});
