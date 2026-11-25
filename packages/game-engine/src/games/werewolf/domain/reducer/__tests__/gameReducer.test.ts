/**
 * gameReducer Unit Tests
 */

import { GameStatus } from '@game-judge/game-engine/games/werewolf/domain/models/GameStatus';
import type { Player } from '@game-judge/game-engine/games/werewolf/domain/protocol/types';
import { gameReducer } from '@game-judge/game-engine/games/werewolf/domain/reducer/gameReducer';
import type {
  AssignRolesAction,
  EndNightAction,
  PlayerJoinAction,
  PlayerLeaveAction,
  PlayerViewedRoleAction,
  SetPendingAudioEffectsAction,
  StartNightAction,
  StateAction,
  UpdatePlayerProfileAction,
  UpdateTemplateAction,
} from '@game-judge/game-engine/games/werewolf/domain/reducer/types';
import type { GameState } from '@game-judge/game-engine/games/werewolf/public';

function createMinimalState(overrides?: Partial<GameState>): GameState {
  const { players: playersOverride, roster: rosterOverride, ...rest } = overrides ?? {};
  const players: GameState['players'] = playersOverride ?? { 0: null, 1: null, 2: null };
  // Occupancy mirrors the seated players; this file's convention is that
  // seat N is occupied by user `p${N + 1}` (sections using other ids pass
  // an explicit roster override).
  const derivedRoster: Record<
    number,
    { seat: number; userId: string; profile: { displayName: string } }
  > = {};
  for (const player of Object.values(players)) {
    if (player)
      derivedRoster[player.seat] = {
        seat: player.seat,
        userId: `p${player.seat + 1}`,
        profile: { displayName: `P${player.seat + 1}` },
      };
  }
  return {
    gameType: 'werewolf',
    roomCode: 'TEST',
    hostUserId: 'host-1',
    status: GameStatus.Unseated,
    templateRoles: ['villager', 'wolf', 'seer'],
    players,
    roleViewedSeats: [],
    nightState: null,
    isAudioPlaying: false,
    audioBatchId: 0,
    gameSequence: 0,
    pendingAudioEffects: [],
    roster: rosterOverride ?? derivedRoster,
    ...rest,
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
          occupant: { seat: 0, userId: 'player-1', profile: { displayName: 'Alice' } },
          player: {
            seat: 0,
            role: null,
          },
        },
      };

      const newState = gameReducer(state, action);

      expect(newState.players[0]).toEqual(action.payload.player);
      expect(newState.roster[0]).toEqual({
        seat: 0,
        userId: 'player-1',
        profile: { displayName: 'Alice' },
      });
    });

    it('should update status to seated when all seats filled', () => {
      const state = createMinimalState({
        players: {
          0: { seat: 0, role: null },
          1: { seat: 1, role: null },
          2: null,
        },
      });
      const action: PlayerJoinAction = {
        type: 'PLAYER_JOIN',
        payload: {
          seat: 2,
          occupant: { seat: 2, userId: 'p3', profile: { displayName: 'P3' } },
          player: { seat: 2, role: null },
        },
      };

      const newState = gameReducer(state, action);

      expect(newState.status).toBe(GameStatus.Seated);
    });
  });

  describe('PLAYER_LEAVE', () => {
    it('should set seat to null', () => {
      const state = createMinimalState({
        players: {
          0: { seat: 0, role: null },
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
        status: GameStatus.Seated,
        players: {
          0: { seat: 0, role: null },
          1: { seat: 1, role: null },
          2: { seat: 2, role: null },
        },
      });
      const action: PlayerLeaveAction = {
        type: 'PLAYER_LEAVE',
        payload: { seat: 0 },
      };

      const newState = gameReducer(state, action);

      expect(newState.status).toBe(GameStatus.Unseated);
    });
  });

  describe('ASSIGN_ROLES', () => {
    it('should assign roles to players', () => {
      const state = createMinimalState({
        status: GameStatus.Seated,
        players: {
          0: { seat: 0, role: null },
          1: { seat: 1, role: null },
          2: { seat: 2, role: null },
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
      expect(newState.status).toBe(GameStatus.Assigned);
    });

    it('should reset roleViewedSeats to empty', () => {
      const state = createMinimalState({
        status: GameStatus.Seated,
        players: {
          0: { seat: 0, role: null },
          1: null,
          2: null,
        },
        roleViewedSeats: [0],
      });
      const action: AssignRolesAction = {
        type: 'ASSIGN_ROLES',
        payload: { assignments: { 0: 'villager' } },
      };

      const newState = gameReducer(state, action);

      expect(newState.roleViewedSeats).toEqual([]);
    });

    it('should leave roleViewedSeats empty for all assigned players', () => {
      const state = createMinimalState({
        status: GameStatus.Seated,
        players: {
          0: { seat: 0, role: null },
          1: { seat: 1, role: null },
          2: { seat: 2, role: null },
        },
        roleViewedSeats: [0, 1, 2],
      });
      const action: AssignRolesAction = {
        type: 'ASSIGN_ROLES',
        payload: { assignments: { 0: 'villager', 1: 'wolf', 2: 'seer' } },
      };

      const newState = gameReducer(state, action);

      // ASSIGN_ROLES clears the viewed record for every player
      expect(newState.roleViewedSeats).toEqual([]);
    });
  });

  describe('START_NIGHT', () => {
    it('should set status to ongoing and initialize night state', () => {
      const state = createMinimalState({ status: GameStatus.Assigned });
      const action: StartNightAction = {
        type: 'START_NIGHT',
      };

      const newState = gameReducer(state, action);

      expect(newState.status).toBe(GameStatus.Ongoing);
    });
  });

  describe('END_NIGHT', () => {
    it('should set status to ended and record deaths', () => {
      const state = createMinimalState({
        status: GameStatus.Ongoing,
        isAudioPlaying: true,
      });
      const action: EndNightAction = {
        type: 'END_NIGHT',
        payload: { deaths: [1, 2] },
      };

      const newState = gameReducer(state, action);

      expect(newState.status).toBe(GameStatus.Ended);
      expect(newState.lastNightDeaths).toEqual([1, 2]);
      // The night's audio never outlives the night.
      expect(newState.isAudioPlaying).toBe(false);
    });
  });

  describe('PLAYER_VIEWED_ROLE', () => {
    it('should record the viewing seat in roleViewedSeats', () => {
      const state = createMinimalState({
        status: GameStatus.Assigned,
        players: {
          0: { seat: 0, role: 'villager' },
          1: { seat: 1, role: 'wolf' },
          2: { seat: 2, role: 'seer' },
        },
      });
      const action: PlayerViewedRoleAction = {
        type: 'PLAYER_VIEWED_ROLE',
        payload: { seat: 0 },
      };

      const newState = gameReducer(state, action);

      expect(newState.roleViewedSeats).toEqual([0]);
      // status remains assigned (because some players haven't viewed yet)
      expect(newState.status).toBe(GameStatus.Assigned);
    });

    it('should transition to ready when all players have viewed', () => {
      const state = createMinimalState({
        status: GameStatus.Assigned,
        players: {
          0: { seat: 0, role: 'villager' },
          1: { seat: 1, role: 'wolf' },
          2: { seat: 2, role: 'seer' }, // last one
        },
        roleViewedSeats: [0, 1],
      });
      const action: PlayerViewedRoleAction = {
        type: 'PLAYER_VIEWED_ROLE',
        payload: { seat: 2 }, // mark the last player
      };

      const newState = gameReducer(state, action);

      expect(newState.roleViewedSeats).toEqual([0, 1, 2]);
      // All players viewed -> status becomes ready
      expect(newState.status).toBe(GameStatus.Ready);
    });

    it('should handle null seats correctly when checking all viewed', () => {
      // Scenario: only 2 players, 3rd seat is empty
      const state = createMinimalState({
        status: GameStatus.Assigned,
        players: {
          0: { seat: 0, role: 'villager' },
          1: { seat: 1, role: 'wolf' },
          2: null, // empty seat should be ignored
        },
        roleViewedSeats: [0],
      });
      const action: PlayerViewedRoleAction = {
        type: 'PLAYER_VIEWED_ROLE',
        payload: { seat: 1 },
      };

      const newState = gameReducer(state, action);

      expect(newState.roleViewedSeats).toEqual([0, 1]);
      // All non-null players viewed -> status becomes ready
      expect(newState.status).toBe(GameStatus.Ready);
    });

    it('should throw if player not found (fail-fast)', () => {
      const state = createMinimalState({
        status: GameStatus.Assigned,
        players: { 0: null, 1: null, 2: null },
      });
      const action: PlayerViewedRoleAction = {
        type: 'PLAYER_VIEWED_ROLE',
        payload: { seat: 0 },
      };

      expect(() => gameReducer(state, action)).toThrow('[FAIL-FAST]');
    });

    it('should NOT transition if status is not assigned', () => {
      const state = createMinimalState({
        status: GameStatus.Ongoing, // not assigned
        players: {
          0: { seat: 0, role: 'villager' },
          1: { seat: 1, role: 'wolf' },
          2: null,
        },
        roleViewedSeats: [0],
      });
      const action: PlayerViewedRoleAction = {
        type: 'PLAYER_VIEWED_ROLE',
        payload: { seat: 1 },
      };

      const newState = gameReducer(state, action);

      expect(newState.roleViewedSeats).toEqual([0, 1]);
      // status unchanged, because original status is not assigned
      expect(newState.status).toBe(GameStatus.Ongoing);
    });
  });

  describe('RESTART_GAME', () => {
    /**
     * PR9: align with v1 behavior
     * - Status reset to GameStatus.Seated (not GameStatus.Unseated)
     * - Keep players but clear roles and hasViewedRole
     */
    it('should reset game state while keeping players (v1 alignment)', () => {
      const state = createMinimalState({
        status: GameStatus.Ended,
        players: {
          0: { seat: 0, role: 'villager' },
          1: { seat: 1, role: 'wolf' },
          2: { seat: 2, role: 'seer' },
        },
        roleViewedSeats: [0, 1, 2],
        lastNightDeaths: [0],
      });

      const newState = gameReducer(state, { type: 'RESTART_GAME', nonce: 'test-nonce' });

      // v1 alignment: status reset to GameStatus.Seated
      expect(newState.status).toBe(GameStatus.Seated);
      expect(newState.roomCode).toBe('TEST');
      expect(newState.hostUserId).toBe('host-1');

      // v1 alignment: keep players but clear roles
      expect(newState.players[0]).not.toBeNull();
      expect(newState.roster[0]).toEqual({
        seat: 0,
        userId: 'p1',
        profile: { displayName: 'P1' },
      });
      expect(newState.players[0]?.role).toBeNull();
      expect(newState.roleViewedSeats).toEqual([]);

      // Night state cleared
      expect(newState.lastNightDeaths).toBeUndefined();
    });
  });

  // =============================================================================
  // ACTION_REJECTED contract tests
  // =============================================================================

  // ==========================================================================
  // Audio queue: SET_PENDING_AUDIO_EFFECTS / CLEAR_PENDING_AUDIO_EFFECTS
  // ==========================================================================
  describe('SET_PENDING_AUDIO_EFFECTS', () => {
    it('queues the batch, marks playback running and assigns the next batch id', () => {
      const state = createMinimalState({
        status: GameStatus.Ongoing,
        isAudioPlaying: false,
        audioBatchId: 0,
        gameSequence: 0,
      });
      const action: SetPendingAudioEffectsAction = {
        type: 'SET_PENDING_AUDIO_EFFECTS',
        payload: { effects: [{ audioKey: 'wolfKill' }] },
      };

      const newState = gameReducer(state, action);

      expect(newState.pendingAudioEffects).toEqual([{ audioKey: 'wolfKill' }]);
      expect(newState.isAudioPlaying).toBe(true);
      expect(newState.audioBatchId).toBe(1);
    });

    it('replaces a pending batch and bumps the batch id monotonically', () => {
      const state = createMinimalState({
        status: GameStatus.Ongoing,
        isAudioPlaying: true,
        audioBatchId: 3,
        gameSequence: 0,
        pendingAudioEffects: [{ audioKey: 'wolfKill' }],
      });
      const action: SetPendingAudioEffectsAction = {
        type: 'SET_PENDING_AUDIO_EFFECTS',
        payload: { effects: [{ audioKey: 'seerCheck' }] },
      };

      const newState = gameReducer(state, action);

      expect(newState.pendingAudioEffects).toEqual([{ audioKey: 'seerCheck' }]);
      expect(newState.isAudioPlaying).toBe(true);
      expect(newState.audioBatchId).toBe(4);
    });

    it('should not change other state fields', () => {
      const state = createMinimalState({
        status: GameStatus.Ongoing,
        isAudioPlaying: false,
      });
      const action: SetPendingAudioEffectsAction = {
        type: 'SET_PENDING_AUDIO_EFFECTS',
        payload: { effects: [{ audioKey: 'seerCheck' }] },
      };

      const newState = gameReducer(state, action);

      expect(newState.status).toBe(GameStatus.Ongoing);
    });
  });

  describe('CLEAR_PENDING_AUDIO_EFFECTS', () => {
    it('empties the queue and stops playback while keeping the batch id', () => {
      const state = createMinimalState({
        status: GameStatus.Ongoing,
        isAudioPlaying: true,
        audioBatchId: 2,
        gameSequence: 0,
        pendingAudioEffects: [{ audioKey: 'wolfKill' }],
      });

      const newState = gameReducer(state, { type: 'CLEAR_PENDING_AUDIO_EFFECTS' });

      expect(newState.pendingAudioEffects).toEqual([]);
      expect(newState.isAudioPlaying).toBe(false);
      expect(newState.audioBatchId).toBe(2);
    });
  });

  // ==========================================================================
  // Contract: isAudioPlaying is fact-based gate and must NOT be derived
  // ==========================================================================
  describe('contract: only the audio-queue actions may change isAudioPlaying', () => {
    it('should keep isAudioPlaying unchanged for all other actions', () => {
      const baseState = createMinimalState({
        status: GameStatus.Ongoing,
        isAudioPlaying: true,
        players: {
          0: { seat: 0, role: 'villager' },
          1: { seat: 1, role: 'wolf' },
          2: { seat: 2, role: 'seer' },
        },
      });

      // If anyone ever "helpfully" toggles audio gate inside other reducers
      // (e.g. START_NIGHT), this test should fail.
      const actions: StateAction[] = [
        {
          type: 'ASSIGN_ROLES',
          payload: { assignments: { 0: 'villager', 1: 'wolf', 2: 'seer' } },
        } satisfies AssignRolesAction,
        {
          type: 'START_NIGHT',
        } satisfies StartNightAction,
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
        status: GameStatus.Ongoing,
        isAudioPlaying: true, // audio still playing (shouldn't happen in theory, but reducer must guarantee)
      });
      const action: EndNightAction = {
        type: 'END_NIGHT',
        payload: { deaths: [1] },
      };

      const newState = gameReducer(state, action);

      // PR7 contract: END_NIGHT must force isAudioPlaying=false
      expect(newState.isAudioPlaying).toBe(false);
      expect(newState.status).toBe(GameStatus.Ended);
    });
  });

  // ==========================================================================
  // RESTART_GAME: nonce regeneration contract
  // ==========================================================================
  describe('RESTART_GAME nonce regeneration', () => {
    it('should use handler-provided nonce on restart', () => {
      const state = createMinimalState({
        roomCode: 'TEST',
        status: GameStatus.Ended,
        roleRevealRandomNonce: 'oldnonce',
      });
      const action = { type: 'RESTART_GAME' as const, nonce: 'newnonce1' };

      const newState = gameReducer(state, action);

      expect(newState.roleRevealRandomNonce).toBe('newnonce1');
    });
  });

  // ===========================================================================
  // Phase 2 migration — coverage for new action types
  // ===========================================================================

  describe('SET_PENDING_AUDIO_EFFECTS', () => {
    it('should set pendingAudioEffects', () => {
      const state = createMinimalState();
      const effects = [{ audioKey: 'wolf', isEndAudio: false }];
      const action = {
        type: 'SET_PENDING_AUDIO_EFFECTS' as const,
        payload: { effects },
      };

      const newState = gameReducer(state, action);

      expect(newState.pendingAudioEffects).toEqual(effects);
    });
  });

  describe('CLEAR_PENDING_AUDIO_EFFECTS', () => {
    it('should clear pendingAudioEffects', () => {
      const state = createMinimalState({
        pendingAudioEffects: [{ audioKey: 'wolf', isEndAudio: false }],
      });
      const action = { type: 'CLEAR_PENDING_AUDIO_EFFECTS' as const };

      const newState = gameReducer(state, action);

      expect(newState.pendingAudioEffects).toEqual([]);
    });
  });

  describe('UPDATE_TEMPLATE', () => {
    it('should update templateRoles and adjust players map', () => {
      const state = createMinimalState({
        templateRoles: ['wolf', 'seer', 'villager'],
        players: {
          0: { seat: 0, role: null },
          1: { seat: 1, role: null },
          2: null,
        },
        roster: {
          0: { seat: 0, userId: 'p0', profile: { displayName: 'P0' } },
          1: { seat: 1, userId: 'p1', profile: { displayName: 'P1' } },
        },
      });
      const action: UpdateTemplateAction = {
        type: 'UPDATE_TEMPLATE',
        payload: { templateRoles: ['wolf', 'wolf', 'seer', 'villager'] },
      };

      const newState = gameReducer(state, action);

      expect(newState.templateRoles).toEqual(['wolf', 'wolf', 'seer', 'villager']);
      // Existing unassigned players are preserved
      expect(newState.players[0]).toMatchObject({ role: null });
      expect(newState.players[1]).toMatchObject({ role: null });
      expect(newState.roster[0]).toEqual({
        seat: 0,
        userId: 'p0',
        profile: { displayName: 'P0' },
      });
      expect(newState.roster[1]).toEqual({
        seat: 1,
        userId: 'p1',
        profile: { displayName: 'P1' },
      });
      // New seat = null
      expect(newState.players[3]).toBeNull();
      // Status → unseated (seat 2 and 3 are null)
      expect(newState.status).toBe(GameStatus.Unseated);
    });

    it('should set status to seated when all seats have players', () => {
      const state = createMinimalState({
        templateRoles: ['wolf', 'seer'],
        players: {
          0: { seat: 0, role: null },
          1: { seat: 1, role: null },
        },
        roster: {
          0: { seat: 0, userId: 'p0', profile: { displayName: 'P0' } },
          1: { seat: 1, userId: 'p1', profile: { displayName: 'P1' } },
        },
      });
      const action: UpdateTemplateAction = {
        type: 'UPDATE_TEMPLATE',
        payload: { templateRoles: ['wolf', 'seer'] },
      };

      const newState = gameReducer(state, action);

      expect(newState.status).toBe(GameStatus.Seated);
    });
  });

  describe('FILL_WITH_BOTS', () => {
    it('should merge bots into players', () => {
      const state = createMinimalState({
        players: {
          0: { seat: 0, role: null },
          1: null,
          2: null,
        },
        roster: {
          0: { seat: 0, userId: 'p0', profile: { displayName: 'P0' } },
        },
      });
      const bots: Record<number, Player> = {
        1: {
          seat: 1,
          role: null,
        },
        2: {
          seat: 2,
          role: null,
        },
      };
      const action = {
        type: 'FILL_WITH_BOTS' as const,
        payload: { bots },
      };

      const newState = gameReducer(state, action);

      expect(newState.players[1]).toMatchObject({ seat: 1, role: null });
      expect(newState.players[2]).toMatchObject({ seat: 2, role: null });
      // Bot identity lives in the roster marker only; bot occupants
      // carry no profile (their display name is derived at projection)
      expect(newState.roster[1]).toEqual({ seat: 1, kind: 'bot' });
      expect(newState.roster[2]).toEqual({ seat: 2, kind: 'bot' });
      // Original player untouched
      expect(newState.players[0]).toMatchObject({ seat: 0, role: null });
      expect(newState.roster[0]).toEqual({
        seat: 0,
        userId: 'p0',
        profile: { displayName: 'P0' },
      });
      expect(newState.status).toBe(GameStatus.Seated);
    });

    it('removes the bot occupant when a bot seat leaves', () => {
      const filled = gameReducer(
        createMinimalState({
          players: {
            0: { seat: 0, role: null },
            1: null,
          },
          roster: { 0: { seat: 0, userId: 'p0', profile: { displayName: 'P0' } } },
        }),
        {
          type: 'FILL_WITH_BOTS' as const,
          payload: {
            bots: { 1: { seat: 1, role: null } },
          },
        },
      );
      expect(filled.roster[1]).toEqual({ seat: 1, kind: 'bot' });

      const newState = gameReducer(filled, {
        type: 'PLAYER_LEAVE',
        payload: { seat: 1 },
      });

      expect(newState.roster[1]).toBeUndefined();
    });
  });

  // (MARK_ALL_BOTS_VIEWED is gone: the scaffold emits per-seat
  // PLAYER_VIEWED_ROLE actions via the shared platform skeleton;
  // its behavior is pinned at engine level in debugBots.contract
  // and the identityViewing protocol contract.)

  describe('SET_NIGHT_REVIEW_ALLOWED_SEATS', () => {
    it('should set nightReviewAllowedSeats', () => {
      const state = createMinimalState({ status: GameStatus.Ended });
      const action = {
        type: 'SET_NIGHT_REVIEW_ALLOWED_SEATS' as const,
        allowedSeats: [0, 2],
      };

      const newState = gameReducer(state, action);

      expect(newState.nightReviewAllowedSeats).toEqual([0, 2]);
    });

    it('should overwrite previous allowedSeats', () => {
      const state = createMinimalState({
        status: GameStatus.Ended,
        nightReviewAllowedSeats: [0, 1],
      });
      const action = {
        type: 'SET_NIGHT_REVIEW_ALLOWED_SEATS' as const,
        allowedSeats: [2],
      };

      const newState = gameReducer(state, action);

      expect(newState.nightReviewAllowedSeats).toEqual([2]);
    });

    it('should support empty array (revoke all)', () => {
      const state = createMinimalState({
        status: GameStatus.Ended,
        nightReviewAllowedSeats: [0, 1],
      });
      const action = {
        type: 'SET_NIGHT_REVIEW_ALLOWED_SEATS' as const,
        allowedSeats: [],
      };

      const newState = gameReducer(state, action);

      expect(newState.nightReviewAllowedSeats).toEqual([]);
    });
  });

  describe('RESTART_GAME clears nightReviewAllowedSeats', () => {
    it('should clear nightReviewAllowedSeats on restart', () => {
      const state = createMinimalState({
        status: GameStatus.Ended,
        nightReviewAllowedSeats: [0, 2],
        players: {
          0: { seat: 0, role: 'villager' },
          1: { seat: 1, role: 'wolf' },
          2: { seat: 2, role: 'seer' },
        },
      });
      const action = {
        type: 'RESTART_GAME' as const,
        nonce: 'test-nonce-123',
      };

      const newState = gameReducer(state, action);

      expect(newState.nightReviewAllowedSeats).toBeUndefined();
      expect(newState.status).toBe(GameStatus.Seated);
    });
  });

  describe('UPDATE_ROSTER_LEVELS', () => {
    it('should write levels into the seated human occupants profiles', () => {
      const state = createMinimalState({
        players: {
          0: { seat: 0, role: null },
          1: { seat: 1, role: null },
          2: { seat: 2, role: null },
        },
        roster: {
          0: { seat: 0, userId: 'u0', profile: { displayName: 'P1' } },
          1: { seat: 1, userId: 'u1', profile: { displayName: 'P2' } },
          2: { seat: 2, userId: 'u2', profile: { displayName: 'P3' } },
        },
      });
      const newState = gameReducer(state, {
        type: 'UPDATE_ROSTER_LEVELS',
        payload: { levels: { u0: 3, u2: 5 } },
      });

      expect(newState).not.toBe(state);
      expect(newState.roster[0]).toEqual({
        seat: 0,
        userId: 'u0',
        profile: { displayName: 'P1', level: 3 },
      });
      expect(newState.roster[1]).toBe(state.roster[1]);
      expect(newState.roster[2]).toEqual({
        seat: 2,
        userId: 'u2',
        profile: { displayName: 'P3', level: 5 },
      });
    });

    it('should return the same state when no level changes', () => {
      const state = createMinimalState({
        players: {
          0: { seat: 0, role: null },
          1: { seat: 1, role: null },
          2: { seat: 2, role: null },
        },
        roster: {
          0: { seat: 0, userId: 'u0', profile: { displayName: 'P1' } },
          1: { seat: 1, kind: 'bot' },
          2: { seat: 2, userId: 'u2', profile: { displayName: 'P3' } },
        },
      });
      const leveled = gameReducer(state, {
        type: 'UPDATE_ROSTER_LEVELS',
        payload: { levels: { u0: 3 } },
      });
      // Same value again, an unknown user, and a bot synthetic id: all no-ops.
      const again = gameReducer(leveled, {
        type: 'UPDATE_ROSTER_LEVELS',
        payload: { levels: { u0: 3, ghost: 9, 'bot-1': 2 } },
      });
      expect(again).toBe(leveled);
    });
  });

  describe('UPDATE_PLAYER_PROFILE', () => {
    it('should update displayName in the occupant profile', () => {
      const state = createMinimalState({
        players: {
          0: { seat: 0, role: null },
          1: null,
          2: null,
        },
        roster: { 0: { seat: 0, userId: 'p1', profile: { displayName: 'Old' } } },
      });
      const action: UpdatePlayerProfileAction = {
        type: 'UPDATE_PLAYER_PROFILE',
        payload: { userId: 'p1', displayName: 'NewName' },
      };

      const newState = gameReducer(state, action);

      expect(newState.roster[0]).toEqual({
        seat: 0,
        userId: 'p1',
        profile: { displayName: 'NewName' },
      });
    });

    it('should update avatarUrl in the occupant profile', () => {
      const state = createMinimalState({
        players: {
          0: { seat: 0, role: null },
          1: null,
          2: null,
        },
        roster: { 0: { seat: 0, userId: 'p1', profile: { displayName: 'P1' } } },
      });
      const action: UpdatePlayerProfileAction = {
        type: 'UPDATE_PLAYER_PROFILE',
        payload: { userId: 'p1', avatarUrl: 'https://img/new.png' },
      };

      const newState = gameReducer(state, action);

      expect(newState.roster[0]).toEqual({
        seat: 0,
        userId: 'p1',
        profile: { displayName: 'P1', avatarUrl: 'https://img/new.png' },
      });
    });

    it('should not modify other occupant profile fields', () => {
      const state = createMinimalState({
        players: {
          0: { seat: 0, role: 'villager' as const },
          1: null,
          2: null,
        },
        roster: {
          0: {
            seat: 0,
            userId: 'p1',
            profile: { displayName: 'Alice', avatarUrl: 'https://img/old.png' },
          },
        },
      });
      const action: UpdatePlayerProfileAction = {
        type: 'UPDATE_PLAYER_PROFILE',
        payload: { userId: 'p1', displayName: 'Bob' },
      };

      const newState = gameReducer(state, action);

      expect(newState.roster[0]).toEqual({
        seat: 0,
        userId: 'p1',
        profile: {
          displayName: 'Bob',
          avatarUrl: 'https://img/old.png',
        },
      });
    });

    it('should no-op when userId holds no seat', () => {
      const state = createMinimalState();
      const action: UpdatePlayerProfileAction = {
        type: 'UPDATE_PLAYER_PROFILE',
        payload: { userId: 'ghost', displayName: 'Ghost' },
      };

      const newState = gameReducer(state, action);

      expect(newState.players[0]).toBeNull();
      expect(newState).toBe(state); // referential identity — no mutation
    });
  });
});
