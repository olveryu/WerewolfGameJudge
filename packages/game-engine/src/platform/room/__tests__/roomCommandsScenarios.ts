/**
 * Room Commands — shared scenario suite (E-1).
 *
 * Every roster game runs these exact scenarios against its own
 * engine through a small driver, so the room-command propositions
 * cannot drift per game:
 *
 * 1. seat membership: take / move / leave with the platform roster
 *    reasons passed through untouched (seat_taken, not_seated,
 *    seat_empty), and the game's config reason for a blank display
 *    name on take and on profile update;
 * 2. actor discipline: uncontrolled users only — a controlled-seat
 *    actor is rejected with the platform takeover code;
 * 3. host discipline: fill / kick / clear / config reject a non-host
 *    with the platform not-host code, and a host acting through a
 *    bot takeover hears the takeover code, never a host code (E-8);
 * 4. config gates in order: a non-host hears not-host even for an
 *    invalid config (host gate first), an invalid config hears the
 *    game's config reason, a shrinking config that strands an
 *    occupant hears the game's occupied reason;
 * 5. gate order across phases: the profile update runs ahead of the
 *    lobby gate (it still commits after the room leaves the lobby),
 *    while seat and host commands hear the game's phase reason —
 *    a guest included, so the lobby gate provably precedes the host
 *    gate.
 *
 * Game-specific behavior (config shapes, phase machines) stays in
 * each game's own test files; the driver only maps the suite's
 * semantic intents onto the game's typed commands.
 */

import { describe, expect, it } from 'vitest';

import {
  REASON_CONTROLLED_SEAT_NOT_ALLOWED,
  REASON_NOT_HOST,
  REASON_NOT_SEATED,
  REASON_SEAT_EMPTY,
  REASON_SEAT_TAKEN,
} from '../../protocol/reasons';

/** A command actor the suite dispatches as. */
export interface RoomScenarioActor {
  readonly userId: string;
  readonly controlledSeat: number | null;
}

/** Semantic room-command intents; each game's driver builds its own typed commands. */
export type RoomScenarioIntent =
  | { readonly kind: 'take'; readonly seat: number; readonly displayName: string }
  | { readonly kind: 'leave' }
  | { readonly kind: 'updateProfile'; readonly displayName: string }
  | { readonly kind: 'fillBots' }
  | { readonly kind: 'kick'; readonly seat: number }
  | { readonly kind: 'clear' }
  | { readonly kind: 'config'; readonly variant: 'valid' | 'invalid' | 'shrinking' };

/** One live lobby session of a game, driven through its public commands only. */
export interface RoomCommandsSession {
  /** Dispatches one intent; returns the rejection reason, or null when it committed. */
  dispatch(intent: RoomScenarioIntent, actor: RoomScenarioActor): string | null;
  /** What sits at a seat right now. */
  occupantKind(seat: number): 'human' | 'bot' | 'empty';
  /** The display name of the human at a seat, or null. */
  displayName(seat: number): string | null;
  /** The room's current seat-count config. */
  seatCount(): number;
  /** Moves the room out of the lobby through the game's own flow (fill the room, then start). */
  leaveLobby(): void;
}

export interface RoomCommandsSuite {
  /** Display name for the describe block. */
  readonly game: string;
  readonly hostUserId: string;
  /** Seats in a fresh room (the game's default config). */
  readonly seatCount: number;
  /** Seat count after the suite's valid config variant applies. */
  readonly validSeatCount: number;
  /** The game's phase rejection code. */
  readonly phaseReason: string;
  /** The game's config rejection code. */
  readonly configReason: string;
  /** The game's occupied rejection code. */
  readonly occupiedReason: string;
  /** A fresh session in an empty lobby. */
  makeSession(): RoomCommandsSession;
}

export function describeRoomCommands(suite: RoomCommandsSuite): void {
  const host: RoomScenarioActor = { userId: suite.hostUserId, controlledSeat: null };
  const guest: RoomScenarioActor = { userId: 'guest', controlledSeat: null };
  const lastSeat = suite.seatCount - 1;

  describe(`Room Commands - shared scenarios (${suite.game})`, () => {
    it('seats a user who takes an empty seat, with their display name', () => {
      const session = suite.makeSession();
      expect(session.dispatch({ kind: 'take', seat: 0, displayName: 'Host' }, host)).toBeNull();
      expect(session.occupantKind(0)).toBe('human');
      expect(session.displayName(0)).toBe('Host');
    });

    it('rejects taking an occupied seat with the platform seat_taken code', () => {
      const session = suite.makeSession();
      session.dispatch({ kind: 'take', seat: 0, displayName: 'Host' }, host);
      expect(session.dispatch({ kind: 'take', seat: 0, displayName: 'Guest' }, guest)).toBe(
        REASON_SEAT_TAKEN,
      );
    });

    it('rejects a blank display name on take with the game config reason', () => {
      const session = suite.makeSession();
      expect(session.dispatch({ kind: 'take', seat: 0, displayName: '  ' }, host)).toBe(
        suite.configReason,
      );
      expect(session.occupantKind(0)).toBe('empty');
    });

    it('rejects a controlled-seat actor on take with the platform takeover code', () => {
      const session = suite.makeSession();
      expect(
        session.dispatch(
          { kind: 'take', seat: 0, displayName: 'Host' },
          { userId: suite.hostUserId, controlledSeat: 0 },
        ),
      ).toBe(REASON_CONTROLLED_SEAT_NOT_ALLOWED);
    });

    it('moves a seated user who takes another empty seat', () => {
      const session = suite.makeSession();
      session.dispatch({ kind: 'take', seat: 1, displayName: 'Guest' }, guest);
      expect(session.dispatch({ kind: 'take', seat: 2, displayName: 'Guest' }, guest)).toBeNull();
      expect(session.occupantKind(1)).toBe('empty');
      expect(session.occupantKind(2)).toBe('human');
    });

    it('frees the seat on leave, and rejects leaving while unseated', () => {
      const session = suite.makeSession();
      session.dispatch({ kind: 'take', seat: 1, displayName: 'Guest' }, guest);
      expect(session.dispatch({ kind: 'leave' }, guest)).toBeNull();
      expect(session.occupantKind(1)).toBe('empty');
      expect(session.dispatch({ kind: 'leave' }, guest)).toBe(REASON_NOT_SEATED);
    });

    it('updates the profile of a seated user, and only of a seated user', () => {
      const session = suite.makeSession();
      session.dispatch({ kind: 'take', seat: 1, displayName: 'Guest' }, guest);
      expect(session.dispatch({ kind: 'updateProfile', displayName: 'Renamed' }, guest)).toBeNull();
      expect(session.displayName(1)).toBe('Renamed');
      expect(session.dispatch({ kind: 'updateProfile', displayName: 'X' }, host)).toBe(
        REASON_NOT_SEATED,
      );
      expect(session.dispatch({ kind: 'updateProfile', displayName: ' ' }, guest)).toBe(
        suite.configReason,
      );
    });

    it('rejects host commands from a non-host with the platform not-host code', () => {
      const session = suite.makeSession();
      session.dispatch({ kind: 'take', seat: 0, displayName: 'Host' }, host);
      expect(session.dispatch({ kind: 'fillBots' }, guest)).toBe(REASON_NOT_HOST);
      expect(session.dispatch({ kind: 'kick', seat: 0 }, guest)).toBe(REASON_NOT_HOST);
      expect(session.dispatch({ kind: 'clear' }, guest)).toBe(REASON_NOT_HOST);
      // The host gate precedes config validation: even an invalid config hears not-host.
      expect(session.dispatch({ kind: 'config', variant: 'invalid' }, guest)).toBe(REASON_NOT_HOST);
    });

    it('fills every empty seat with bots, idempotently', () => {
      const session = suite.makeSession();
      session.dispatch({ kind: 'take', seat: 0, displayName: 'Host' }, host);
      expect(session.dispatch({ kind: 'fillBots' }, host)).toBeNull();
      for (let seat = 0; seat < suite.seatCount; seat += 1) {
        expect(session.occupantKind(seat)).not.toBe('empty');
      }
      expect(session.dispatch({ kind: 'fillBots' }, host)).toBeNull();
      expect(session.occupantKind(1)).toBe('bot');
    });

    it('rejects a host acting through a bot takeover with the takeover code', () => {
      const session = suite.makeSession();
      session.dispatch({ kind: 'take', seat: 0, displayName: 'Host' }, host);
      session.dispatch({ kind: 'fillBots' }, host);
      expect(
        session.dispatch({ kind: 'clear' }, { userId: suite.hostUserId, controlledSeat: 1 }),
      ).toBe(REASON_CONTROLLED_SEAT_NOT_ALLOWED);
    });

    it('kicks humans and bots, and rejects kicking an empty seat', () => {
      const session = suite.makeSession();
      session.dispatch({ kind: 'take', seat: 0, displayName: 'Host' }, host);
      session.dispatch({ kind: 'take', seat: 1, displayName: 'Guest' }, guest);
      session.dispatch({ kind: 'fillBots' }, host);
      expect(session.occupantKind(2)).toBe('bot');
      expect(session.dispatch({ kind: 'kick', seat: 2 }, host)).toBeNull();
      expect(session.occupantKind(2)).toBe('empty');
      expect(session.dispatch({ kind: 'kick', seat: 1 }, host)).toBeNull();
      expect(session.occupantKind(1)).toBe('empty');
      expect(session.dispatch({ kind: 'kick', seat: 1 }, host)).toBe(REASON_SEAT_EMPTY);
    });

    it('clears the whole room', () => {
      const session = suite.makeSession();
      session.dispatch({ kind: 'take', seat: 0, displayName: 'Host' }, host);
      session.dispatch({ kind: 'fillBots' }, host);
      expect(session.dispatch({ kind: 'clear' }, host)).toBeNull();
      for (let seat = 0; seat < suite.seatCount; seat += 1) {
        expect(session.occupantKind(seat)).toBe('empty');
      }
    });

    it('applies a valid config and rejects an invalid one with the config reason', () => {
      const session = suite.makeSession();
      expect(session.dispatch({ kind: 'config', variant: 'valid' }, host)).toBeNull();
      expect(session.seatCount()).toBe(suite.validSeatCount);
      expect(session.dispatch({ kind: 'config', variant: 'invalid' }, host)).toBe(
        suite.configReason,
      );
    });

    it('rejects a shrinking config that strands an occupant with the occupied reason', () => {
      const session = suite.makeSession();
      session.dispatch(
        { kind: 'take', seat: lastSeat, displayName: 'Last' },
        { userId: 'last', controlledSeat: null },
      );
      expect(session.dispatch({ kind: 'config', variant: 'shrinking' }, host)).toBe(
        suite.occupiedReason,
      );
      expect(session.seatCount()).toBe(suite.seatCount);
    });

    it('keeps the profile branch open after the lobby, behind the lobby gate for the rest', () => {
      const session = suite.makeSession();
      session.leaveLobby();
      // Profile updates run ahead of the lobby gate: a seated user still commits.
      expect(session.dispatch({ kind: 'updateProfile', displayName: 'In Game' }, host)).toBeNull();
      // Seat and host commands hear the phase reason — a guest included,
      // so the lobby gate provably precedes the host gate.
      expect(session.dispatch({ kind: 'take', seat: 0, displayName: 'Late' }, guest)).toBe(
        suite.phaseReason,
      );
      expect(session.dispatch({ kind: 'fillBots' }, guest)).toBe(suite.phaseReason);
      expect(session.dispatch({ kind: 'fillBots' }, host)).toBe(suite.phaseReason);
    });
  });
}
