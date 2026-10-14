/**
 * Acting-seat resolution — the one implementation of command seat
 * resolution under bot takeover.
 *
 * A command acts from the actor's own seat, or — when the host has
 * taken over a bot seat (the worker envelope's controlledSeat) — from
 * that bot seat. Takeover is host-only and the target must be a bot
 * seat; every other arrangement rejects. The gate order is fixed:
 * user actor, host gate, bot gate, own-seat lookup. Games supply
 * only the roster slice and their seat count; the resolution itself
 * lives here alone (bot extraction wave PR-2, lifted from the relay
 * task machine's inline original). resolveActingSeatForUser exposes
 * the same gate sequence to display projections that already hold a
 * user id instead of a command context.
 */

import { type ActorResolution, type CommandContext, resolveUserActorId } from '../engine';
import {
  REASON_CONTROLLED_SEAT_NOT_BOT,
  REASON_NOT_HOST,
  REASON_NOT_SEATED,
} from '../protocol/reasons';
import { findRosterSeatByUserId, isBotSeat, type RosterMap, type SeatOccupant } from './seating';

/** Roster access acting-seat resolution needs, satisfied by every game's state. */
export interface ActingSeatSlice {
  readonly hostUserId: string;
  readonly roster: RosterMap<SeatOccupant>;
}

function rejected(reason: string): ActorResolution<number> {
  return { kind: 'rejected', reason };
}

/**
 * Resolves the seat a command acts from: the controlled bot seat
 * under host takeover, otherwise the actor's own roster seat.
 */
export function resolveActingSeat(
  slice: ActingSeatSlice,
  numberOfPlayers: number,
  context: CommandContext,
): ActorResolution<number> {
  const actor = resolveUserActorId(context);
  if (actor.kind === 'rejected') return actor;
  return resolveActingSeatForUser(slice, numberOfPlayers, actor.value, context.controlledSeat);
}

/**
 * The acting-seat gates for a caller that already holds a user id:
 * a controlled seat requires the host and a bot target, otherwise
 * the seat is the user's own roster seat. Rejections carry the
 * platform reasons; projection callers collapse them to no view.
 */
export function resolveActingSeatForUser(
  slice: ActingSeatSlice,
  numberOfPlayers: number,
  userId: string,
  controlledSeat: number | null,
): ActorResolution<number> {
  let seat = controlledSeat;
  if (seat !== null) {
    if (userId !== slice.hostUserId) return rejected(REASON_NOT_HOST);
    if (!isBotSeat(slice.roster, seat)) return rejected(REASON_CONTROLLED_SEAT_NOT_BOT);
  } else seat = findRosterSeatByUserId(slice.roster, numberOfPlayers, userId);
  if (seat === null) return rejected(REASON_NOT_SEATED);
  return { kind: 'resolved', value: seat };
}
