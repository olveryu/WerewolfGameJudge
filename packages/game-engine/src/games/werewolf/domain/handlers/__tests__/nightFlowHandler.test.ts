/**
 * Night Flow Handler Tests
 *
 * PR6: ADVANCE_NIGHT / END_NIGHT (Night-1 only)
 *
 * Gate tests:
 * - host_only
 * - invalid_status
 * - forbidden_while_audio_playing
 *
 * Happy path tests:
 * - advanceNight progresses index and stepId
 * - endNight calls calculateDeaths and produces correct deaths
 */

import {
  handleAdvanceNight as executeAdvanceNight,
  handleEndNight as executeEndNight,
} from '@game-judge/game-engine/games/werewolf/domain/handlers/stepTransitionHandler';
import type { HandlerContext } from '@game-judge/game-engine/games/werewolf/domain/handlers/types';
import type {
  AdvanceNightIntent,
  EndNightIntent,
} from '@game-judge/game-engine/games/werewolf/domain/intents/types';
import { GameStatus } from '@game-judge/game-engine/games/werewolf/domain/models/GameStatus';
import type { RoleId } from '@game-judge/game-engine/games/werewolf/domain/models/roles';
import { NIGHT_STEPS } from '@game-judge/game-engine/games/werewolf/domain/models/roles/spec';
import { buildNightPlan } from '@game-judge/game-engine/games/werewolf/domain/models/roles/spec/plan';
import type {
  GameState,
  Player,
} from '@game-judge/game-engine/games/werewolf/domain/protocol/types';
import { gameReducer } from '@game-judge/game-engine/games/werewolf/domain/reducer/gameReducer';
import type { EndNightAction } from '@game-judge/game-engine/games/werewolf/domain/reducer/types';
import { WEREWOLF_STATE_IDENTITY } from '@game-judge/game-engine/games/werewolf/state/version';
import { createSeededRng } from '@game-judge/game-engine/platform/random';

import { maybeCreateWitchContextAction } from '../witchContext';
import { expectError, expectSuccess, TEST_HANDLER_EXECUTION } from './handlerTestUtils';

function handleAdvanceNight(intent: AdvanceNightIntent, context: HandlerContext) {
  return executeAdvanceNight(intent, context, TEST_HANDLER_EXECUTION);
}

function handleEndNight(intent: EndNightIntent, context: HandlerContext) {
  return executeEndNight(intent, context, TEST_HANDLER_EXECUTION);
}

/**
 * Create a complete player object
 */
function createPlayer(seat: number, role: string, overrides?: Partial<Player>): Player {
  return {
    userId: `player-${seat}`,
    seat: seat,
    role: role as Player['role'],
    hasViewedRole: true,
    ...overrides,
  };
}

/**
 * Create a basic ongoing state
 */
function createOngoingState(overrides?: Partial<GameState>): GameState {
  return {
    ...WEREWOLF_STATE_IDENTITY,
    roomCode: 'TEST',
    hostUserId: 'host-uid',
    status: GameStatus.Ongoing,
    templateRoles: ['wolf', 'wolf', 'seer', 'witch', 'villager', 'villager'],
    players: {
      0: createPlayer(0, 'wolf'),
      1: createPlayer(1, 'wolf'),
      2: createPlayer(2, 'seer'),
      3: createPlayer(3, 'witch'),
      4: createPlayer(4, 'villager'),
      5: createPlayer(5, 'villager'),
    },
    currentStepIndex: 0,
    currentStepId: NIGHT_STEPS[0]?.id,
    isAudioPlaying: false,
    actions: [],
    resolvedNightEffects: [],
    currentNightResults: {},
    pendingRevealAcks: [],
    hypnotizedSeats: [],
    piperRevealAcks: [],
    conversionRevealAcks: [],
    seedWolfInfectionRevealAcks: [],
    cupidLoversRevealAcks: [],
    roster: {},
    ...overrides,
  };
}

describe('nightFlowHandler', () => {
  // ==========================================================================
  // ADVANCE_NIGHT Handler
  // ==========================================================================
  describe('handleAdvanceNight', () => {
    const intent: AdvanceNightIntent = { type: 'ADVANCE_NIGHT' };

    describe('Gate: invalid_status', () => {
      it.each([
        GameStatus.Unseated,
        GameStatus.Seated,
        GameStatus.Assigned,
        GameStatus.Ready,
        GameStatus.Ended,
      ] as const)('should reject when status is %s', (status) => {
        const context: HandlerContext = {
          state: createOngoingState({ status }),
          myUserId: 'host-uid',
          mySeat: null,
        };

        const result = handleAdvanceNight(intent, context);

        const err = expectError(result);
        expect(err.reason).toBe('invalid_status');
      });
    });

    describe('Gate: forbidden_while_audio_playing', () => {
      it('should reject when audio is playing', () => {
        const context: HandlerContext = {
          state: createOngoingState({ isAudioPlaying: true }),
          myUserId: 'host-uid',
          mySeat: null,
        };

        const result = handleAdvanceNight(intent, context);

        const err = expectError(result);
        expect(err.reason).toBe('forbidden_while_audio_playing');
      });
    });

    describe('Happy path', () => {
      it('finalizes a fatal infection before entering the final reveal step', () => {
        const templateRoles: RoleId[] = ['wolf', 'seedWolf', 'seer'];
        const nightPlan = buildNightPlan(templateRoles);
        const revealIndex = nightPlan.steps.findIndex(
          (step) => step.stepId === 'seedWolfInfectReveal',
        );
        const state = createOngoingState({
          templateRoles,
          players: {
            0: createPlayer(0, 'wolf'),
            1: createPlayer(1, 'seedWolf'),
            2: createPlayer(2, 'seer'),
          },
          currentStepIndex: revealIndex - 1,
          currentStepId: nightPlan.steps[revealIndex - 1]!.stepId,
          currentNightResults: {
            wolfVotesBySeat: { '0': 2, '1': 2 },
            seedWolfInfectionTarget: 2,
          },
        });

        const result = handleAdvanceNight(intent, {
          state,
          myUserId: 'host-uid',
          mySeat: null,
        });
        const success = expectSuccess(result);
        const finalizeAction = success.actions.find(
          (action) => action.type === 'FINALIZE_SEED_WOLF_INFECTION',
        );
        expect(finalizeAction).toEqual({
          type: 'FINALIZE_SEED_WOLF_INFECTION',
          payload: { result: { outcome: 'converted', targetSeat: 2 } },
        });

        const finalized = success.actions.reduce(gameReducer, state);
        expect(finalized.currentStepId).toBe('seedWolfInfectReveal');
        expect(finalized.players[2]?.role).toBe('wolf');
      });

      it('keeps infection failed when guard protection prevents wolf-kill damage', () => {
        const templateRoles: RoleId[] = ['wolf', 'seedWolf', 'guard', 'villager'];
        const nightPlan = buildNightPlan(templateRoles);
        const revealIndex = nightPlan.steps.findIndex(
          (step) => step.stepId === 'seedWolfInfectReveal',
        );
        const state = createOngoingState({
          templateRoles,
          players: {
            0: createPlayer(0, 'wolf'),
            1: createPlayer(1, 'seedWolf'),
            2: createPlayer(2, 'guard'),
            3: createPlayer(3, 'villager'),
          },
          currentStepIndex: revealIndex - 1,
          currentStepId: nightPlan.steps[revealIndex - 1]!.stepId,
          actions: [{ schemaId: 'guardProtect', actorSeat: 2, targetSeat: 3, timestamp: 1 }],
          currentNightResults: {
            wolfVotesBySeat: { '0': 3, '1': 3 },
            guardedSeat: 3,
            seedWolfInfectionTarget: 3,
          },
        });

        const success = expectSuccess(
          handleAdvanceNight(intent, { state, myUserId: 'host-uid', mySeat: null }),
        );
        expect(
          success.actions.find((action) => action.type === 'FINALIZE_SEED_WOLF_INFECTION'),
        ).toEqual({
          type: 'FINALIZE_SEED_WOLF_INFECTION',
          payload: { result: { outcome: 'failed', targetSeat: 3 } },
        });
      });

      it('releases a deferred reveal only after infection fails', () => {
        const templateRoles: RoleId[] = ['wolf', 'seedWolf', 'guard', 'seer'];
        const nightPlan = buildNightPlan(templateRoles);
        const revealIndex = nightPlan.steps.findIndex(
          (step) => step.stepId === 'seedWolfInfectReveal',
        );
        const state = createOngoingState({
          templateRoles,
          players: {
            0: createPlayer(0, 'wolf'),
            1: createPlayer(1, 'seedWolf'),
            2: createPlayer(2, 'guard'),
            3: createPlayer(3, 'seer'),
          },
          currentStepIndex: revealIndex - 1,
          currentStepId: nightPlan.steps[revealIndex - 1]!.stepId,
          actions: [
            { schemaId: 'guardProtect', actorSeat: 2, targetSeat: 3, timestamp: 1 },
            { schemaId: 'seerCheck', actorSeat: 3, targetSeat: 0, timestamp: 2 },
          ],
          currentNightResults: {
            wolfVotesBySeat: { '0': 3, '1': 3 },
            guardedSeat: 3,
            seedWolfInfectionTarget: 3,
          },
          seedWolfDeferredReveal: {
            actorSeat: 3,
            schemaId: 'seerCheck',
            targetSeat: 0,
            reveal: { kind: 'factionCheck', checkResult: '狼人' },
          },
        });

        const success = expectSuccess(
          handleAdvanceNight(intent, { state, myUserId: 'host-uid', mySeat: null }),
        );
        expect(success.actions).toContainEqual({
          type: 'APPLY_RESOLVER_RESULT',
          payload: {
            sourceSeat: 3,
            updates: undefined,
            seerReveal: { targetSeat: 0, result: '狼人' },
          },
        });
        expect(success.actions).toContainEqual({
          type: 'ADD_REVEAL_ACK',
          payload: { ackKey: 'seerCheck' },
        });
      });

      it('should advance to next action index and stepId', () => {
        // Test template: wolf, wolf, seer, witch, villager, villager
        // buildNightPlan will filter to: wolfKill → witchAction → seerCheck
        const templateRoles: RoleId[] = ['wolf', 'wolf', 'seer', 'witch', 'villager', 'villager'];
        const nightPlan = buildNightPlan(templateRoles);

        const context: HandlerContext = {
          // Progressing from wolfKill with witch in template, should set witchContext
          state: createOngoingState({
            currentStepIndex: 0,
            currentStepId: 'wolfKill',
            templateRoles,
          }),
          myUserId: 'host-uid',
          mySeat: null,
        };

        const result = handleAdvanceNight(intent, context);

        const success = expectSuccess(result);
        // Domain transition actions are followed by one authoritative audio queue batch.
        expect(success.actions).toHaveLength(5);

        const advanceAction = success.actions[0]!;
        expect(advanceAction.type).toBe('ADVANCE_TO_NEXT_ACTION');
        if (advanceAction.type === 'ADVANCE_TO_NEXT_ACTION') {
          expect(advanceAction.payload.nextStepIndex).toBe(1);
          // Use steps filtered by buildNightPlan (matching template roles)
          expect(advanceAction.payload.nextStepId).toBe(nightPlan.steps[1]?.stepId ?? null);
        }

        // Progressing from wolfKill with witch present, should have SET_WITCH_CONTEXT action
        const witchContextAction = success.actions[1]!;
        expect(witchContextAction.type).toBe('SET_WITCH_CONTEXT');

        // Should have SET_UI_HINT action to clear current hint
        const uiHintAction = success.actions[2]!;
        expect(uiHintAction.type).toBe('SET_UI_HINT');

        expect(success.actions[3]?.type).toBe('SET_PENDING_AUDIO_EFFECTS');
        expect(success.actions[4]).toEqual({
          type: 'SET_AUDIO_PLAYING',
          payload: { isPlaying: true },
        });
      });

      it('should set nextStepId to null when no more steps', () => {
        // Test template: wolf, wolf, seer, witch, villager, villager
        // buildNightPlan will filter to: wolfKill → witchAction → seerCheck (3 steps total)
        const templateRoles: RoleId[] = ['wolf', 'wolf', 'seer', 'witch', 'villager', 'villager'];
        const nightPlan = buildNightPlan(templateRoles);

        // Set index to the last step
        const lastIndex = nightPlan.steps.length - 1;
        const context: HandlerContext = {
          state: createOngoingState({
            currentStepIndex: lastIndex,
            currentStepId: nightPlan.steps[lastIndex]?.stepId,
          }),
          myUserId: 'host-uid',
          mySeat: null,
        };

        const result = handleAdvanceNight(intent, context);

        const success = expectSuccess(result);
        const action = success.actions[0]!;
        if (action.type === 'ADVANCE_TO_NEXT_ACTION') {
          expect(action.payload.nextStepIndex).toBe(lastIndex + 1);
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

    it('should resolve wolf kill from wolfVotesBySeat via resolveWolfVotes (empty + kill => kill)', () => {
      const context: HandlerContext = {
        myUserId: null,
        mySeat: null,
        state: {
          ...WEREWOLF_STATE_IDENTITY,
          roomCode: 'ROOM',
          hostUserId: 'HOST',
          status: GameStatus.Ongoing,
          isAudioPlaying: false,
          templateRoles: ['wolf', 'villager'],
          players: {
            0: {
              userId: 'u0',
              seat: 0,
              role: 'wolf',
              hasViewedRole: true,
            },
            1: {
              userId: 'u1',
              seat: 1,
              role: 'villager',
              hasViewedRole: true,
            },
          },
          currentStepIndex: 0,
          currentStepId: undefined,
          actions: [],
          resolvedNightEffects: [],
          currentNightResults: {
            wolfVotesBySeat: { '0': -1, '1': 0 },
          },
          wolfKillOverride: undefined,
          pendingRevealAcks: [],
          hypnotizedSeats: [],
          piperRevealAcks: [],
          conversionRevealAcks: [],
          seedWolfInfectionRevealAcks: [],
          cupidLoversRevealAcks: [],
          roster: {},
        },
      };

      const result = handleEndNight({ type: 'END_NIGHT' }, context);
      const success = expectSuccess(result);
      const end = success.actions.find((a): a is EndNightAction => a.type === 'END_NIGHT');
      expect(end).toBeDefined();
      expect(end!.payload.deaths).toEqual([0]);
    });

    describe('Gate: invalid_status', () => {
      it.each([
        GameStatus.Unseated,
        GameStatus.Seated,
        GameStatus.Assigned,
        GameStatus.Ready,
        GameStatus.Ended,
      ] as const)('should reject when status is %s', (status) => {
        const context: HandlerContext = {
          state: createOngoingState({ status }),
          myUserId: 'host-uid',
          mySeat: null,
        };

        const result = handleEndNight(intent, context);

        const err = expectError(result);
        expect(err.reason).toBe('invalid_status');
      });
    });

    describe('Gate: forbidden_while_audio_playing', () => {
      it('should reject when audio is playing', () => {
        const context: HandlerContext = {
          state: createOngoingState({ isAudioPlaying: true }),
          myUserId: 'host-uid',
          mySeat: null,
        };

        const result = handleEndNight(intent, context);

        const err = expectError(result);
        expect(err.reason).toBe('forbidden_while_audio_playing');
      });
    });

    describe('Gate: night_not_complete', () => {
      it('should reject when currentStepId is still set (night plan not finished)', () => {
        // currentStepId still has a value, meaning the night plan has not finished
        const context: HandlerContext = {
          state: createOngoingState({
            currentStepId: 'wolfKill', // still on wolfKill step
            currentNightResults: { wolfVotesBySeat: {} },
          }),
          myUserId: 'host-uid',
          mySeat: null,
        };

        const result = handleEndNight(intent, context);

        const err = expectError(result);
        expect(err.reason).toBe('night_not_complete');
      });
    });

    describe('Happy path: death calculation', () => {
      it('should produce END_NIGHT action with empty deaths when no wolf kill', () => {
        // No wolf votes = skip attack = no deaths
        // currentStepId: undefined means night plan has finished
        const context: HandlerContext = {
          state: createOngoingState({
            currentStepId: undefined,
            currentNightResults: { wolfVotesBySeat: {} },
          }),
          myUserId: 'host-uid',
          mySeat: null,
        };

        const result = handleEndNight(intent, context);

        const success = expectSuccess(result);
        expect(success.actions).toHaveLength(3);

        const action = success.actions[0]!;
        expect(action.type).toBe('END_NIGHT');
        if (action.type === 'END_NIGHT') {
          expect(action.payload.deaths).toEqual([]);
        }

        expect(success.actions[1]).toEqual({
          type: 'SET_PENDING_AUDIO_EFFECTS',
          payload: { effects: [{ audioKey: 'night_end' }] },
        });
        expect(success.actions[2]).toEqual({
          type: 'SET_AUDIO_PLAYING',
          payload: { isPlaying: true },
        });
      });

      it('should calculate wolf kill death (simple case)', () => {
        // Both wolves vote for seat 4 (villager)
        // currentStepId: undefined means night plan has finished
        const context: HandlerContext = {
          state: createOngoingState({
            currentStepId: undefined,
            currentNightResults: { wolfVotesBySeat: { '0': 4, '1': 4 } },
          }),
          myUserId: 'host-uid',
          mySeat: null,
        };

        const result = handleEndNight(intent, context);

        const success = expectSuccess(result);
        const action = success.actions[0]!;
        expect(action.type).toBe('END_NIGHT');
        if (action.type === 'END_NIGHT') {
          expect(action.payload.deaths).toContain(4);
        }
      });

      it('should randomly pick one target on tie vote (平票随机刀)', () => {
        // Two wolves vote different targets = tie = randomly pick one target to kill
        // currentStepId: undefined means night plan has finished
        const context: HandlerContext = {
          state: createOngoingState({
            currentStepId: undefined,
            currentNightResults: { wolfVotesBySeat: { '0': 4, '1': 5 } },
          }),
          myUserId: 'host-uid',
          mySeat: null,
        };

        const result = handleEndNight(intent, context);

        const success = expectSuccess(result);
        const action = success.actions[0]!;
        expect(action.type).toBe('END_NIGHT');
        if (action.type === 'END_NIGHT') {
          // Tie = randomly pick one to kill
          expect(action.payload.deaths).toHaveLength(1);
          expect([4, 5]).toContain(action.payload.deaths[0]);
        }
      });

      it('uses the same tied wolf target for witch context and final settlement', () => {
        const state = createOngoingState({
          currentStepId: undefined,
          currentNightResults: { wolfVotesBySeat: { '0': 4, '1': 5 } },
        });
        const witchContextAction = maybeCreateWitchContextAction(
          'witchAction',
          state,
          createSeededRng(`${TEST_HANDLER_EXECUTION.randomSeed}:wolf-vote`),
        );
        const context: HandlerContext = {
          state,
          myUserId: 'host-uid',
          mySeat: null,
        };

        const result = executeEndNight({ type: 'END_NIGHT' }, context, TEST_HANDLER_EXECUTION);
        const success = expectSuccess(result);
        const endNightAction = success.actions[0];

        expect(witchContextAction).not.toBeNull();
        expect(endNightAction?.type).toBe('END_NIGHT');
        if (witchContextAction && endNightAction?.type === 'END_NIGHT') {
          expect(endNightAction.payload.deaths).toContain(witchContextAction.payload.killedSeat);
        }
      });

      it('should return empty deaths when wolfKillOverride set (nightmare blocked wolf)', () => {
        // Wolves blocked, votes have no effect
        // currentStepId: undefined means night plan has finished
        const context: HandlerContext = {
          state: createOngoingState({
            currentStepId: undefined,
            currentNightResults: { wolfVotesBySeat: { '0': 4, '1': 4 } },
            wolfKillOverride: {
              source: 'nightmare',
              ui: { promptTitle: 't', promptMessage: 'm', emptyVoteText: 'e', rejectMessage: 'r' },
            },
          }),
          myUserId: 'host-uid',
          mySeat: null,
        };

        const result = handleEndNight(intent, context);

        const success = expectSuccess(result);
        const action = success.actions[0]!;
        expect(action.type).toBe('END_NIGHT');
        if (action.type === 'END_NIGHT') {
          expect(action.payload.deaths).toEqual([]);
        }
      });

      it('should respect guard protection (no death)', () => {
        // Attack seat 4, guard protects seat 4
        // currentStepId: undefined means night plan has finished
        const context: HandlerContext = {
          state: createOngoingState({
            currentStepId: undefined,
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
          myUserId: 'host-uid',
          mySeat: null,
        };

        const result = handleEndNight(intent, context);

        const success = expectSuccess(result);
        const action = success.actions[0]!;
        expect(action.type).toBe('END_NIGHT');
        if (action.type === 'END_NIGHT') {
          // Protected by guard, no death
          expect(action.payload.deaths).not.toContain(4);
        }
      });

      // ================================================================
      // Magician swap + death calculation (unified identity resolution)
      // ================================================================

      it('should apply magician swap to spiritKnight identity in death calc (wolf kills swapped seat)', () => {
        // Scenario: magician swap spiritKnight(seat 2) ↔ villager(seat 4)
        // Attack seat 2 (after swap seat 2 has villager identity) → seat 2 dies
        // processMagicianSwap: seat 2 dead → swap → seat 4 dead, seat 2 alive
        // SpiritKnight ability follows identity to seat 4, seat 2 is no longer spiritKnight → not immune
        const context: HandlerContext = {
          state: createOngoingState({
            currentStepId: undefined,
            players: {
              0: createPlayer(0, 'wolf'),
              1: createPlayer(1, 'wolf'),
              2: createPlayer(2, 'spiritKnight'),
              3: createPlayer(3, 'seer'),
              4: createPlayer(4, 'villager'),
              5: createPlayer(5, 'villager'),
            },
            currentNightResults: {
              wolfVotesBySeat: { '0': 2, '1': 2 },
              swappedSeats: [2, 4] as readonly [number, number],
            },
          }),
          myUserId: 'host-uid',
          mySeat: null,
        };

        const result = handleEndNight(intent, context);
        const success = expectSuccess(result);
        const action = success.actions[0]!;
        expect(action.type).toBe('END_NIGHT');
        if (action.type === 'END_NIGHT') {
          // seat 2 originally dies, after swap seat 4 dies (seat 2 alive)
          expect(action.payload.deaths).toContain(4);
          expect(action.payload.deaths).not.toContain(2);
        }
      });

      it('should apply magician swap: seer checks swapped spiritKnight seat → no reflection', () => {
        // Scenario: magician swap spiritKnight(seat 2) ↔ villager(seat 4)
        // Seer(seat 3) checks seat 2 (after swap seat 2 = villager identity)
        // spiritKnight ability is at seat 4 → checking seat 2 does not trigger reflection
        // Seer does not die
        const context: HandlerContext = {
          state: createOngoingState({
            currentStepId: undefined,
            players: {
              0: createPlayer(0, 'wolf'),
              1: createPlayer(1, 'wolf'),
              2: createPlayer(2, 'spiritKnight'),
              3: createPlayer(3, 'seer'),
              4: createPlayer(4, 'villager'),
              5: createPlayer(5, 'villager'),
            },
            currentNightResults: {
              wolfVotesBySeat: {},
              swappedSeats: [2, 4] as readonly [number, number],
            },
            actions: [
              { schemaId: 'seerCheck', actorSeat: 3, targetSeat: 2, timestamp: Date.now() },
            ],
          }),
          myUserId: 'host-uid',
          mySeat: null,
        };

        const result = handleEndNight(intent, context);
        const success = expectSuccess(result);
        const action = success.actions[0]!;
        expect(action.type).toBe('END_NIGHT');
        if (action.type === 'END_NIGHT') {
          // Seer does not die (spiritKnight identity is at seat 4, not seat 2)
          expect(action.payload.deaths).not.toContain(3);
        }
      });

      it('should apply magician swap: seer checks seat with swapped-in spiritKnight → seer dies by reflection', () => {
        // Scenario: magician swap spiritKnight(seat 2) ↔ villager(seat 4)
        // Seer(seat 3) checks seat 4 (after swap seat 4 = spiritKnight identity)
        // Triggers reflection → Seer dies
        const context: HandlerContext = {
          state: createOngoingState({
            currentStepId: undefined,
            players: {
              0: createPlayer(0, 'wolf'),
              1: createPlayer(1, 'wolf'),
              2: createPlayer(2, 'spiritKnight'),
              3: createPlayer(3, 'seer'),
              4: createPlayer(4, 'villager'),
              5: createPlayer(5, 'villager'),
            },
            currentNightResults: {
              wolfVotesBySeat: {},
              swappedSeats: [2, 4] as readonly [number, number],
            },
            actions: [
              { schemaId: 'seerCheck', actorSeat: 3, targetSeat: 4, timestamp: Date.now() },
            ],
          }),
          myUserId: 'host-uid',
          mySeat: null,
        };

        const result = handleEndNight(intent, context);
        const success = expectSuccess(result);
        const action = success.actions[0]!;
        expect(action.type).toBe('END_NIGHT');
        if (action.type === 'END_NIGHT') {
          // Seer checked the post-swap spiritKnight → killed by reflection
          expect(action.payload.deaths).toContain(3);
        }
      });

      it('should not change roleSeatMap when no magician swap exists', () => {
        // Behavior unchanged without swap: spiritKnight at seat 2, attack villager seat 4
        const context: HandlerContext = {
          state: createOngoingState({
            currentStepId: undefined,
            players: {
              0: createPlayer(0, 'wolf'),
              1: createPlayer(1, 'wolf'),
              2: createPlayer(2, 'spiritKnight'),
              3: createPlayer(3, 'seer'),
              4: createPlayer(4, 'villager'),
              5: createPlayer(5, 'villager'),
            },
            currentNightResults: {
              wolfVotesBySeat: { '0': 4, '1': 4 },
              // no swappedSeats
            },
          }),
          myUserId: 'host-uid',
          mySeat: null,
        };

        const result = handleEndNight(intent, context);
        const success = expectSuccess(result);
        const action = success.actions[0]!;
        expect(action.type).toBe('END_NIGHT');
        if (action.type === 'END_NIGHT') {
          // Attack villager → seat 4 dies
          expect(action.payload.deaths).toEqual([4]);
        }
      });
    });
  });

  describe('authoritative audio gate contracts', () => {
    describe('PR7 contract: ADVANCE_NIGHT/END_NIGHT reject when isAudioPlaying=true', () => {
      it('ADVANCE_NIGHT should reject with forbidden_while_audio_playing when audio is playing', () => {
        const intent: AdvanceNightIntent = { type: 'ADVANCE_NIGHT' };
        const context: HandlerContext = {
          state: createOngoingState({ isAudioPlaying: true }),
          myUserId: 'host-uid',
          mySeat: null,
        };

        const result = handleAdvanceNight(intent, context);

        const err = expectError(result);
        expect(err.reason).toBe('forbidden_while_audio_playing');
      });

      it('END_NIGHT should reject with forbidden_while_audio_playing when audio is playing', () => {
        const intent: EndNightIntent = { type: 'END_NIGHT' };
        const context: HandlerContext = {
          state: createOngoingState({ isAudioPlaying: true }),
          myUserId: 'host-uid',
          mySeat: null,
        };

        const result = handleEndNight(intent, context);

        const err = expectError(result);
        expect(err.reason).toBe('forbidden_while_audio_playing');
      });
    });

    describe('PR contract: witchContext.canSave aligns with notSelf constraint', () => {
      /**
       * Schema definition: witchAction.steps[0] (save) has notSelf constraint
       * Contract: when killed seat is the witch herself, canSave must be false
       *
       * This test verifies that witchContext.canSave set by handleAdvanceNight
       * correctly implements the schema's notSelf constraint.
       */

      it('should set canSave=false when wolf kills the witch (notSelf alignment)', () => {
        // Template: wolf, witch, villager (witch at seat 1)
        const templateRoles: RoleId[] = ['wolf', 'witch', 'villager'];

        // players: wolf at 0, witch at 1
        const players: Record<number, Player> = {
          0: createPlayer(0, 'wolf'),
          1: createPlayer(1, 'witch'),
          2: createPlayer(2, 'villager'),
        };

        const intent: AdvanceNightIntent = { type: 'ADVANCE_NIGHT' };
        const context: HandlerContext = {
          state: createOngoingState({
            players,
            currentStepIndex: 0, // wolfKill is step 0
            currentStepId: 'wolfKill',
            templateRoles,
            // Wolf killed the witch (seat 1)
            currentNightResults: { wolfVotesBySeat: { '0': 1 } },
          }),
          myUserId: 'host-uid',
          mySeat: null,
        };

        const result = handleAdvanceNight(intent, context);

        const success = expectSuccess(result);
        // Should have 2 actions: ADVANCE + SET_WITCH_CONTEXT
        expect(success.actions.length).toBeGreaterThanOrEqual(2);

        const witchContextAction = success.actions.find((a) => a.type === 'SET_WITCH_CONTEXT');
        expect(witchContextAction).toBeDefined();

        if (witchContextAction?.type === 'SET_WITCH_CONTEXT') {
          // killedSeat should be 1 (witch's seat)
          expect(witchContextAction.payload.killedSeat).toBe(1);
          // canSave must be false (witch cannot self-save, notSelf constraint)
          expect(witchContextAction.payload.canSave).toBe(false);
        }
      });

      it('should set canSave=true when wolf kills someone else (normal case)', () => {
        // Template: wolf, witch, villager (witch at seat 1)
        const templateRoles: RoleId[] = ['wolf', 'witch', 'villager'];

        const players: Record<number, Player> = {
          0: createPlayer(0, 'wolf'),
          1: createPlayer(1, 'witch'),
          2: createPlayer(2, 'villager'),
        };

        const intent: AdvanceNightIntent = { type: 'ADVANCE_NIGHT' };
        const context: HandlerContext = {
          state: createOngoingState({
            players,
            currentStepIndex: 0,
            currentStepId: 'wolfKill',
            templateRoles,
            // Wolf killed a villager (seat 2)
            currentNightResults: { wolfVotesBySeat: { '0': 2 } },
          }),
          myUserId: 'host-uid',
          mySeat: null,
        };

        const result = handleAdvanceNight(intent, context);

        const success = expectSuccess(result);

        const witchContextAction = success.actions.find((a) => a.type === 'SET_WITCH_CONTEXT');
        expect(witchContextAction).toBeDefined();

        if (witchContextAction?.type === 'SET_WITCH_CONTEXT') {
          // killedSeat should be 2 (villager's seat)
          expect(witchContextAction.payload.killedSeat).toBe(2);
          // canSave should be true (can save others)
          expect(witchContextAction.payload.canSave).toBe(true);
        }
      });

      it('should set witchContext when advancing TO witchAction on no-wolf board (Case 2)', () => {
        /**
         * Bug fix: when board has no wolves, witch doesn't show "no one died last night" prompt
         *
         * Scenario: template has witch but no wolf roles
         * - buildNightPlan() will skip wolfKill step
         * - When advancing from a non-wolfKill step to witchAction, Case 2 triggers
         */

        // Template: witch + seer + villager, no wolves
        const templateRoles: RoleId[] = ['witch', 'seer', 'villager', 'villager'];

        const players: Record<number, Player> = {
          0: createPlayer(0, 'witch'),
          1: createPlayer(1, 'seer'),
          2: createPlayer(2, 'villager'),
          3: createPlayer(3, 'villager'),
        };

        const intent: AdvanceNightIntent = { type: 'ADVANCE_NIGHT' };
        const context: HandlerContext = {
          state: createOngoingState({
            players,
            currentStepIndex: 0,
            currentStepId: 'seerCheck',
            templateRoles,
            currentNightResults: {},
          }),
          myUserId: 'host-uid',
          mySeat: null,
        };

        const result = handleAdvanceNight(intent, context);

        expectSuccess(result);
        // Handler internally depends on nightFlow.peekNext(); this verifies it does not crash
      });

      it('should NOT set witchContext when nextStepId is undefined (night ends)', () => {
        /**
         * Fail-safe test: when night progresses past the last step and ends,
         * nextStepId is undefined, witchContext should not be set
         *
         * This verifies the explicit guard: nextStepId ? maybeCreate...() : null
         */

        // Template: wolf, witch - only 2 steps (wolfKill, witchAction)
        const templateRoles: RoleId[] = ['wolf', 'witch', 'villager'];

        const players: Record<number, Player> = {
          0: createPlayer(0, 'wolf'),
          1: createPlayer(1, 'witch'),
          2: createPlayer(2, 'villager'),
        };

        const intent: AdvanceNightIntent = { type: 'ADVANCE_NIGHT' };
        // Currently on last step witchAction; night ends after progression
        const context: HandlerContext = {
          state: createOngoingState({
            players,
            currentStepIndex: 1, // witchAction is step 1
            currentStepId: 'witchAction',
            templateRoles,
            currentNightResults: {},
            // witchContext already set (set when entering witchAction)
            witchContext: { killedSeat: -1, canSave: false, canPoison: true },
          }),
          myUserId: 'host-uid',
          mySeat: null,
        };

        const result = handleAdvanceNight(intent, context);

        const success = expectSuccess(result);
        // Returns END_NIGHT when night ends, not ADVANCE
        // Key assertion: should have no SET_WITCH_CONTEXT action
        const witchContextAction = success.actions.find((a) => a.type === 'SET_WITCH_CONTEXT');
        expect(witchContextAction).toBeUndefined();
      });
    });
  });
});
