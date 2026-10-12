/**
 * Identity Viewing Protocol — shared scenario suite (AU-45).
 *
 * Every game that deals secret identities runs these exact scenarios
 * against its own engine through a small driver, so the protocol
 * semantics (strict checkpoint, host-only bot marks, idempotent
 * records) cannot drift per game. Game-specific behavior (night-step
 * interplay, migrations, projections) stays in each game's own
 * contract file next to the suite call.
 */

import { describe, expect, it } from 'vitest';

import { haveAllViewed, type IdentityViewingParticipant } from '../identityViewing';

/** One live viewing-phase session, driven through the game's own commands. */
export interface IdentityViewingSession {
  /** The recorded viewed seats, in the game's own storage order. */
  viewedSeats(): readonly number[];
  /** Every seated participant of the session (humans and bots). */
  participants(): readonly IdentityViewingParticipant[];
  /** That seat views its identity (its own action or a host takeover). */
  view(seat: number): void;
  /** The host scaffold action that fills every unviewed bot record. */
  markAllBotsViewed(): void;
  /** Whether the game has advanced past the viewing checkpoint. */
  isCheckpointOpen(): boolean;
}

export interface IdentityViewingSuite {
  /** Display name for the describe block. */
  readonly game: string;
  /** A fresh session: at least one human and one bot seat, nobody viewed. */
  makeSession(): IdentityViewingSession;
}

export function describeIdentityViewingProtocol(suite: IdentityViewingSuite): void {
  describe(`Identity Viewing Protocol - shared scenarios (${suite.game})`, () => {
    it('starts with an empty record and a closed checkpoint', () => {
      const session = suite.makeSession();
      expect(session.viewedSeats()).toEqual([]);
      expect(session.isCheckpointOpen()).toBe(false);
    });

    it('holds the checkpoint while any bot seat is unmarked, even with every human viewed', () => {
      const session = suite.makeSession();
      for (const participant of session.participants()) {
        if (!participant.isBot) session.view(participant.seat);
      }
      expect(session.isCheckpointOpen()).toBe(false);
      expect(haveAllViewed(session.participants(), session.viewedSeats())).toBe(false);

      session.markAllBotsViewed();
      expect(session.isCheckpointOpen()).toBe(true);
      expect(haveAllViewed(session.participants(), session.viewedSeats())).toBe(true);
    });

    it('holds the checkpoint while any human is unviewed, even with every bot marked', () => {
      const session = suite.makeSession();
      session.markAllBotsViewed();
      expect(session.isCheckpointOpen()).toBe(false);

      const humans = session.participants().filter((participant) => !participant.isBot);
      for (const participant of humans.slice(0, -1)) session.view(participant.seat);
      expect(session.isCheckpointOpen()).toBe(false);

      session.view(humans[humans.length - 1]!.seat);
      expect(session.isCheckpointOpen()).toBe(true);
    });

    it('marks idempotently: viewing the same seat twice changes nothing further', () => {
      const session = suite.makeSession();
      const first = session.participants()[0]!;
      session.view(first.seat);
      const afterFirst = [...session.viewedSeats()];
      session.view(first.seat);
      expect(session.viewedSeats()).toEqual(afterFirst);
    });

    it('keeps the viewed record sorted and duplicate-free', () => {
      const session = suite.makeSession();
      const seats = session.participants().map((participant) => participant.seat);
      for (const seat of [...seats].reverse()) session.view(seat);
      session.markAllBotsViewed();
      const viewed = session.viewedSeats();
      expect([...viewed]).toEqual([...viewed].sort((a, b) => a - b));
      expect(new Set(viewed).size).toBe(viewed.length);
      expect(session.isCheckpointOpen()).toBe(true);
    });
  });
}
