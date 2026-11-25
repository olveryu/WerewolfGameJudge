/** Characterization tests for Werewolf command handlers extracted from GameRoom. */

import {
  expectError,
  expectSuccess,
} from '@game-judge/game-engine/games/werewolf/domain/handlers/__tests__/handlerTestUtils';
import type { HandlerContext } from '@game-judge/game-engine/games/werewolf/domain/handlers/types';
import { GameStatus } from '@game-judge/game-engine/games/werewolf/domain/models/GameStatus';
import type { GameState } from '@game-judge/game-engine/games/werewolf/domain/protocol/types';

import { handleApplyRosterLevels, handleAudioAck } from '../commandHandlers';

const HOST_USER_ID = 'host-user';
const PLAYER_USER_ID = 'player-user';
const PLAYER_SEAT = 1;

function createState(overrides: Partial<GameState> = {}): GameState {
  return {
    gameType: 'werewolf',
    roomCode: 'TEST',
    hostUserId: HOST_USER_ID,
    status: GameStatus.Ongoing,
    templateRoles: ['wolf', 'villager'],
    players: {
      0: {
        seat: 0,
        role: 'wolf',
      },
      [PLAYER_SEAT]: {
        seat: PLAYER_SEAT,
        role: 'villager',
      },
    },
    roleViewedSeats: [],
    roster: {
      0: { seat: 0, userId: HOST_USER_ID, profile: { displayName: 'Host' } },
      [PLAYER_SEAT]: {
        seat: PLAYER_SEAT,
        userId: PLAYER_USER_ID,
        profile: { displayName: 'Player' },
      },
    },
    nightState: null,
    isAudioPlaying: false,
    audioBatchId: 0,
    gameSequence: 0,
    pendingAudioEffects: [],
    ...overrides,
  };
}

function createContext(state: GameState, overrides: Partial<HandlerContext> = {}): HandlerContext {
  return {
    state,
    myUserId: PLAYER_USER_ID,
    mySeat: PLAYER_SEAT,
    ...overrides,
  };
}

describe('Werewolf command handlers', () => {
  describe('handleAudioAck', () => {
    // A GameState with an absent queue is unrepresentable now that the
    // field is required by the current state shape.
    it('is an idempotent no-op when the current batch has an empty queue and nothing is playing', () => {
      const state = createState({ pendingAudioEffects: [] });
      const result = handleAudioAck(state.audioBatchId, createContext(state));

      expect(expectSuccess(result).actions).toEqual([]);
    });

    it.each([
      {
        name: 'audio is marked as playing',
        state: { isAudioPlaying: true, audioBatchId: 1 },
      },
      {
        name: 'the pending queue is non-empty',
        state: { pendingAudioEffects: [{ audioKey: 'night' }], audioBatchId: 1 },
      },
    ])('clears audio state when the current batch is acked and $name', ({ state }) => {
      const queued = createState(state);
      const result = handleAudioAck(queued.audioBatchId, createContext(queued));

      expect(expectSuccess(result).actions).toEqual([{ type: 'CLEAR_PENDING_AUDIO_EFFECTS' }]);
    });

    it('treats an ack for an older batch as a no-op success with no actions', () => {
      const state = createState({
        isAudioPlaying: true,
        pendingAudioEffects: [{ audioKey: 'night' }],
        audioBatchId: 2,
        gameSequence: 0,
      });

      const result = handleAudioAck(1, createContext(state));

      expect(expectSuccess(result).actions).toEqual([]);
    });

    it('rejects an ack for a batch id above the current one', () => {
      const state = createState({
        isAudioPlaying: true,
        pendingAudioEffects: [{ audioKey: 'night' }],
        audioBatchId: 1,
        gameSequence: 0,
      });

      const result = handleAudioAck(2, createContext(state));

      expect(expectError(result).reason).toBe('unknown_audio_batch');
    });
  });

  describe('handleApplyRosterLevels', () => {
    it('emits UPDATE_ROSTER_LEVELS with a mutable clone of readonly input', () => {
      const levels: Readonly<Record<string, number>> = Object.freeze({
        [HOST_USER_ID]: 3,
        [PLAYER_USER_ID]: 5,
      });
      const result = handleApplyRosterLevels(levels);
      const success = expectSuccess(result);
      const action = success.actions[0];

      expect(action).toEqual({
        type: 'UPDATE_ROSTER_LEVELS',
        payload: { levels: { [HOST_USER_ID]: 3, [PLAYER_USER_ID]: 5 } },
      });
      if (!action || action.type !== 'UPDATE_ROSTER_LEVELS') {
        throw new Error('expected UPDATE_ROSTER_LEVELS action');
      }
      expect(action.payload.levels).not.toBe(levels);

      action.payload.levels[PLAYER_USER_ID] = 6;
      expect(levels[PLAYER_USER_ID]).toBe(5);
    });

    it('still emits the roster event for an empty level map', () => {
      const result = handleApplyRosterLevels({});

      expect(expectSuccess(result).actions).toEqual([
        { type: 'UPDATE_ROSTER_LEVELS', payload: { levels: {} } },
      ]);
    });
  });
});
