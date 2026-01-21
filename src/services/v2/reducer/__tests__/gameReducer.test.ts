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
  RecordWolfVoteAction,
  PlayerViewedRoleAction,
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
      expect(newState.wolfVotes).toBeUndefined();
      expect(newState.currentNightResults).toBeUndefined();
    });
  });

  describe('START_NIGHT', () => {
    it('should set status to ongoing and initialize night state', () => {
      const state = createMinimalState({ status: 'assigned' });
      const action: StartNightAction = {
        type: 'START_NIGHT',
        payload: { currentActionerIndex: 0 },
      };

      const newState = gameReducer(state, action);

      expect(newState.status).toBe('ongoing');
      expect(newState.currentActionerIndex).toBe(0);
      expect(newState.actions).toEqual([]);
      expect(newState.wolfVotes).toEqual({});
      expect(newState.currentNightResults).toEqual({});
    });
  });

  describe('ADVANCE_TO_NEXT_ACTION', () => {
    it('should update currentActionerIndex and clear reveal states', () => {
      const state = createMinimalState({
        status: 'ongoing',
        currentActionerIndex: 0,
        seerReveal: { targetSeat: 1, result: '好人' },
      });
      const action: AdvanceToNextActionAction = {
        type: 'ADVANCE_TO_NEXT_ACTION',
        payload: { nextActionerIndex: 1 },
      };

      const newState = gameReducer(state, action);

      expect(newState.currentActionerIndex).toBe(1);
      expect(newState.seerReveal).toBeUndefined();
    });
  });

  describe('END_NIGHT', () => {
    it('should set status to ended and record deaths', () => {
      const state = createMinimalState({ status: 'ongoing' });
      const action: EndNightAction = {
        type: 'END_NIGHT',
        payload: { deaths: [1, 2] },
      };

      const newState = gameReducer(state, action);

      expect(newState.status).toBe('ended');
      expect(newState.lastNightDeaths).toEqual([1, 2]);
      expect(newState.currentActionerIndex).toBe(-1);
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
          updates: { wolfKillTarget: 1 },
        },
      };

      const newState = gameReducer(state, action);

      expect(newState.currentNightResults).toEqual({
        guardedSeat: 0,
        wolfKillTarget: 1,
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

  describe('RECORD_WOLF_VOTE', () => {
    it('should record vote in wolfVotes and wolfVoteStatus', () => {
      const state = createMinimalState({
        status: 'ongoing',
        wolfVotes: {},
        wolfVoteStatus: {},
      });
      const action: RecordWolfVoteAction = {
        type: 'RECORD_WOLF_VOTE',
        payload: { voterSeat: 1, targetSeat: 0 },
      };

      const newState = gameReducer(state, action);

      expect(newState.wolfVotes).toEqual({ '1': 0 });
      expect(newState.wolfVoteStatus).toEqual({ '1': true });
    });
  });

  describe('PLAYER_VIEWED_ROLE', () => {
    it('should set hasViewedRole to true', () => {
      const state = createMinimalState({
        players: {
          0: { uid: 'p1', seatNumber: 0, role: 'villager', hasViewedRole: false },
          1: null,
          2: null,
        },
      });
      const action: PlayerViewedRoleAction = {
        type: 'PLAYER_VIEWED_ROLE',
        payload: { seat: 0 },
      };

      const newState = gameReducer(state, action);

      expect(newState.players[0]?.hasViewedRole).toBe(true);
    });

    it('should return unchanged state if player not found', () => {
      const state = createMinimalState();
      const action: PlayerViewedRoleAction = {
        type: 'PLAYER_VIEWED_ROLE',
        payload: { seat: 0 },
      };

      const newState = gameReducer(state, action);

      expect(newState).toBe(state);
    });
  });

  describe('RESTART_GAME', () => {
    it('should reset game state while keeping room info', () => {
      const state = createMinimalState({
        status: 'ended',
        players: {
          0: { uid: 'p1', seatNumber: 0, role: 'villager', hasViewedRole: true },
          1: { uid: 'p2', seatNumber: 1, role: 'wolf', hasViewedRole: true },
          2: { uid: 'p3', seatNumber: 2, role: 'seer', hasViewedRole: true },
        },
        actions: [{ schemaId: 'seerCheck', actorSeat: 2, targetSeat: 1, timestamp: 1000 }],
        wolfVotes: { '1': 0 },
        lastNightDeaths: [0],
      });

      const newState = gameReducer(state, { type: 'RESTART_GAME' });

      expect(newState.status).toBe('unseated');
      expect(newState.roomCode).toBe('TEST');
      expect(newState.hostUid).toBe('host-1');
      expect(Object.values(newState.players).every((p) => p === null)).toBe(true);
      expect(newState.actions).toBeUndefined();
      expect(newState.wolfVotes).toBeUndefined();
      expect(newState.lastNightDeaths).toBeUndefined();
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
});
