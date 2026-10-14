/**
 * Bot Takeover Resolution — shared scenario suite (bot wave PR-2).
 *
 * Every game whose commands resolve an acting seat (all seven) runs
 * these exact scenarios against its own engine through a small
 * driver, so the takeover propositions cannot drift per game:
 *
 * 1. a system actor never resolves a seat (each game declares the
 *    reason its probe surface answers: the platform user-actor code,
 *    or an earlier pre-gate reason where a bound task identity is
 *    checked before resolution);
 * 2. a user with no seat rejects when uncontrolled (same declaration
 *    rule: the platform not-seated code, or the pre-gate reason);
 * 3. a seated user acting uncontrolled resolves to their own seat,
 *    and so does the host;
 * 4. takeover is host-only: a non-host controlling a bot seat
 *    rejects not-host;
 * 5. the takeover target must be a bot seat: the host controlling a
 *    human seat rejects controlled-seat-not-bot;
 * 6. the host controlling a bot seat resolves to that bot seat.
 *
 * Each driver seats a fixed layout — host at the host seat, a human
 * guest at the guest seat, a bot at the bot seat — and probes one of
 * the game's own acting-seat commands, reporting the seat the
 * command acted from (or the rejection reason). Game-specific gates
 * behind the resolution stay in each game's own test files.
 */

import { describe, expect, it } from 'vitest';

import { REASON_CONTROLLED_SEAT_NOT_BOT, REASON_NOT_HOST } from '../../protocol/reasons';

/** A command actor the suite probes with. */
export type ActingSeatProbeActor =
  | { readonly kind: 'system' }
  | { readonly kind: 'user'; readonly userId: string; readonly controlledSeat: number | null };

/** A probe outcome reduced to what the propositions assert on. */
export type ActingSeatProbe =
  | { readonly kind: 'resolved'; readonly seat: number }
  | { readonly kind: 'rejected'; readonly reason: string };

/** One live session of a game, in a phase where its probe command is decidable. */
export interface ActingSeatSession {
  /** Runs the game's probe command as the given actor and reports the outcome. */
  probe(actor: ActingSeatProbeActor): ActingSeatProbe;
}

export interface ActingSeatSuite {
  /** Display name for the describe block. */
  readonly game: string;
  readonly hostUserId: string;
  readonly hostSeat: number;
  readonly guestUserId: string;
  readonly guestSeat: number;
  readonly botSeat: number;
  /**
   * Reason the probe rejects a system actor with. Every game answers
   * the platform code, except a game whose command pipeline checks a
   * bound task identity before seat resolution (pictionary's binding
   * preamble): an actor that cannot be seat-bound never reaches the
   * resolver there, and the game declares that pre-gate reason here.
   */
  readonly systemActorReason: string;
  /** Reason the probe rejects an unseated uncontrolled user with; see above. */
  readonly unseatedReason: string;
  /** A fresh session with the fixed layout: host and guest seated, bot seat filled. */
  makeSession(): ActingSeatSession;
}

export function describeBotTakeoverResolution(suite: ActingSeatSuite): void {
  const user = (userId: string, controlledSeat: number | null = null): ActingSeatProbeActor => ({
    kind: 'user',
    userId,
    controlledSeat,
  });

  describe(`Bot Takeover Resolution - shared scenarios (${suite.game})`, () => {
    it('rejects a system actor', () => {
      const session = suite.makeSession();
      expect(session.probe({ kind: 'system' })).toEqual({
        kind: 'rejected',
        reason: suite.systemActorReason,
      });
    });

    it('rejects an unseated user acting uncontrolled', () => {
      const session = suite.makeSession();
      expect(session.probe(user('outsider'))).toEqual({
        kind: 'rejected',
        reason: suite.unseatedReason,
      });
    });

    it('resolves a seated guest acting uncontrolled to their own seat', () => {
      const session = suite.makeSession();
      expect(session.probe(user(suite.guestUserId))).toEqual({
        kind: 'resolved',
        seat: suite.guestSeat,
      });
    });

    it('resolves the host acting uncontrolled to the host seat', () => {
      const session = suite.makeSession();
      expect(session.probe(user(suite.hostUserId))).toEqual({
        kind: 'resolved',
        seat: suite.hostSeat,
      });
    });

    it('rejects a non-host controlling a bot seat', () => {
      const session = suite.makeSession();
      expect(session.probe(user(suite.guestUserId, suite.botSeat))).toEqual({
        kind: 'rejected',
        reason: REASON_NOT_HOST,
      });
    });

    it('rejects the host controlling a human seat', () => {
      const session = suite.makeSession();
      expect(session.probe(user(suite.hostUserId, suite.guestSeat))).toEqual({
        kind: 'rejected',
        reason: REASON_CONTROLLED_SEAT_NOT_BOT,
      });
    });

    it('resolves the host controlling a bot seat to that seat', () => {
      const session = suite.makeSession();
      expect(session.probe(user(suite.hostUserId, suite.botSeat))).toEqual({
        kind: 'resolved',
        seat: suite.botSeat,
      });
    });
  });
}
