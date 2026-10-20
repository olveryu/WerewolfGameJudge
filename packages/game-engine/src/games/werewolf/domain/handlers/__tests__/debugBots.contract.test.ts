/**
 * Debug Bots Contract Tests
 *
 * Verifies core constraints of debug bots functionality:
 * 1. After fillWithBots: every newly added bot seat gets a roster bot marker (bots carry no profile)
 * 2. markAllBotsViewed: only sets hasViewedRole = true on seats whose roster occupant is a bot
 * 3. Calling when debug is not enabled must reject
 */

import { handleFillWithBots } from '@game-judge/game-engine/games/werewolf/domain/handlers/gameControlHandler';
import type { HandlerContext } from '@game-judge/game-engine/games/werewolf/domain/handlers/types';
import { GameStatus } from '@game-judge/game-engine/games/werewolf/domain/models/GameStatus';
import type { RoleId } from '@game-judge/game-engine/games/werewolf/domain/models/roles';
import type { Player } from '@game-judge/game-engine/games/werewolf/domain/protocol/types';
import type { GameState } from '@game-judge/game-engine/games/werewolf/public';
import { werewolfEngine } from '@game-judge/game-engine/games/werewolf/public';
import { WEREWOLF_STATE_IDENTITY } from '@game-judge/game-engine/games/werewolf/state/version';
import type { CommandContext } from '@game-judge/game-engine/platform/engine';

import { expectError, expectSuccess } from './handlerTestUtils';

// =============================================================================
// Test Utilities
// =============================================================================

function createMinimalPlayer(seat: number, overrides?: Partial<Player>): Player {
  return {
    seat: seat,
    hasViewedRole: false,
    role: null,
    ...overrides,
  };
}

function createTestState(overrides?: Partial<GameState>): GameState {
  const totalSeats = 12;
  const defaultPlayers: Record<number, Player | null> = {};
  for (let i = 0; i < totalSeats; i++) {
    defaultPlayers[i] = null;
  }

  return {
    ...WEREWOLF_STATE_IDENTITY,
    roomCode: 'TEST',
    hostUserId: 'host-uid',
    status: GameStatus.Unseated,
    templateRoles: new Array<RoleId>(totalSeats).fill('villager'),
    players: defaultPlayers,
    nightStep: null,
    isAudioPlaying: false,
    pendingAudioEffects: [],
    actions: [],
    pendingRevealAcks: [],
    hypnotizedSeats: [],
    piperRevealAcks: [],
    conversionRevealAcks: [],
    cupidLoversRevealAcks: [],
    seedWolfInfectionRevealAcks: [],
    roster: {},
    currentNightResults: {},
    ...overrides,
  };
}

function createTestContext(overrides?: { state?: GameState }): HandlerContext {
  return {
    state: overrides?.state === undefined ? createTestState() : overrides.state,
    myUserId: 'host-uid',
    mySeat: null,
  };
}

// =============================================================================
// fillWithBots Tests
// =============================================================================

describe('handleFillWithBots', () => {
  describe('success cases', () => {
    it('should create bot players for all empty seats', () => {
      const players: Record<number, Player | null> = {};
      for (let i = 0; i < 12; i++) {
        players[i] = null;
      }

      const context = createTestContext({
        state: createTestState({ players }),
      });

      const result = handleFillWithBots({ type: 'FILL_WITH_BOTS' }, context);

      const success = expectSuccess(result);
      expect(success.actions).toHaveLength(1);
      expect(success.actions[0]!.type).toBe('FILL_WITH_BOTS');

      const action = success.actions[0]! as {
        type: 'FILL_WITH_BOTS';
        payload: { bots: Record<number, Player> };
      };
      const bots = action.payload.bots;

      // All 12 seats should have bots
      expect(Object.keys(bots)).toHaveLength(12);

      // Each bot is pure per-seat game data; bots carry no profile — their
      // identity is the roster bot marker the reducer writes from this
      // action (covered in gameReducer.test.ts).
      for (const [seat, bot] of Object.entries(bots)) {
        expect(bot.seat).toBe(Number(seat));
      }
      expect(Object.keys(action.payload)).toEqual(['bots']);
    });

    it('should not overwrite existing human players', () => {
      const players: Record<number, Player | null> = {};
      for (let i = 0; i < 12; i++) {
        players[i] = null;
      }
      // Seat 0 has a human player
      players[0] = createMinimalPlayer(0);
      // Seat 5 has a human player
      players[5] = createMinimalPlayer(5);

      const context = createTestContext({
        state: createTestState({
          players,
          roster: {
            0: { seat: 0, userId: 'human-uid', profile: { displayName: 'human-uid' } },
            5: { seat: 5, userId: 'another-human', profile: { displayName: 'another-human' } },
          },
        }),
      });

      const result = handleFillWithBots({ type: 'FILL_WITH_BOTS' }, context);

      const success = expectSuccess(result);

      const action = success.actions[0]! as {
        type: 'FILL_WITH_BOTS';
        payload: { bots: Record<number, Player> };
      };
      const bots = action.payload.bots;

      // Only 10 bots created (seats 1-4, 6-11)
      expect(Object.keys(bots)).toHaveLength(10);

      // Human seats should NOT be in bots
      expect(bots[0]).toBeUndefined();
      expect(bots[5]).toBeUndefined();
    });
  });

  describe('rejection cases', () => {
    it('should reject when status is not unseated', () => {
      const context = createTestContext({
        state: createTestState({ status: GameStatus.Seated }),
      });
      const result = handleFillWithBots({ type: 'FILL_WITH_BOTS' }, context);

      const err = expectError(result);
      expect(err.reason).toBe('invalid_status');
    });
  });
});

// =============================================================================
// markAllBotsViewed Tests — the command is decided by the shared
// platform scaffold skeleton in the engine (F-3), so these cases run
// against werewolfEngine.decide, not a game-local handler.
// =============================================================================

function hostCommandContext(): CommandContext {
  return {
    actor: { kind: 'user', userId: 'host-uid' },
    controlledSeat: null,
    commandId: 'mark-bots',
    randomSeed: 'debug-bots',
    nowMs: 1_000,
  };
}

describe('werewolf.bots.markAllBotsViewed (shared scaffold skeleton)', () => {
  describe('success cases', () => {
    it('should only mark bot players as viewed', () => {
      const players: Record<number, Player | null> = {};
      // Create a mix of bots and humans
      players[0] = createMinimalPlayer(0, { role: 'villager', hasViewedRole: false });
      players[1] = createMinimalPlayer(1, { role: 'wolf', hasViewedRole: false }); // human
      players[2] = createMinimalPlayer(2, { role: 'seer', hasViewedRole: false });
      players[3] = createMinimalPlayer(3, { role: 'witch', hasViewedRole: false });
      // Rest are null
      for (let i = 4; i < 12; i++) {
        players[i] = null;
      }

      const state = createTestState({
        status: GameStatus.Assigned,
        players,
        roster: {
          0: { seat: 0, kind: 'bot' },
          1: { seat: 1, userId: 'player-1', profile: { displayName: 'player-1' } },
          2: { seat: 2, kind: 'bot' },
          3: { seat: 3, kind: 'bot' },
        },
      });

      const decision = werewolfEngine.decide(
        state,
        { type: 'werewolf.bots.markAllBotsViewed' },
        hostCommandContext(),
      );
      if (decision.kind !== 'commit') throw new Error('Expected commit');
      // One viewed action per unviewed bot seat; the human seat is
      // never part of the scaffold's output.
      expect(decision.events).toEqual([
        { type: 'PLAYER_VIEWED_ROLE', payload: { seat: 0 } },
        { type: 'PLAYER_VIEWED_ROLE', payload: { seat: 2 } },
        { type: 'PLAYER_VIEWED_ROLE', payload: { seat: 3 } },
      ]);
      const next = decision.events.reduce(
        (current, event) => werewolfEngine.evolve(current, event),
        state,
      );
      expect(next.players[0]?.hasViewedRole).toBe(true);
      expect(next.players[1]?.hasViewedRole).toBe(false);
      expect(next.players[2]?.hasViewedRole).toBe(true);
      expect(next.players[3]?.hasViewedRole).toBe(true);
    });
  });

  describe('rejection cases', () => {
    it('should reject when the roster holds no bot seats (AU-17)', () => {
      const players: Record<number, Player | null> = {};
      players[0] = createMinimalPlayer(0, { role: 'villager' });

      const state = createTestState({
        status: GameStatus.Assigned,
        players,
        roster: {
          0: { seat: 0, userId: 'user-0', profile: { displayName: 'user-0' } },
        },
      });

      expect(
        werewolfEngine.decide(
          state,
          { type: 'werewolf.bots.markAllBotsViewed' },
          hostCommandContext(),
        ),
      ).toEqual({ kind: 'reject', reason: 'no_bot_seats' });
    });

    it('should reject when status is not assigned', () => {
      const players: Record<number, Player | null> = {};
      players[0] = createMinimalPlayer(0);

      const state = createTestState({
        status: GameStatus.Seated, // wrong status
        players,
        roster: {
          0: { seat: 0, kind: 'bot' },
        },
      });

      expect(
        werewolfEngine.decide(
          state,
          { type: 'werewolf.bots.markAllBotsViewed' },
          hostCommandContext(),
        ),
      ).toEqual({ kind: 'reject', reason: 'invalid_status' });
    });
  });
});
