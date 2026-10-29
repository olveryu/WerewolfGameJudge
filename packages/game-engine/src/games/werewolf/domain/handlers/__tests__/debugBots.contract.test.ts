/**
 * Debug Bots Contract Tests
 *
 * Verifies core constraints of debug bots functionality:
 * 1. After fillBots: every newly added bot seat gets a roster bot marker (bots carry no profile)
 * 2. markAllBotsViewed: only adds seats whose roster occupant is a bot to roleViewedSeats
 * 3. Calling when debug is not enabled must reject
 */

import { GameStatus } from '@game-judge/game-engine/games/werewolf/domain/models/GameStatus';
import type { RoleId } from '@game-judge/game-engine/games/werewolf/domain/models/roles';
import type { Player } from '@game-judge/game-engine/games/werewolf/domain/protocol/types';
import type { GameState } from '@game-judge/game-engine/games/werewolf/public';
import { werewolfEngine } from '@game-judge/game-engine/games/werewolf/public';
import { WEREWOLF_STATE_IDENTITY } from '@game-judge/game-engine/games/werewolf/state/version';
import type { CommandContext } from '@game-judge/game-engine/platform/engine';

// =============================================================================
// Test Utilities
// =============================================================================

function createMinimalPlayer(seat: number, overrides?: Partial<Player>): Player {
  return {
    seat: seat,
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
    roleViewedSeats: [],
    nightStep: null,
    isAudioPlaying: false,
    audioBatchId: 0,
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

// =============================================================================
// fillWithBots Tests — the command is decided by the shared platform
// room-command skeleton in the engine (E-1), so these cases run
// against werewolfEngine.decide, not a game-local handler.
// =============================================================================

function fillDecision(state: GameState, userId = 'host-uid') {
  return werewolfEngine.decide(
    state,
    { type: 'room.seat.fillBots' },
    { ...hostCommandContext(), actor: { kind: 'user', userId } },
  );
}

describe('room.seat.fillBots (room-command skeleton)', () => {
  describe('success cases', () => {
    it('should create bot players for all empty seats', () => {
      const state = createTestState();

      const decision = fillDecision(state);
      if (decision.kind !== 'commit') throw new Error('Expected commit');

      // One seats-changed batch carries every fill; each bot is pure
      // per-seat game data and carries no profile — its identity is
      // the roster bot marker the reducer writes from the change.
      expect(decision.events).toHaveLength(1);
      const event = decision.events[0]!;
      if (event.type !== 'SEATS_CHANGED') throw new Error('Expected SEATS_CHANGED');
      expect(event.changes).toHaveLength(12);
      for (const change of event.changes) {
        expect(change.next).toEqual({ seat: change.seat, kind: 'bot' });
      }

      const next = decision.events.reduce((current, e) => werewolfEngine.evolve(current, e), state);
      for (let seat = 0; seat < 12; seat += 1) {
        expect(next.roster[seat]).toEqual({ seat, kind: 'bot' });
        expect(next.players[seat]).toEqual({ seat });
      }
      expect(next.status).toBe(GameStatus.Seated);
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

      const state = createTestState({
        players,
        roster: {
          0: { seat: 0, userId: 'human-uid', profile: { displayName: 'human-uid' } },
          5: { seat: 5, userId: 'another-human', profile: { displayName: 'another-human' } },
        },
      });

      const decision = fillDecision(state);
      if (decision.kind !== 'commit') throw new Error('Expected commit');
      const event = decision.events[0]!;
      if (event.type !== 'SEATS_CHANGED') throw new Error('Expected SEATS_CHANGED');

      // Only 10 bots created (seats 1-4, 6-11); human seats are not
      // part of the decided changes.
      expect(event.changes).toHaveLength(10);
      expect(event.changes.map((change) => change.seat)).not.toContain(0);
      expect(event.changes.map((change) => change.seat)).not.toContain(5);

      const next = decision.events.reduce((current, e) => werewolfEngine.evolve(current, e), state);
      expect(next.roster[0]).toMatchObject({ userId: 'human-uid' });
      expect(next.roster[5]).toMatchObject({ userId: 'another-human' });
      expect(next.roster[1]).toEqual({ seat: 1, kind: 'bot' });
    });
  });

  describe('rejection cases', () => {
    it('should reject when status is not unseated', () => {
      const state = createTestState({ status: GameStatus.Seated });
      expect(fillDecision(state)).toEqual({ kind: 'reject', reason: 'invalid_status' });
    });

    it('should reject when the caller is not the host', () => {
      const state = createTestState();
      expect(fillDecision(state, 'guest')).toEqual({ kind: 'reject', reason: 'not_host' });
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
      players[0] = createMinimalPlayer(0, { role: 'villager' });
      players[1] = createMinimalPlayer(1, { role: 'wolf' }); // human
      players[2] = createMinimalPlayer(2, { role: 'seer' });
      players[3] = createMinimalPlayer(3, { role: 'witch' });
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
      expect(next.roleViewedSeats).toEqual([0, 2, 3]);
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
