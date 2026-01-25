/**
 * gameReducer Unit Tests
 */

import { gameReducer } from '../gameReducer';
import type { GameState } from '../../store/types';
import type {
  PlayerJoinAction,
  PlayerLeaveAction,
  AssignRolesAction,
  StartNightAction,
  AdvanceToNextActionAction,
  EndNightAction,
  RecordActionAction,
  ApplyResolverResultAction,
  PlayerViewedRoleAction,
  SetAudioPlayingAction,
  StateAction,
} from '../types';

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

describe('gameReducer', () => {
  describe('PLAYER_JOIN', () => {
    it('should add player to seat', () => {
      const state = createMinimalState();
      const action: PlayerJoinAction = {
        type: 'PLAYER_JOIN',
        payload: {
          seat: 0,
          player: {
            uid: 'player-1',
            seatNumber: 0,
            displayName: 'Alice',
            role: null,
            hasViewedRole: false,
          },
        },
      };

      const newState = gameReducer(state, action);

      expect(newState.players[0]).toEqual(action.payload.player);
    });

    it('should update status to seated when all seats filled', () => {
      const state = createMinimalState({
        players: {
          0: { uid: 'p1', seatNumber: 0, role: null, hasViewedRole: false },
          1: { uid: 'p2', seatNumber: 1, role: null, hasViewedRole: false },
          2: null,
        },
      });
      const action: PlayerJoinAction = {
        type: 'PLAYER_JOIN',
        payload: {
          seat: 2,
          player: { uid: 'p3', seatNumber: 2, role: null, hasViewedRole: false },
        },
      };

      const newState = gameReducer(state, action);

      expect(newState.status).toBe('seated');
    });
  });

  describe('PLAYER_LEAVE', () => {
    it('should set seat to null', () => {
      const state = createMinimalState({
        players: {
          0: { uid: 'p1', seatNumber: 0, role: null, hasViewedRole: false },
          1: null,
          2: null,
        },
      });
      const action: PlayerLeaveAction = {
        type: 'PLAYER_LEAVE',
        payload: { seat: 0 },
      };

      const newState = gameReducer(state, action);

      expect(newState.players[0]).toBeNull();
    });

    it('should revert status from seated to unseated', () => {
      const state = createMinimalState({
        status: 'seated',
        players: {
          0: { uid: 'p1', seatNumber: 0, role: null, hasViewedRole: false },
          1: { uid: 'p2', seatNumber: 1, role: null, hasViewedRole: false },
          2: { uid: 'p3', seatNumber: 2, role: null, hasViewedRole: false },
        },
      });
      const action: PlayerLeaveAction = {
        type: 'PLAYER_LEAVE',
        payload: { seat: 0 },
      };

      const newState = gameReducer(state, action);

      expect(newState.status).toBe('unseated');
    });
  });

  describe('ASSIGN_ROLES', () => {
    it('should assign roles to players', () => {
      const state = createMinimalState({
        status: 'seated',
        players: {
          0: { uid: 'p1', seatNumber: 0, role: null, hasViewedRole: false },
          1: { uid: 'p2', seatNumber: 1, role: null, hasViewedRole: false },
          2: { uid: 'p3', seatNumber: 2, role: null, hasViewedRole: false },
        },
      });
      const action: AssignRolesAction = {
        type: 'ASSIGN_ROLES',
        payload: {
          assignments: { 0: 'villager', 1: 'wolf', 2: 'seer' },
        },
      };

      const newState = gameReducer(state, action);

      expect(newState.players[0]?.role).toBe('villager');
      expect(newState.players[1]?.role).toBe('wolf');
      expect(newState.players[2]?.role).toBe('seer');
      expect(newState.status).toBe('assigned');
    });

    it('should reset hasViewedRole to false', () => {
      const state = createMinimalState({
        status: 'seated',
        players: {
          0: { uid: 'p1', seatNumber: 0, role: null, hasViewedRole: true },
          1: null,
          2: null,
        },
      });
      const action: AssignRolesAction = {
        type: 'ASSIGN_ROLES',
        payload: { assignments: { 0: 'villager' } },
      };

      const newState = gameReducer(state, action);

      expect(newState.players[0]?.hasViewedRole).toBe(false);
    });

    it('should set hasViewedRole to false for all assigned players', () => {
      const state = createMinimalState({
        status: 'seated',
        players: {
          0: { uid: 'p1', seatNumber: 0, role: null, hasViewedRole: true },
          1: { uid: 'p2', seatNumber: 1, role: null, hasViewedRole: true },
          2: { uid: 'p3', seatNumber: 2, role: null, hasViewedRole: true },
        },
      });
      const action: AssignRolesAction = {
        type: 'ASSIGN_ROLES',
        payload: { assignments: { 0: 'villager', 1: 'wolf', 2: 'seer' } },
      };

      const newState = gameReducer(state, action);

      // All players should have hasViewedRole = false after ASSIGN_ROLES
      expect(newState.players[0]?.hasViewedRole).toBe(false);
      expect(newState.players[1]?.hasViewedRole).toBe(false);
      expect(newState.players[2]?.hasViewedRole).toBe(false);
    });

    it('should NOT touch night-related fields (PR1 contract)', () => {
      const state = createMinimalState({
        status: 'seated',
        players: {
          0: { uid: 'p1', seatNumber: 0, role: null, hasViewedRole: false },
          1: { uid: 'p2', seatNumber: 1, role: null, hasViewedRole: false },
          2: { uid: 'p3', seatNumber: 2, role: null, hasViewedRole: false },
        },
        // These should remain unchanged
        currentActionerIndex: -1,
        isAudioPlaying: false,
      });
      const action: AssignRolesAction = {
        type: 'ASSIGN_ROLES',
        payload: { assignments: { 0: 'villager', 1: 'wolf', 2: 'seer' } },
      };

      const newState = gameReducer(state, action);

      // PR1 contract: ASSIGN_ROLES should NOT initialize night fields
      expect(newState.status).toBe('assigned'); // NOT 'ongoing'
      expect(newState.currentActionerIndex).toBe(-1); // NOT 0
      expect(newState.isAudioPlaying).toBe(false);
      expect(newState.actions).toBeUndefined();
      expect(newState.currentNightResults).toBeUndefined();
    });
  });

  describe('START_NIGHT', () => {
    it('should set status to ongoing and initialize night state', () => {
      const state = createMinimalState({ status: 'assigned' });
      const action: StartNightAction = {
        type: 'START_NIGHT',
        payload: { currentActionerIndex: 0, currentStepId: 'magicianSwap' },
      };

      const newState = gameReducer(state, action);

      expect(newState.status).toBe('ongoing');
      expect(newState.currentActionerIndex).toBe(0);
      expect(newState.currentStepId).toBe('magicianSwap');
      expect(newState.actions).toEqual([]);
      expect(newState.currentNightResults).toEqual({});
    });

    it('should set currentStepId from payload (table-driven single source)', () => {
      const state = createMinimalState({ status: 'ready' });
      const action: StartNightAction = {
        type: 'START_NIGHT',
        payload: { currentActionerIndex: 0, currentStepId: 'wolfKill' },
      };

      const newState = gameReducer(state, action);

      expect(newState.currentStepId).toBe('wolfKill');
    });
  });

  describe('ADVANCE_TO_NEXT_ACTION', () => {
    it('should update currentActionerIndex, currentStepId and clear context but preserve reveal states', () => {
      const state = createMinimalState({
        status: 'ongoing',
        currentActionerIndex: 0,
        currentStepId: 'wolfKill',
        seerReveal: { targetSeat: 1, result: '好人' },
        psychicReveal: { targetSeat: 2, result: '狼人阵营' },
        gargoyleReveal: { targetSeat: 3, result: '守卫' },
        wolfRobotReveal: { targetSeat: 4, result: '预言家', learnedRoleId: 'seer' },
        confirmStatus: { role: 'hunter', canShoot: true },
        witchContext: { killedIndex: 1, canSave: true, canPoison: true },
      });
      const action: AdvanceToNextActionAction = {
        type: 'ADVANCE_TO_NEXT_ACTION',
        payload: { nextActionerIndex: 1, nextStepId: 'seerCheck' },
      };

      const newState = gameReducer(state, action);

      // PR6 contract: 同时更新 index 和 stepId
      expect(newState.currentActionerIndex).toBe(1);
      expect(newState.currentStepId).toBe('seerCheck');
      // P0-FIX: reveal 状态保留到夜晚结束，给 UI 足够时间显示弹窗
      expect(newState.seerReveal).toEqual({ targetSeat: 1, result: '好人' });
      expect(newState.psychicReveal).toEqual({ targetSeat: 2, result: '狼人阵营' });
      expect(newState.gargoyleReveal).toEqual({ targetSeat: 3, result: '守卫' });
      expect(newState.wolfRobotReveal).toEqual({ targetSeat: 4, result: '预言家', learnedRoleId: 'seer' });
      // context 仍然被清空（这些是步骤特定的，不是结果）
      expect(newState.confirmStatus).toBeUndefined();
      expect(newState.witchContext).toBeUndefined();
    });

  it('should preserve currentNightResults on advance for death calculation at END_NIGHT', () => {
      const state = createMinimalState({
        status: 'ongoing',
        currentActionerIndex: 0,
        currentStepId: 'wolfKill',
    currentNightResults: { wolfVotesBySeat: { '1': 3, '2': 3 } },
      });
      const action: AdvanceToNextActionAction = {
        type: 'ADVANCE_TO_NEXT_ACTION',
        payload: { nextActionerIndex: 1, nextStepId: 'witchAction' },
      };

      const newState = gameReducer(state, action);

  expect(newState.currentNightResults).toEqual({ wolfVotesBySeat: { '1': 3, '2': 3 } });
    });

    it('should set currentStepId to undefined when nextStepId is null (night end)', () => {
      const state = createMinimalState({
        status: 'ongoing',
        currentActionerIndex: 5,
        currentStepId: 'hunterConfirm',
      });
      const action: AdvanceToNextActionAction = {
        type: 'ADVANCE_TO_NEXT_ACTION',
        payload: { nextActionerIndex: -1, nextStepId: null },
      };

      const newState = gameReducer(state, action);

      // PR6 contract: nextStepId=null 表示夜晚结束，stepId 清空
      expect(newState.currentActionerIndex).toBe(-1);
      expect(newState.currentStepId).toBeUndefined();
    });
  });

  describe('END_NIGHT', () => {
    it('should set status to ended and record deaths', () => {
      const state = createMinimalState({
        status: 'ongoing',
        currentStepId: 'hunterConfirm',
        isAudioPlaying: true,
      });
      const action: EndNightAction = {
        type: 'END_NIGHT',
        payload: { deaths: [1, 2] },
      };

      const newState = gameReducer(state, action);

      expect(newState.status).toBe('ended');
      expect(newState.lastNightDeaths).toEqual([1, 2]);
      expect(newState.currentActionerIndex).toBe(-1);
      // PR6 contract: 清空 stepId 和 isAudioPlaying
      expect(newState.currentStepId).toBeUndefined();
      expect(newState.isAudioPlaying).toBe(false);
    });

    it('should clear currentStepId and isAudioPlaying (PR6 contract)', () => {
      const state = createMinimalState({
        status: 'ongoing',
        currentStepId: 'witchAction',
        isAudioPlaying: true,
        currentActionerIndex: 3,
      });
      const action: EndNightAction = {
        type: 'END_NIGHT',
        payload: { deaths: [] },
      };

      const newState = gameReducer(state, action);

      // PR6 contract: 夜晚结束必须清 stepId 和 isAudioPlaying
      expect(newState.currentStepId).toBeUndefined();
      expect(newState.isAudioPlaying).toBe(false);
      expect(newState.currentActionerIndex).toBe(-1);
      expect(newState.status).toBe('ended');
    });
  });

  describe('RECORD_ACTION', () => {
    it('should append action to actions array', () => {
      const state = createMinimalState({
        status: 'ongoing',
        actions: [],
      });
      const action: RecordActionAction = {
        type: 'RECORD_ACTION',
        payload: {
          action: {
            schemaId: 'seerCheck',
            actorSeat: 0,
            targetSeat: 1,
            timestamp: 1000,
          },
        },
      };

      const newState = gameReducer(state, action);

      expect(newState.actions).toHaveLength(1);
      expect(newState.actions?.[0].schemaId).toBe('seerCheck');
    });

    it('should create actions array if undefined', () => {
      const state = createMinimalState({ status: 'ongoing' });
      const action: RecordActionAction = {
        type: 'RECORD_ACTION',
        payload: {
          action: {
            schemaId: 'wolfKill',
            actorSeat: 1,
            targetSeat: 0,
            timestamp: 1000,
          },
        },
      };

      const newState = gameReducer(state, action);

      expect(newState.actions).toHaveLength(1);
    });
  });

  describe('APPLY_RESOLVER_RESULT', () => {
    it('should merge updates into currentNightResults', () => {
      const state = createMinimalState({
        status: 'ongoing',
        currentNightResults: { guardedSeat: 0 },
      });
      const action: ApplyResolverResultAction = {
        type: 'APPLY_RESOLVER_RESULT',
        payload: {
          updates: { guardedSeat: 1 },
        },
      };

      const newState = gameReducer(state, action);

      expect(newState.currentNightResults).toEqual({
  guardedSeat: 1,
      });
    });

    it('should set seerReveal', () => {
      const state = createMinimalState({ status: 'ongoing' });
      const action: ApplyResolverResultAction = {
        type: 'APPLY_RESOLVER_RESULT',
        payload: {
          seerReveal: { targetSeat: 1, result: '狼人' },
        },
      };

      const newState = gameReducer(state, action);

      expect(newState.seerReveal).toEqual({ targetSeat: 1, result: '狼人' });
    });
  });

  describe('APPLY_RESOLVER_RESULT (wolfVotesBySeat)', () => {
    it('should merge wolfVotesBySeat into currentNightResults', () => {
      const state = createMinimalState({
        status: 'ongoing',
        currentNightResults: {},
      });

      const action: ApplyResolverResultAction = {
        type: 'APPLY_RESOLVER_RESULT',
        payload: {
          updates: {
            wolfVotesBySeat: { '1': 0 },
          },
        },
      };

      const newState = gameReducer(state, action);
      expect(newState.currentNightResults).toEqual({ wolfVotesBySeat: { '1': 0 } });
    });
  });

  describe('PLAYER_VIEWED_ROLE', () => {
    it('should set hasViewedRole to true for single player', () => {
      const state = createMinimalState({
        status: 'assigned',
        players: {
          0: { uid: 'p1', seatNumber: 0, role: 'villager', hasViewedRole: false },
          1: { uid: 'p2', seatNumber: 1, role: 'wolf', hasViewedRole: false },
          2: { uid: 'p3', seatNumber: 2, role: 'seer', hasViewedRole: false },
        },
      });
      const action: PlayerViewedRoleAction = {
        type: 'PLAYER_VIEWED_ROLE',
        payload: { seat: 0 },
      };

      const newState = gameReducer(state, action);

      expect(newState.players[0]?.hasViewedRole).toBe(true);
      // status 仍为 assigned（因为还有玩家没 viewed）
      expect(newState.status).toBe('assigned');
    });

    it('should transition to ready when all players have viewed', () => {
      const state = createMinimalState({
        status: 'assigned',
        players: {
          0: { uid: 'p1', seatNumber: 0, role: 'villager', hasViewedRole: true },
          1: { uid: 'p2', seatNumber: 1, role: 'wolf', hasViewedRole: true },
          2: { uid: 'p3', seatNumber: 2, role: 'seer', hasViewedRole: false }, // 最后一个
        },
      });
      const action: PlayerViewedRoleAction = {
        type: 'PLAYER_VIEWED_ROLE',
        payload: { seat: 2 }, // 标记最后一个玩家
      };

      const newState = gameReducer(state, action);

      expect(newState.players[2]?.hasViewedRole).toBe(true);
      // 所有玩家都 viewed → status 变为 ready
      expect(newState.status).toBe('ready');
    });

    it('should handle null seats correctly when checking all viewed', () => {
      // 场景：只有 2 个玩家，第 3 个座位是空的
      const state = createMinimalState({
        status: 'assigned',
        players: {
          0: { uid: 'p1', seatNumber: 0, role: 'villager', hasViewedRole: true },
          1: { uid: 'p2', seatNumber: 1, role: 'wolf', hasViewedRole: false },
          2: null, // 空座位应被忽略
        },
      });
      const action: PlayerViewedRoleAction = {
        type: 'PLAYER_VIEWED_ROLE',
        payload: { seat: 1 },
      };

      const newState = gameReducer(state, action);

      expect(newState.players[1]?.hasViewedRole).toBe(true);
      // 所有非 null 玩家都 viewed → status 变为 ready
      expect(newState.status).toBe('ready');
    });

    it('should return unchanged state if player not found', () => {
      const state = createMinimalState({
        status: 'assigned',
        players: { 0: null, 1: null, 2: null },
      });
      const action: PlayerViewedRoleAction = {
        type: 'PLAYER_VIEWED_ROLE',
        payload: { seat: 0 },
      };

      const newState = gameReducer(state, action);

      expect(newState).toBe(state);
    });

    it('should NOT transition if status is not assigned', () => {
      const state = createMinimalState({
        status: 'ongoing', // 不是 assigned
        players: {
          0: { uid: 'p1', seatNumber: 0, role: 'villager', hasViewedRole: true },
          1: { uid: 'p2', seatNumber: 1, role: 'wolf', hasViewedRole: false },
          2: null,
        },
      });
      const action: PlayerViewedRoleAction = {
        type: 'PLAYER_VIEWED_ROLE',
        payload: { seat: 1 },
      };

      const newState = gameReducer(state, action);

      expect(newState.players[1]?.hasViewedRole).toBe(true);
      // status 不变，因为原始 status 不是 assigned
      expect(newState.status).toBe('ongoing');
    });

    it('PR2 contract: should NOT touch night fields', () => {
      const state = createMinimalState({
        status: 'assigned',
        players: {
          0: { uid: 'p1', seatNumber: 0, role: 'villager', hasViewedRole: true },
          1: { uid: 'p2', seatNumber: 1, role: 'wolf', hasViewedRole: false },
          2: null,
        },
        // 确保这些字段在 assigned 状态下是 undefined
        actions: undefined,
        currentNightResults: undefined,
        currentActionerIndex: -1,
      });
      const action: PlayerViewedRoleAction = {
        type: 'PLAYER_VIEWED_ROLE',
        payload: { seat: 1 },
      };

      const newState = gameReducer(state, action);

      // PR2 contract: 不触碰 night 字段
      expect(newState.actions).toBeUndefined();
      expect(newState.currentNightResults).toBeUndefined();
      expect(newState.currentActionerIndex).toBe(-1);
      expect(newState.witchContext).toBeUndefined();
      expect(newState.seerReveal).toBeUndefined();
    });
  });

  describe('RESTART_GAME', () => {
    /**
     * PR9: 对齐 v1 行为
     * - 状态重置到 'seated'（不是 'unseated'）
     * - 保留玩家但清除角色和 hasViewedRole
     */
    it('should reset game state while keeping players (v1 alignment)', () => {
      const state = createMinimalState({
        status: 'ended',
        players: {
          0: { uid: 'p1', seatNumber: 0, role: 'villager', hasViewedRole: true },
          1: { uid: 'p2', seatNumber: 1, role: 'wolf', hasViewedRole: true },
          2: { uid: 'p3', seatNumber: 2, role: 'seer', hasViewedRole: true },
        },
        actions: [{ schemaId: 'seerCheck', actorSeat: 2, targetSeat: 1, timestamp: 1000 }],
        lastNightDeaths: [0],
      });

      const newState = gameReducer(state, { type: 'RESTART_GAME' });

      // v1 对齐：状态重置到 'seated'
      expect(newState.status).toBe('seated');
      expect(newState.roomCode).toBe('TEST');
      expect(newState.hostUid).toBe('host-1');

      // v1 对齐：保留玩家但清除角色
      expect(newState.players[0]).not.toBeNull();
      expect(newState.players[0]?.uid).toBe('p1');
      expect(newState.players[0]?.role).toBeNull();
      expect(newState.players[0]?.hasViewedRole).toBe(false);

      // 夜晚状态清除
      expect(newState.actions).toBeUndefined();
      expect(newState.lastNightDeaths).toBeUndefined();
      expect(newState.currentActionerIndex).toBe(0);
    });
  });

  describe('CLEAR_REVEAL_STATE', () => {
    it('should clear all reveal states', () => {
      const state = createMinimalState({
        seerReveal: { targetSeat: 1, result: '好人' },
        psychicReveal: { targetSeat: 1, result: 'wolf' },
        witchContext: { killedIndex: 0, canSave: true, canPoison: true },
      });

      const newState = gameReducer(state, { type: 'CLEAR_REVEAL_STATE' });

      expect(newState.seerReveal).toBeUndefined();
      expect(newState.psychicReveal).toBeUndefined();
      expect(newState.witchContext).toBeUndefined();
    });
  });

  // =============================================================================
  // ACTION_REJECTED 契约测试
  // =============================================================================

  describe('ACTION_REJECTED', () => {
    /**
     * 锁死：ACTION_REJECTED 只写入 actionRejected 字段。
     * actionRejected 必须属于 BroadcastGameState（公开广播），不引入 hostOnly 字段。
     */
    it('should write actionRejected to state (public broadcast field)', () => {
      const state = createMinimalState({ status: 'ongoing' });
      const action = {
        type: 'ACTION_REJECTED' as const,
        payload: {
          action: 'seerCheck',
          reason: '不能选择自己',
          targetUid: 'p1',
          rejectionId: 'r1',
        },
      };

      const newState = gameReducer(state, action);

      expect(newState.actionRejected).toEqual({
        action: 'seerCheck',
        reason: '不能选择自己',
        targetUid: 'p1',
        rejectionId: 'r1',
      });
    });

    it('should NOT introduce any hostOnly or private fields', () => {
      const state = createMinimalState({ status: 'ongoing' });
      const action = {
        type: 'ACTION_REJECTED' as const,
        payload: {
          action: 'seerCheck',
          reason: 'test_reason',
          targetUid: 'p1',
          rejectionId: 'r2',
        },
      };

      const newState = gameReducer(state, action);

      // 确保没有 hostOnly 或其他私有字段被引入
      expect('hostOnly' in newState).toBe(false);
      expect('_private' in newState).toBe(false);
      expect('hostOnlyState' in newState).toBe(false);
    });

    it('should overwrite previous actionRejected', () => {
      const state = createMinimalState({
        status: 'ongoing',
        actionRejected: {
          action: 'oldAction',
          reason: 'old_reason',
          targetUid: 'old-uid',
          rejectionId: 'old',
        },
      });
      const action = {
        type: 'ACTION_REJECTED' as const,
        payload: {
          action: 'newAction',
          reason: 'new_reason',
          targetUid: 'new-uid',
          rejectionId: 'r3',
        },
      };

      const newState = gameReducer(state, action);

      expect(newState.actionRejected).toEqual({
        action: 'newAction',
        reason: 'new_reason',
        targetUid: 'new-uid',
  rejectionId: 'r3',
      });
    });
  });

  describe('CLEAR_ACTION_REJECTED', () => {
    it('should clear actionRejected field', () => {
      const state = createMinimalState({
        status: 'ongoing',
        actionRejected: {
          action: 'seerCheck',
          reason: 'test',
          targetUid: 'p1',
          rejectionId: 'r4',
        },
      });

      const newState = gameReducer(state, { type: 'CLEAR_ACTION_REJECTED' });

      expect(newState.actionRejected).toBeUndefined();
    });
  });

  // ==========================================================================
  // PR7: SET_AUDIO_PLAYING Tests
  // ==========================================================================
  describe('SET_AUDIO_PLAYING', () => {
    it('should set isAudioPlaying to true', () => {
      const state = createMinimalState({
        status: 'ongoing',
        isAudioPlaying: false,
      });
      const action: SetAudioPlayingAction = {
        type: 'SET_AUDIO_PLAYING',
        payload: { isPlaying: true },
      };

      const newState = gameReducer(state, action);

      expect(newState.isAudioPlaying).toBe(true);
    });

    it('should set isAudioPlaying to false', () => {
      const state = createMinimalState({
        status: 'ongoing',
        isAudioPlaying: true,
      });
      const action: SetAudioPlayingAction = {
        type: 'SET_AUDIO_PLAYING',
        payload: { isPlaying: false },
      };

      const newState = gameReducer(state, action);

      expect(newState.isAudioPlaying).toBe(false);
    });

    it('should not change other state fields', () => {
      const state = createMinimalState({
        status: 'ongoing',
        currentActionerIndex: 2,
        currentStepId: 'seerCheck',
        isAudioPlaying: false,
      });
      const action: SetAudioPlayingAction = {
        type: 'SET_AUDIO_PLAYING',
        payload: { isPlaying: true },
      };

      const newState = gameReducer(state, action);

      expect(newState.status).toBe('ongoing');
      expect(newState.currentActionerIndex).toBe(2);
      expect(newState.currentStepId).toBe('seerCheck');
    });
  });

  // ==========================================================================
  // Contract: isAudioPlaying is fact-based gate and must NOT be derived
  // ==========================================================================
  describe('contract: only SET_AUDIO_PLAYING may change isAudioPlaying', () => {
    it('should keep isAudioPlaying unchanged for all other actions', () => {
      const baseState = createMinimalState({
        status: 'ongoing',
        isAudioPlaying: true,
        currentActionerIndex: 0,
        currentStepId: 'wolfKill',
        players: {
          0: { uid: 'p1', seatNumber: 0, role: 'villager', hasViewedRole: false },
          1: { uid: 'p2', seatNumber: 1, role: 'wolf', hasViewedRole: false },
          2: { uid: 'p3', seatNumber: 2, role: 'seer', hasViewedRole: false },
        },
        actions: [],
        currentNightResults: {},
      });

      // If anyone ever "helpfully" toggles audio gate inside other reducers
      // (e.g. START_NIGHT / ADVANCE / SET_CURRENT_STEP), this test should fail.
      const actions: StateAction[] = [
        {
          type: 'ASSIGN_ROLES',
          payload: { assignments: { 0: 'villager', 1: 'wolf', 2: 'seer' } },
        } satisfies AssignRolesAction,
        {
          type: 'START_NIGHT',
          payload: { currentActionerIndex: 0, currentStepId: 'wolfKill' },
        } satisfies StartNightAction,
        {
          type: 'ADVANCE_TO_NEXT_ACTION',
          payload: { nextActionerIndex: 1, nextStepId: 'seerCheck' },
        } satisfies AdvanceToNextActionAction,
        {
          type: 'APPLY_RESOLVER_RESULT',
          payload: { updates: { wolfVotesBySeat: { '1': 0 } } },
        } satisfies ApplyResolverResultAction,
        {
          type: 'SET_CURRENT_STEP',
          payload: { schemaId: 'seerCheck' },
        },
        {
          type: 'CLEAR_REVEAL_STATE',
        },
        {
          type: 'PLAYER_VIEWED_ROLE',
          payload: { seat: 0 },
        } satisfies PlayerViewedRoleAction,
      ];

      for (const action of actions) {
        const newState = gameReducer(baseState, action);
        expect(newState.isAudioPlaying).toBe(true);
      }
    });
  });

  // ==========================================================================
  // PR7: END_NIGHT clears isAudioPlaying contract
  // ==========================================================================
  describe('PR7 contract: END_NIGHT forces isAudioPlaying=false', () => {
    it('should set isAudioPlaying to false even if it was true', () => {
      const state = createMinimalState({
        status: 'ongoing',
        isAudioPlaying: true, // 音频还在播放（理论上不应该发生，但 reducer 要保证）
        currentStepId: 'hunterConfirm',
      });
      const action: EndNightAction = {
        type: 'END_NIGHT',
        payload: { deaths: [1] },
      };

      const newState = gameReducer(state, action);

      // PR7 contract: END_NIGHT 必须强制 isAudioPlaying=false
      expect(newState.isAudioPlaying).toBe(false);
      expect(newState.status).toBe('ended');
      expect(newState.currentStepId).toBeUndefined();
    });
  });
});
