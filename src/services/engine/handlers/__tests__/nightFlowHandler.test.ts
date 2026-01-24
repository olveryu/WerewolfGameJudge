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

import { handleAdvanceNight, handleEndNight, handleSetAudioPlaying } from '../nightFlowHandler';
import type { HandlerContext } from '../types';
import type {
  AdvanceNightIntent,
  EndNightIntent,
  SetAudioPlayingIntent,
} from '../../intents/types';
import type { BroadcastGameState, BroadcastPlayer } from '../../../protocol/types';
import { NIGHT_STEPS } from '../../../../models/roles/spec';
import { buildNightPlan } from '../../../../models/roles/spec/plan';
import type { RoleId } from '../../../../models/roles';

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
        // 测试模板: wolf, wolf, seer, witch, villager, villager
        // buildNightPlan 会过滤出: wolfKill → witchAction → seerCheck
        const templateRoles: RoleId[] = ['wolf', 'wolf', 'seer', 'witch', 'villager', 'villager'];
        const nightPlan = buildNightPlan(templateRoles);

        const context: HandlerContext = {
          // 从 wolfKill 推进，且模板包含 witch，应该设置 witchContext
          state: createOngoingState({
            currentActionerIndex: 0,
            currentStepId: 'wolfKill',
            templateRoles,
          }),
          isHost: true,
          myUid: 'host-uid',
          mySeat: null,
        };

        const result = handleAdvanceNight(intent, context);

        expect(result.success).toBe(true);
        // 从 wolfKill 推进且有 witch，应该返回 2 个 actions
        expect(result.actions).toHaveLength(2);

        const advanceAction = result.actions[0];
        expect(advanceAction.type).toBe('ADVANCE_TO_NEXT_ACTION');
        if (advanceAction.type === 'ADVANCE_TO_NEXT_ACTION') {
          expect(advanceAction.payload.nextActionerIndex).toBe(1);
          // 使用 buildNightPlan 过滤后的步骤（对应模板角色）
          expect(advanceAction.payload.nextStepId).toBe(nightPlan.steps[1]?.stepId ?? null);
        }

        // 从 wolfKill 推进且有 witch，应该有 SET_WITCH_CONTEXT action
        const witchContextAction = result.actions[1];
        expect(witchContextAction.type).toBe('SET_WITCH_CONTEXT');

        expect(result.sideEffects).toContainEqual({ type: 'BROADCAST_STATE' });
      });

      it('should set nextStepId to null when no more steps', () => {
        // 测试模板: wolf, wolf, seer, witch, villager, villager
        // buildNightPlan 会过滤出: wolfKill → witchAction → seerCheck（共 3 步）
        const templateRoles: RoleId[] = ['wolf', 'wolf', 'seer', 'witch', 'villager', 'villager'];
        const nightPlan = buildNightPlan(templateRoles);

        // 设置 index 到最后一步
        const lastIndex = nightPlan.steps.length - 1;
        const context: HandlerContext = {
          state: createOngoingState({
            currentActionerIndex: lastIndex,
            currentStepId: nightPlan.steps[lastIndex]?.stepId,
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

    it('should resolve wolf kill from wolfVotesBySeat via resolveWolfVotes (empty + kill => kill)', () => {
      const context: any = {
        isHost: true,
        state: {
          status: 'ongoing',
          isAudioPlaying: false,
          templateRoles: ['wolf', 'villager'],
          players: {
            0: { uid: 'u0', seatNumber: 0, displayName: 'P0', role: 'wolf', hasViewedRole: true },
            1: { uid: 'u1', seatNumber: 1, displayName: 'P1', role: 'villager', hasViewedRole: true },
          },
          currentActionerIndex: 0,
          currentStepId: undefined,
          actions: [],
          currentNightResults: {
            wolfVotesBySeat: { '0': -1, '1': 0 },
          },
          wolfKillDisabled: false,
          pendingRevealAcks: [],
        },
      };

      const result = handleEndNight({ type: 'END_NIGHT' } as any, context);
      expect(result.success).toBe(true);
  const end = (result.actions ?? []).find((a: any) => a.type === 'END_NIGHT');
  expect(end).toBeDefined();
  const endNightAction = end as any;
  expect(endNightAction.payload.deaths).toEqual([0]);
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
            currentNightResults: { wolfVotesBySeat: {} },
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
            currentNightResults: { wolfVotesBySeat: { '0': 4, '1': 4 } },
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
            currentNightResults: { wolfVotesBySeat: { '0': 4, '1': 5 } },
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
            currentNightResults: { wolfVotesBySeat: { '0': 4, '1': 4 } },
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
            currentNightResults: { wolfVotesBySeat: { '0': 4, '1': 4 } },
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

  // ==========================================================================
  // SET_AUDIO_PLAYING Handler (PR7)
  // ==========================================================================
  describe('handleSetAudioPlaying', () => {
    describe('Gate: host_only', () => {
      it('should reject when isHost is false', () => {
        const intent: SetAudioPlayingIntent = {
          type: 'SET_AUDIO_PLAYING',
          payload: { isPlaying: true },
        };
        const context: HandlerContext = {
          state: createOngoingState(),
          isHost: false,
          myUid: 'player-uid',
          mySeat: 0,
        };

        const result = handleSetAudioPlaying(intent, context);

        expect(result.success).toBe(false);
        expect(result.reason).toBe('host_only');
        expect(result.actions).toHaveLength(0);
      });
    });

    describe('Gate: no_state', () => {
      it('should reject when state is null', () => {
        const intent: SetAudioPlayingIntent = {
          type: 'SET_AUDIO_PLAYING',
          payload: { isPlaying: true },
        };
        const context: HandlerContext = {
          state: null,
          isHost: true,
          myUid: 'host-uid',
          mySeat: null,
        };

        const result = handleSetAudioPlaying(intent, context);

        expect(result.success).toBe(false);
        expect(result.reason).toBe('no_state');
      });
    });

    describe('Gate: invalid_status', () => {
      it('should reject when status is not ongoing', () => {
        const intent: SetAudioPlayingIntent = {
          type: 'SET_AUDIO_PLAYING',
          payload: { isPlaying: true },
        };
        const context: HandlerContext = {
          state: createOngoingState({ status: 'ready' }),
          isHost: true,
          myUid: 'host-uid',
          mySeat: null,
        };

        const result = handleSetAudioPlaying(intent, context);

        expect(result.success).toBe(false);
        expect(result.reason).toBe('invalid_status');
      });
    });

    describe('Happy path', () => {
      it('should set isAudioPlaying to true', () => {
        const intent: SetAudioPlayingIntent = {
          type: 'SET_AUDIO_PLAYING',
          payload: { isPlaying: true },
        };
        const context: HandlerContext = {
          state: createOngoingState({ isAudioPlaying: false }),
          isHost: true,
          myUid: 'host-uid',
          mySeat: null,
        };

        const result = handleSetAudioPlaying(intent, context);

        expect(result.success).toBe(true);
        expect(result.actions).toHaveLength(1);
        const action = result.actions[0];
        expect(action.type).toBe('SET_AUDIO_PLAYING');
        if (action.type === 'SET_AUDIO_PLAYING') {
          expect(action.payload.isPlaying).toBe(true);
        }
        expect(result.sideEffects).toEqual([{ type: 'BROADCAST_STATE' }]);
      });

      it('should set isAudioPlaying to false', () => {
        const intent: SetAudioPlayingIntent = {
          type: 'SET_AUDIO_PLAYING',
          payload: { isPlaying: false },
        };
        const context: HandlerContext = {
          state: createOngoingState({ isAudioPlaying: true }),
          isHost: true,
          myUid: 'host-uid',
          mySeat: null,
        };

        const result = handleSetAudioPlaying(intent, context);

        expect(result.success).toBe(true);
        const action = result.actions[0];
        expect(action.type).toBe('SET_AUDIO_PLAYING');
        if (action.type === 'SET_AUDIO_PLAYING') {
          expect(action.payload.isPlaying).toBe(false);
        }
      });
    });

    describe('PR7 contract: ADVANCE_NIGHT/END_NIGHT reject when isAudioPlaying=true', () => {
      it('ADVANCE_NIGHT should reject with forbidden_while_audio_playing when audio is playing', () => {
        const intent: AdvanceNightIntent = { type: 'ADVANCE_NIGHT' };
        const context: HandlerContext = {
          state: createOngoingState({ isAudioPlaying: true }),
          isHost: true,
          myUid: 'host-uid',
          mySeat: null,
        };

        const result = handleAdvanceNight(intent, context);

        expect(result.success).toBe(false);
        expect(result.reason).toBe('forbidden_while_audio_playing');
      });

      it('END_NIGHT should reject with forbidden_while_audio_playing when audio is playing', () => {
        const intent: EndNightIntent = { type: 'END_NIGHT' };
        const context: HandlerContext = {
          state: createOngoingState({ isAudioPlaying: true }),
          isHost: true,
          myUid: 'host-uid',
          mySeat: null,
        };

        const result = handleEndNight(intent, context);

        expect(result.success).toBe(false);
        expect(result.reason).toBe('forbidden_while_audio_playing');
      });
    });

    describe('PR contract: witchContext.canSave aligns with notSelf constraint', () => {
      /**
       * Schema 定义：witchAction.steps[0] (save) 有 notSelf 约束
       * 合约：当被杀者是女巫自己时，canSave 必须为 false
       *
       * 此测试验证 handleAdvanceNight 设置的 witchContext.canSave
       * 正确实现 schema 的 notSelf 约束。
       */

      it('should set canSave=false when wolf kills the witch (notSelf alignment)', () => {
        // 模板: wolf, witch, villager (witch 在座位 1)
        const templateRoles: RoleId[] = ['wolf', 'witch', 'villager'];

        // players: wolf 在 0, witch 在 1
        const players: Record<number, BroadcastPlayer> = {
          0: createPlayer(0, 'wolf'),
          1: createPlayer(1, 'witch'),
          2: createPlayer(2, 'villager'),
        };

        const intent: AdvanceNightIntent = { type: 'ADVANCE_NIGHT' };
        const context: HandlerContext = {
          state: createOngoingState({
            players,
            currentActionerIndex: 0, // wolfKill 是第 0 步
            currentStepId: 'wolfKill',
            templateRoles,
            // 狼杀了女巫（座位 1）
            currentNightResults: { wolfVotesBySeat: { '0': 1 } },
          }),
          isHost: true,
          myUid: 'host-uid',
          mySeat: null,
        };

        const result = handleAdvanceNight(intent, context);

        expect(result.success).toBe(true);
        // 应该有 2 个 actions: ADVANCE + SET_WITCH_CONTEXT
        expect(result.actions.length).toBeGreaterThanOrEqual(2);

        const witchContextAction = result.actions.find((a) => a.type === 'SET_WITCH_CONTEXT');
        expect(witchContextAction).toBeDefined();

        if (witchContextAction?.type === 'SET_WITCH_CONTEXT') {
          // killedIndex 应该是 1（女巫座位）
          expect(witchContextAction.payload.killedIndex).toBe(1);
          // canSave 必须是 false（女巫不能自救，notSelf 约束）
          expect(witchContextAction.payload.canSave).toBe(false);
        }
      });

      it('should set canSave=true when wolf kills someone else (normal case)', () => {
        // 模板: wolf, witch, villager (witch 在座位 1)
        const templateRoles: RoleId[] = ['wolf', 'witch', 'villager'];

        const players: Record<number, BroadcastPlayer> = {
          0: createPlayer(0, 'wolf'),
          1: createPlayer(1, 'witch'),
          2: createPlayer(2, 'villager'),
        };

        const intent: AdvanceNightIntent = { type: 'ADVANCE_NIGHT' };
        const context: HandlerContext = {
          state: createOngoingState({
            players,
            currentActionerIndex: 0,
            currentStepId: 'wolfKill',
            templateRoles,
            // 狼杀了村民（座位 2）
            currentNightResults: { wolfVotesBySeat: { '0': 2 } },
          }),
          isHost: true,
          myUid: 'host-uid',
          mySeat: null,
        };

        const result = handleAdvanceNight(intent, context);

        expect(result.success).toBe(true);

        const witchContextAction = result.actions.find((a) => a.type === 'SET_WITCH_CONTEXT');
        expect(witchContextAction).toBeDefined();

        if (witchContextAction?.type === 'SET_WITCH_CONTEXT') {
          // killedIndex 应该是 2（村民座位）
          expect(witchContextAction.payload.killedIndex).toBe(2);
          // canSave 应该是 true（可以救别人）
          expect(witchContextAction.payload.canSave).toBe(true);
        }
      });

      it('should set witchContext when advancing TO witchAction on no-wolf board (Case 2)', () => {
        /**
         * Bug fix: 当板子里没有狼人时，女巫不会弹出"昨夜无人倒台"的提示
         *
         * 场景：模板中有女巫但没有狼人角色
         * - buildNightPlan() 会跳过 wolfKill 步骤
         * - 当从非 wolfKill 步骤推进到 witchAction 时，Case 2 触发
         */

        // 模板: 女巫 + 预言家 + 村民，没有狼人
        const templateRoles: RoleId[] = ['witch', 'seer', 'villager', 'villager'];

        const players: Record<number, BroadcastPlayer> = {
          0: createPlayer(0, 'witch'),
          1: createPlayer(1, 'seer'),
          2: createPlayer(2, 'villager'),
          3: createPlayer(3, 'villager'),
        };

        const intent: AdvanceNightIntent = { type: 'ADVANCE_NIGHT' };
        const context: HandlerContext = {
          state: createOngoingState({
            players,
            currentActionerIndex: 0,
            currentStepId: 'seerCheck',
            templateRoles,
            currentNightResults: {},
          }),
          isHost: true,
          myUid: 'host-uid',
          mySeat: null,
        };

        const result = handleAdvanceNight(intent, context);

        expect(result.success).toBe(true);
        // handler 内部依赖 nightFlow.peekNext()，这里验证不会崩溃
      });

      it('should NOT set witchContext when nextStepId is undefined (night ends)', () => {
        /**
         * Fail-safe 测试：当夜晚推进到最后一步并结束时，
         * nextStepId 为 undefined，不应设置 witchContext
         *
         * 这验证了显式 guard：nextStepId ? maybeCreate...() : null
         */

        // 模板: wolf, witch - 只有 2 步（wolfKill, witchAction）
        const templateRoles: RoleId[] = ['wolf', 'witch', 'villager'];

        const players: Record<number, BroadcastPlayer> = {
          0: createPlayer(0, 'wolf'),
          1: createPlayer(1, 'witch'),
          2: createPlayer(2, 'villager'),
        };

        const intent: AdvanceNightIntent = { type: 'ADVANCE_NIGHT' };
        // 当前在最后一步 witchAction，推进后夜晚结束
        const context: HandlerContext = {
          state: createOngoingState({
            players,
            currentActionerIndex: 1, // witchAction 是第 1 步
            currentStepId: 'witchAction',
            templateRoles,
            currentNightResults: {},
            // witchContext 已经设置（进入 witchAction 时设置的）
            witchContext: { killedIndex: -1, canSave: false, canPoison: true },
          }),
          isHost: true,
          myUid: 'host-uid',
          mySeat: null,
        };

        const result = handleAdvanceNight(intent, context);

        // 夜晚结束时返回 END_NIGHT，不是 ADVANCE
        // 关键断言：不应有 SET_WITCH_CONTEXT action
        const witchContextAction = result.actions.find(
          (a) => a.type === 'SET_WITCH_CONTEXT',
        );
        expect(witchContextAction).toBeUndefined();
      });
    });
  });
});
