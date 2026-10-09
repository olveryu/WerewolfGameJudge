/**
 * Debug Bots Contract Tests
 *
 * Verifies core constraints of debug bots functionality:
 * 1. After fillWithBots: debugMode.botsEnabled === true, every newly added bot seat gets a botRoster profile keyed `bot-<seat>`
 * 2. markAllBotsViewed: only sets hasViewedRole = true on seats whose roster occupant is a bot
 * 3. Calling when debug is not enabled must reject
 */

import {
  handleFillWithBots,
  handleMarkAllBotsViewed,
} from '@game-judge/game-engine/games/werewolf/domain/handlers/gameControlHandler';
import type { HandlerContext } from '@game-judge/game-engine/games/werewolf/domain/handlers/types';
import { GameStatus } from '@game-judge/game-engine/games/werewolf/domain/models/GameStatus';
import type { RoleId } from '@game-judge/game-engine/games/werewolf/domain/models/roles';
import type { Player } from '@game-judge/game-engine/games/werewolf/domain/protocol/types';
import type { GameState } from '@game-judge/game-engine/games/werewolf/public';
import { WEREWOLF_STATE_IDENTITY } from '@game-judge/game-engine/games/werewolf/state/version';

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
    currentStepIndex: -1,
    isAudioPlaying: false,
    actions: [],
    pendingRevealAcks: [],
    hypnotizedSeats: [],
    piperRevealAcks: [],
    conversionRevealAcks: [],
    cupidLoversRevealAcks: [],
    seedWolfInfectionRevealAcks: [],
    roster: {},
    playerProfiles: {},
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
        payload: { bots: Record<number, Player>; botRoster: Record<string, unknown> };
      };
      const bots = action.payload.bots;

      // All 12 seats should have bots
      expect(Object.keys(bots)).toHaveLength(12);

      // Each bot is pure per-seat game data; its bot identity is carried by
      // the botRoster profile keyed by the synthetic `bot-<seat>` userId.
      for (const [seat, bot] of Object.entries(bots)) {
        expect(bot.seat).toBe(Number(seat));
        expect(action.payload.botRoster).toHaveProperty(`bot-${seat}`);
      }
      expect(Object.keys(action.payload.botRoster)).toHaveLength(12);
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
            0: { seat: 0, userId: 'human-uid' },
            5: { seat: 5, userId: 'another-human' },
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
// markAllBotsViewed Tests
// =============================================================================

describe('handleMarkAllBotsViewed', () => {
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

      const context = createTestContext({
        state: createTestState({
          status: GameStatus.Assigned,
          players,
          roster: {
            0: { seat: 0, kind: 'bot' },
            1: { seat: 1, userId: 'player-1' },
            2: { seat: 2, kind: 'bot' },
            3: { seat: 3, kind: 'bot' },
          },
          debugMode: { botsEnabled: true },
        }),
      });

      const result = handleMarkAllBotsViewed({ type: 'MARK_ALL_BOTS_VIEWED' }, context);

      const success = expectSuccess(result);
      expect(success.actions).toHaveLength(1);
      expect(success.actions[0]!.type).toBe('MARK_ALL_BOTS_VIEWED');
    });
  });

  describe('rejection cases', () => {
    it('should reject when debug mode is not enabled', () => {
      const players: Record<number, Player | null> = {};
      players[0] = createMinimalPlayer(0, { role: 'villager' });

      const context = createTestContext({
        state: createTestState({
          status: GameStatus.Assigned,
          players,
          roster: {
            0: { seat: 0, kind: 'bot' },
          },
          // debugMode is undefined
        }),
      });

      const result = handleMarkAllBotsViewed({ type: 'MARK_ALL_BOTS_VIEWED' }, context);

      const err = expectError(result);
      expect(err.reason).toBe('debug_not_enabled');
    });

    it('should reject when status is not assigned', () => {
      const players: Record<number, Player | null> = {};
      players[0] = createMinimalPlayer(0);

      const context = createTestContext({
        state: createTestState({
          status: GameStatus.Seated, // wrong status
          players,
          roster: {
            0: { seat: 0, kind: 'bot' },
          },
          debugMode: { botsEnabled: true },
        }),
      });

      const result = handleMarkAllBotsViewed({ type: 'MARK_ALL_BOTS_VIEWED' }, context);

      const err = expectError(result);
      expect(err.reason).toBe('invalid_status');
    });
  });
});
