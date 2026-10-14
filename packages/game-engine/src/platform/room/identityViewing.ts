/**
 * Identity Viewing Protocol — shared pure rules (P-1).
 *
 * Games that deal secret identities (werewolf, avalon, fibking,
 * undercover) record per-seat "has viewed" state on the server and gate
 * the start of play on the record being complete: every seated
 * player, bots included, must be marked viewed before the game can
 * begin (the werewolf rule, adopted platform-wide 2026-10-12). Humans
 * mark themselves by viewing; bot seats are marked by the host through
 * the manual-test scaffold action (mark all bots viewed) — engines
 * never auto-mark. The record lives in each game's own state machine;
 * these helpers are the single implementation of the protocol's pure
 * decisions so the four engines cannot drift:
 *
 * - markSeatViewed: idempotent insert into the viewed-seat set.
 * - listUnviewedSeats: who has not viewed yet (host-facing).
 * - listUnviewedBotSeats: the seats the host scaffold action fills.
 * - haveAllViewed: the checkpoint predicate; every participant counts.
 * - buildIdentityViewingParticipants: the one construction of the
 *   participant list from a roster and its occupied seats.
 * - planMarkBotsViewed / decideMarkBotsViewed: the host scaffold
 *   decide skeleton; each game injects its own gate outcome, reason
 *   strings, viewed-event shape and commit, so the gate order and
 *   the no-bot-seats rejection live in exactly one place.
 */

import { type Decision, type GameEffect, type GameEvent, reject } from '../engine';
import { isBotSeat, type RosterMap, type SeatOccupant } from './seating';

export interface IdentityViewingParticipant {
  readonly seat: number;
  readonly isBot: boolean;
}

/**
 * Builds the participant list for the given occupied seats, in the
 * order given: each seat paired with its bot flag from the roster.
 * This is the single construction every identity game uses; a game
 * whose occupancy lives outside the roster (werewolf's players
 * record) passes its own occupied-seat list, roster games use
 * buildRosterViewingParticipants.
 */
export function buildIdentityViewingParticipants<TSeat extends SeatOccupant>(
  roster: RosterMap<TSeat>,
  seats: readonly number[],
): readonly IdentityViewingParticipant[] {
  return seats.map((seat) => ({ seat, isBot: isBotSeat(roster, seat) }));
}

/**
 * Participants for a roster game: every occupied seat in
 * `0 .. numberOfPlayers - 1`, ascending.
 */
export function buildRosterViewingParticipants<TSeat extends SeatOccupant>(
  roster: RosterMap<TSeat>,
  numberOfPlayers: number,
): readonly IdentityViewingParticipant[] {
  const seats: number[] = [];
  for (let seat = 0; seat < numberOfPlayers; seat += 1) {
    if (roster[seat] != null) seats.push(seat);
  }
  return buildIdentityViewingParticipants(roster, seats);
}

/** Idempotently add a seat to the viewed set; returns the input when already present. */
export function markSeatViewed(viewedSeats: readonly number[], seat: number): readonly number[] {
  if (viewedSeats.includes(seat)) return viewedSeats;
  return [...viewedSeats, seat].sort((a, b) => a - b);
}

/** Participants that have not viewed yet, in participant order. */
export function listUnviewedSeats(
  participants: readonly IdentityViewingParticipant[],
  viewedSeats: readonly number[],
): readonly IdentityViewingParticipant[] {
  return participants.filter((participant) => !viewedSeats.includes(participant.seat));
}

/** Checkpoint predicate (the start gate): every participant has viewed. */
export function haveAllViewed(
  participants: readonly IdentityViewingParticipant[],
  viewedSeats: readonly number[],
): boolean {
  return participants.every((participant) => viewedSeats.includes(participant.seat));
}

/** Bot seats the host scaffold action still has to mark, in participant order. */
export function listUnviewedBotSeats(
  participants: readonly IdentityViewingParticipant[],
  viewedSeats: readonly number[],
): readonly IdentityViewingParticipant[] {
  return participants.filter(
    (participant) => participant.isBot && !viewedSeats.includes(participant.seat),
  );
}

/**
 * The scaffold computation once a game's own gates pass: which bot
 * seats a mark-all-bots-viewed command still has to fill. With no
 * bot seats at all the command rejects (werewolf parity, Wave 8)
 * instead of committing an empty success; with every bot already
 * marked it is an idempotent no-op.
 */
export type MarkBotsViewedPlan =
  | { readonly kind: 'noBotSeats' }
  | { readonly kind: 'noop' }
  | { readonly kind: 'mark'; readonly seats: readonly number[] };

export function planMarkBotsViewed(
  participants: readonly IdentityViewingParticipant[],
  viewedSeats: readonly number[],
): MarkBotsViewedPlan {
  if (!participants.some((participant) => participant.isBot)) return { kind: 'noBotSeats' };
  const unviewedBots = listUnviewedBotSeats(participants, viewedSeats);
  if (unviewedBots.length === 0) return { kind: 'noop' };
  return { kind: 'mark', seats: unviewedBots.map((participant) => participant.seat) };
}

/**
 * The mark-all-bots-viewed decide skeleton. The game's own gates
 * (viewing window and host) run first, composed in the game's own
 * order and mechanics and handed in as a ready-made rejection (or
 * null when they pass); the shared plan then decides between the
 * no-bot-seats rejection, an idempotent empty commit, and one
 * viewed event per unviewed bot seat. Reason strings, the viewed
 * event shape and the commit stay the game's own.
 */
export function decideMarkBotsViewed<TEvent extends GameEvent, TEffect extends GameEffect>(input: {
  readonly gateRejection: Decision<TEvent, TEffect> | null;
  readonly participants: readonly IdentityViewingParticipant[];
  readonly viewedSeats: readonly number[];
  readonly noBotSeatsReason: string;
  readonly buildViewedEvent: (seat: number) => TEvent;
  readonly commit: (events: readonly TEvent[]) => Decision<TEvent, TEffect>;
}): Decision<TEvent, TEffect> {
  if (input.gateRejection !== null) return input.gateRejection;
  const plan = planMarkBotsViewed(input.participants, input.viewedSeats);
  if (plan.kind === 'noBotSeats') return reject(input.noBotSeatsReason);
  if (plan.kind === 'noop') return input.commit([]);
  return input.commit(plan.seats.map((seat) => input.buildViewedEvent(seat)));
}
