/** Characterization tests for Werewolf command handlers extracted from GameRoom. */

import {
  expectError,
  expectSuccess,
} from '@game-judge/game-engine/games/werewolf/domain/handlers/__tests__/handlerTestUtils';
import type { HandlerContext } from '@game-judge/game-engine/games/werewolf/domain/handlers/types';
import { GameStatus } from '@game-judge/game-engine/games/werewolf/domain/models/GameStatus';
import type { GameState } from '@game-judge/game-engine/games/werewolf/domain/protocol/types';
import { WEREWOLF_STATE_IDENTITY } from '@game-judge/game-engine/games/werewolf/state/version';

import {
  handleApplyRosterLevels,
  handleAudioAck,
  handleGroupConfirmAck,
  handleMarkBotsGroupConfirmed,
  handleProgressionRequest,
  handleRevealAck,
} from '../commandHandlers';

const HOST_USER_ID = 'host-user';
const PLAYER_USER_ID = 'player-user';
const PLAYER_SEAT = 1;
const ACKED_BOT_SEAT = 4;

function createState(overrides: Partial<GameState> = {}): GameState {
  return {
    ...WEREWOLF_STATE_IDENTITY,
    roomCode: 'TEST',
    hostUserId: HOST_USER_ID,
    status: GameStatus.Ongoing,
    templateRoles: ['wolf', 'villager'],
    players: {
      0: {
        userId: HOST_USER_ID,
        seat: 0,
        role: 'wolf',
        hasViewedRole: true,
      },
      [PLAYER_SEAT]: {
        userId: PLAYER_USER_ID,
        seat: PLAYER_SEAT,
        role: 'villager',
        hasViewedRole: true,
      },
    },
    roster: {},
    currentStepIndex: 0,
    isAudioPlaying: false,
    actions: [],
    pendingRevealAcks: [],
    hypnotizedSeats: [],
    piperRevealAcks: [],
    conversionRevealAcks: [],
    cupidLoversRevealAcks: [],
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

const GROUP_CONFIRM_CASES = [
  {
    stepId: 'piperHypnotizedReveal',
    actionType: 'ADD_PIPER_REVEAL_ACK',
    ackedState: {
      currentStepId: 'piperHypnotizedReveal',
      piperRevealAcks: [PLAYER_SEAT],
    },
    botState: {
      currentStepId: 'piperHypnotizedReveal',
      piperRevealAcks: [ACKED_BOT_SEAT],
    },
  },
  {
    stepId: 'awakenedGargoyleConvertReveal',
    actionType: 'ADD_CONVERSION_REVEAL_ACK',
    ackedState: {
      currentStepId: 'awakenedGargoyleConvertReveal',
      conversionRevealAcks: [PLAYER_SEAT],
    },
    botState: {
      currentStepId: 'awakenedGargoyleConvertReveal',
      conversionRevealAcks: [ACKED_BOT_SEAT],
    },
  },
  {
    stepId: 'cupidLoversReveal',
    actionType: 'ADD_CUPID_LOVERS_REVEAL_ACK',
    ackedState: {
      currentStepId: 'cupidLoversReveal',
      cupidLoversRevealAcks: [PLAYER_SEAT],
    },
    botState: {
      currentStepId: 'cupidLoversReveal',
      cupidLoversRevealAcks: [ACKED_BOT_SEAT],
    },
  },
] as const;

describe('Werewolf command handlers', () => {
  describe('handleAudioAck', () => {
    const noOpCases: ReadonlyArray<{
      name: string;
      pendingAudioEffects: GameState['pendingAudioEffects'];
    }> = [
      { name: 'an absent queue', pendingAudioEffects: undefined },
      { name: 'an empty queue', pendingAudioEffects: [] },
    ];

    it.each(noOpCases)('is an idempotent no-op with $name', ({ pendingAudioEffects }) => {
      const result = handleAudioAck(createContext(createState({ pendingAudioEffects })));

      expect(expectSuccess(result).actions).toEqual([]);
    });

    it.each([
      {
        name: 'audio is marked as playing',
        state: { isAudioPlaying: true },
      },
      {
        name: 'the pending queue is non-empty',
        state: { pendingAudioEffects: [{ audioKey: 'night' }] },
      },
    ])('clears audio state when $name', ({ state }) => {
      const result = handleAudioAck(createContext(createState(state)));

      expect(expectSuccess(result).actions).toEqual([
        { type: 'CLEAR_PENDING_AUDIO_EFFECTS' },
        { type: 'SET_AUDIO_PLAYING', payload: { isPlaying: false } },
      ]);
    });
  });

  describe('handleProgressionRequest', () => {
    it('rejects when the game is not ongoing', () => {
      const result = handleProgressionRequest(
        createContext(createState({ status: GameStatus.Ended })),
      );

      expect(expectError(result).reason).toBe('not_ongoing');
    });

    it('accepts an ongoing game without emitting an action', () => {
      const result = handleProgressionRequest(createContext(createState()));

      expect(expectSuccess(result).actions).toEqual([]);
    });
  });

  describe('handleRevealAck', () => {
    it('rejects when no reveal acknowledgements are pending', () => {
      const result = handleRevealAck(createContext(createState()));

      expect(expectError(result).reason).toBe('no_pending_acks');
    });

    it('clears pending acknowledgements', () => {
      const result = handleRevealAck(
        createContext(createState({ pendingRevealAcks: [PLAYER_USER_ID] })),
      );
      const success = expectSuccess(result);

      expect(success.actions).toEqual([{ type: 'CLEAR_REVEAL_ACKS' }]);
    });
  });

  describe('handleGroupConfirmAck', () => {
    it('rejects before checking the current step when the game is not ongoing', () => {
      const result = handleGroupConfirmAck(
        PLAYER_SEAT,
        createContext(createState({ status: GameStatus.Ended })),
      );

      expect(expectError(result).reason).toBe('not_ongoing');
    });

    it('rejects when there is no current step', () => {
      const result = handleGroupConfirmAck(PLAYER_SEAT, createContext(createState()));

      expect(expectError(result).reason).toBe('no_current_step');
    });

    it('rejects when the current step is not a group-confirm step', () => {
      const result = handleGroupConfirmAck(
        PLAYER_SEAT,
        createContext(createState({ currentStepId: 'seerCheck' })),
      );

      expect(expectError(result).reason).toBe('not_group_confirm_step');
    });

    it('rejects when the requested seat is empty', () => {
      const result = handleGroupConfirmAck(
        9,
        createContext(createState({ currentStepId: 'piperHypnotizedReveal' })),
      );

      expect(expectError(result).reason).toBe('no_player_at_seat');
    });

    it.each([null, 'unrelated-user'])(
      'rejects actor %p when they do not own the seat',
      (myUserId) => {
        const result = handleGroupConfirmAck(
          PLAYER_SEAT,
          createContext(createState({ currentStepId: 'piperHypnotizedReveal' }), {
            myUserId,
            mySeat: null,
          }),
        );

        expect(expectError(result).reason).toBe('userId_mismatch');
      },
    );

    it('allows the host to acknowledge another player seat', () => {
      const result = handleGroupConfirmAck(
        PLAYER_SEAT,
        createContext(createState({ currentStepId: 'piperHypnotizedReveal' }), {
          myUserId: HOST_USER_ID,
          mySeat: 0,
        }),
      );

      expect(expectSuccess(result).actions).toEqual([
        { type: 'ADD_PIPER_REVEAL_ACK', payload: { seat: PLAYER_SEAT } },
      ]);
    });

    it.each(GROUP_CONFIRM_CASES)(
      'emits $actionType for $stepId when the player owns the seat',
      ({ actionType, stepId }) => {
        const result = handleGroupConfirmAck(
          PLAYER_SEAT,
          createContext(createState({ currentStepId: stepId })),
        );

        expect(expectSuccess(result).actions).toEqual([
          { type: actionType, payload: { seat: PLAYER_SEAT } },
        ]);
      },
    );

    it.each(GROUP_CONFIRM_CASES)(
      'is an idempotent no-op for an existing $actionType acknowledgement',
      ({ ackedState }) => {
        const result = handleGroupConfirmAck(PLAYER_SEAT, createContext(createState(ackedState)));

        expect(expectSuccess(result).actions).toEqual([]);
      },
    );
  });

  describe('handleMarkBotsGroupConfirmed', () => {
    it.each([undefined, { botsEnabled: false }] as const)(
      'rejects when debug bot mode is %p',
      (debugMode) => {
        const result = handleMarkBotsGroupConfirmed(createContext(createState({ debugMode })));

        expect(expectError(result).reason).toBe('debug_not_enabled');
      },
    );

    it('rejects before checking the current step when the game is not ongoing', () => {
      const result = handleMarkBotsGroupConfirmed(
        createContext(createState({ debugMode: { botsEnabled: true }, status: GameStatus.Ended })),
      );

      expect(expectError(result).reason).toBe('not_ongoing');
    });

    it('rejects when there is no current step', () => {
      const result = handleMarkBotsGroupConfirmed(
        createContext(createState({ debugMode: { botsEnabled: true } })),
      );

      expect(expectError(result).reason).toBe('no_current_step');
    });

    it('rejects when the current step is not a group-confirm step', () => {
      const result = handleMarkBotsGroupConfirmed(
        createContext(
          createState({
            currentStepId: 'seerCheck',
            debugMode: { botsEnabled: true },
          }),
        ),
      );

      expect(expectError(result).reason).toBe('not_group_confirm_step');
    });

    it.each(GROUP_CONFIRM_CASES)(
      'batches unacknowledged bot seats as $actionType for $stepId',
      ({ actionType, botState }) => {
        const result = handleMarkBotsGroupConfirmed(
          createContext(
            createState({
              ...botState,
              debugMode: { botsEnabled: true },
              players: {
                3: {
                  userId: 'bot-a',
                  seat: 8,
                  role: 'wolf',
                  hasViewedRole: true,
                  isBot: true,
                },
                4: {
                  userId: 'bot-b',
                  seat: ACKED_BOT_SEAT,
                  role: 'villager',
                  hasViewedRole: true,
                  isBot: true,
                },
                5: {
                  userId: 'human',
                  seat: 5,
                  role: 'villager',
                  hasViewedRole: true,
                },
                6: {
                  userId: 'bot-c',
                  seat: 2,
                  role: 'villager',
                  hasViewedRole: true,
                  isBot: true,
                },
                7: null,
              },
            }),
          ),
        );

        expect(expectSuccess(result).actions).toEqual([
          { type: actionType, payload: { seat: 8 } },
          { type: actionType, payload: { seat: 2 } },
        ]);
      },
    );

    it('is an idempotent no-op when every bot seat is already acknowledged', () => {
      const result = handleMarkBotsGroupConfirmed(
        createContext(
          createState({
            currentStepId: 'piperHypnotizedReveal',
            debugMode: { botsEnabled: true },
            piperRevealAcks: [2, 4],
            players: {
              0: {
                userId: 'bot-a',
                seat: 2,
                role: 'wolf',
                hasViewedRole: true,
                isBot: true,
              },
              1: {
                userId: 'bot-b',
                seat: 4,
                role: 'villager',
                hasViewedRole: true,
                isBot: true,
              },
            },
          }),
        ),
      );

      expect(expectSuccess(result).actions).toEqual([]);
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
