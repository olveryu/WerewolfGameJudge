/**
 * Debug Bots Contract Tests
 *
 * 验证 debug bots 功能的核心约束：
 * 1. fillWithBots 后：debugMode.botsEnabled === true，新增 player 均 isBot: true
 * 2. markAllBotsViewed：只对 isBot === true 的玩家设置 hasViewedRole = true
 * 3. debug 未开启时调用必须 reject
 */

import {
  handleFillWithBots,
  handleMarkAllBotsViewed,
} from '@werewolf/game-engine/engine/handlers/gameControlHandler';
import type { HandlerContext } from '@werewolf/game-engine/engine/handlers/types';
import type { GameState } from '@werewolf/game-engine/engine/store/types';
import { GameStatus } from '@werewolf/game-engine/models/GameStatus';
import type { Player } from '@werewolf/game-engine/protocol/types';

import { expectError, expectSuccess } from './handlerTestUtils';

// =============================================================================
// Test Utilities
// =============================================================================

function createMinimalPlayer(seat: number, overrides?: Partial<Player>): Player {
  return {
    userId: `player-${seat}`,
    seatNumber: seat,
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
    roomCode: 'TEST',
    hostUserId: 'host-uid',
    status: GameStatus.Unseated,
    templateRoles: new Array<string>(totalSeats).fill('villager') as any,
    players: defaultPlayers,
    currentStepIndex: -1,
    isAudioPlaying: false,
    actions: [],
    pendingRevealAcks: [],
    roster: {},
    currentNightResults: {},
    ...overrides,
  };
}

function createTestContext(overrides?: { state?: GameState | null }): HandlerContext {
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
      expect(success.actions[0].type).toBe('FILL_WITH_BOTS');

      const action = success.actions[0] as {
        type: 'FILL_WITH_BOTS';
        payload: { bots: Record<number, Player> };
      };
      const bots = action.payload.bots;

      // All 12 seats should have bots
      expect(Object.keys(bots)).toHaveLength(12);

      // Each bot should have isBot: true
      for (const [seat, bot] of Object.entries(bots)) {
        expect(bot.isBot).toBe(true);
        expect(bot.seatNumber).toBe(Number(seat));
        expect(bot.userId).toMatch(/^bot-\d+$/);
      }
    });

    it('should not overwrite existing human players', () => {
      const players: Record<number, Player | null> = {};
      for (let i = 0; i < 12; i++) {
        players[i] = null;
      }
      // Seat 0 has a human player
      players[0] = createMinimalPlayer(0, { userId: 'human-uid' });
      // Seat 5 has a human player
      players[5] = createMinimalPlayer(5, { userId: 'another-human' });

      const context = createTestContext({
        state: createTestState({ players }),
      });

      const result = handleFillWithBots({ type: 'FILL_WITH_BOTS' }, context);

      const success = expectSuccess(result);

      const action = success.actions[0] as {
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

    it('should reject when no state', () => {
      const context = createTestContext({ state: null });
      const result = handleFillWithBots({ type: 'FILL_WITH_BOTS' }, context);

      const err = expectError(result);
      expect(err.reason).toBe('no_state');
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
      players[0] = createMinimalPlayer(0, { isBot: true, role: 'villager', hasViewedRole: false });
      players[1] = createMinimalPlayer(1, { isBot: false, role: 'wolf', hasViewedRole: false }); // human
      players[2] = createMinimalPlayer(2, { isBot: true, role: 'seer', hasViewedRole: false });
      players[3] = createMinimalPlayer(3, { isBot: true, role: 'witch', hasViewedRole: false });
      // Rest are null
      for (let i = 4; i < 12; i++) {
        players[i] = null;
      }

      const context = createTestContext({
        state: createTestState({
          status: GameStatus.Assigned,
          players,
          debugMode: { botsEnabled: true },
        }),
      });

      const result = handleMarkAllBotsViewed({ type: 'MARK_ALL_BOTS_VIEWED' }, context);

      const success = expectSuccess(result);
      expect(success.actions).toHaveLength(1);
      expect(success.actions[0].type).toBe('MARK_ALL_BOTS_VIEWED');
    });
  });

  describe('rejection cases', () => {
    it('should reject when debug mode is not enabled', () => {
      const players: Record<number, Player | null> = {};
      players[0] = createMinimalPlayer(0, { isBot: true, role: 'villager' });

      const context = createTestContext({
        state: createTestState({
          status: GameStatus.Assigned,
          players,
          // debugMode is undefined
        }),
      });

      const result = handleMarkAllBotsViewed({ type: 'MARK_ALL_BOTS_VIEWED' }, context);

      const err = expectError(result);
      expect(err.reason).toBe('debug_not_enabled');
    });

    it('should reject when status is not assigned', () => {
      const players: Record<number, Player | null> = {};
      players[0] = createMinimalPlayer(0, { isBot: true });

      const context = createTestContext({
        state: createTestState({
          status: GameStatus.Seated, // wrong status
          players,
          debugMode: { botsEnabled: true },
        }),
      });

      const result = handleMarkAllBotsViewed({ type: 'MARK_ALL_BOTS_VIEWED' }, context);

      const err = expectError(result);
      expect(err.reason).toBe('invalid_status');
    });
  });
});
