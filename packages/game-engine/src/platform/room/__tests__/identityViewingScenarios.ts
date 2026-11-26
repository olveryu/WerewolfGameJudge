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
  /** Whether the game has advanced past the viewing checkpoint. */
  isCheckpointOpen(): boolean;
}

/** A session of a game that seats bots, with the host's bulk bot mark. */
export interface IdentityViewingBotSession extends IdentityViewingSession {
  /** The host scaffold action that fills every unviewed bot record. */
  markAllBotsViewed(): void;
}

/**
 * The game under test and its seating model. A game with bots runs the
 * bot-mark scenarios against a session holding at least one human and
 * one bot seat; a game without bots runs the same protocol over human
 * seats only (at least two humans, nobody viewed).
 */
export type IdentityViewingSuite =
  | {
      readonly game: string;
      readonly seating: 'humansAndBots';
      makeSession(): IdentityViewingBotSession;
    }
  | {
      readonly game: string;
      readonly seating: 'humansOnly';
      makeSession(): IdentityViewingSession;
    };

export function describeIdentityViewingProtocol(suite: IdentityViewingSuite): void {
  describe(`Identity Viewing Protocol - shared scenarios (${suite.game})`, () => {
    it('starts with an empty record and a closed checkpoint', () => {
      const session = suite.makeSession();
      expect(session.viewedSeats()).toEqual([]);
      expect(session.isCheckpointOpen()).toBe(false);
    });

    if (suite.seating === 'humansAndBots') {
      describeBotMarkScenarios(suite.makeSession);
    } else {
      it('holds the checkpoint while any seated player is unviewed', () => {
        const session = suite.makeSession();
        const seats = session.participants().map((participant) => participant.seat);
        for (const seat of seats.slice(0, -1)) session.view(seat);
        expect(session.isCheckpointOpen()).toBe(false);

        session.view(seats[seats.length - 1]!);
        expect(session.isCheckpointOpen()).toBe(true);
        expect(haveAllViewed(session.participants(), session.viewedSeats())).toBe(true);
      });
    }

    it('marks idempotently: viewing the same seat twice changes nothing further', () => {
      const session = suite.makeSession();
      const first = session.participants()[0]!;
      session.view(first.seat);
      const afterFirst = [...session.viewedSeats()];
      session.view(first.seat);
      expect(session.viewedSeats()).toEqual(afterFirst);
    });

    it('keeps the viewed record sorted and duplicate-free', () => {
      const session = viewEverySeatInReverse(suite);
      const viewed = session.viewedSeats();
      expect([...viewed]).toEqual([...viewed].sort((a, b) => a - b));
      expect(new Set(viewed).size).toBe(viewed.length);
      expect(session.isCheckpointOpen()).toBe(true);
    });
  });
}

/** Views every seat from the last to the first, then (with bots) re-marks the bots. */
function viewEverySeatInReverse(suite: IdentityViewingSuite): IdentityViewingSession {
  const viewInReverse = (session: IdentityViewingSession): void => {
    const seats = session.participants().map((participant) => participant.seat);
    for (const seat of [...seats].reverse()) session.view(seat);
  };
  if (suite.seating === 'humansOnly') {
    const session = suite.makeSession();
    viewInReverse(session);
    return session;
  }
  const session = suite.makeSession();
  viewInReverse(session);
  session.markAllBotsViewed();
  return session;
}

function describeBotMarkScenarios(makeSession: () => IdentityViewingBotSession): void {
  it('holds the checkpoint while any bot seat is unmarked, even with every human viewed', () => {
    const session = makeSession();
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
    const session = makeSession();
    session.markAllBotsViewed();
    expect(session.isCheckpointOpen()).toBe(false);

    const humans = session.participants().filter((participant) => !participant.isBot);
    for (const participant of humans.slice(0, -1)) session.view(participant.seat);
    expect(session.isCheckpointOpen()).toBe(false);

    session.view(humans[humans.length - 1]!.seat);
    expect(session.isCheckpointOpen()).toBe(true);
  });
}
