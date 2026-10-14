/**
 * Seat identity projection — the one derivation from a roster seat to
 * its public identity facts.
 *
 * A bot occupant holds no profile in the roster, so its display name
 * is the game's bot name for the seat; a human occupant contributes
 * its profile display name. Avalon and drawguess previously kept
 * verbatim copies of this guard in their visibility modules.
 */

import type { RoomSeatProfile } from './roster';
import { isBotOccupant, isBotSeat, type RosterMap, type SeatOccupant } from './seating';

/** A roster human seat as the identity projection reads it: identity plus profile. */
export interface SeatIdentityOccupant extends SeatOccupant {
  readonly profile: RoomSeatProfile;
}

/**
 * Display name for a seat: the human occupant's profile name, or the
 * game's bot name for the seat when the occupant is a bot (or the seat
 * is empty — callers only ask about occupied seats).
 */
export function getSeatDisplayName<TSeat extends SeatIdentityOccupant>(
  roster: RosterMap<TSeat>,
  seat: number,
  botDisplayName: (seat: number) => string,
): string {
  const occupant = roster[seat];
  if (occupant != null && !isBotOccupant(occupant)) return occupant.profile.displayName;
  return botDisplayName(seat);
}

/** The public identity facts of one seat, before a game adds its own view fields. */
export interface SeatIdentityView {
  readonly seat: number;
  readonly displayName: string;
  readonly isBot: boolean;
}

/** Builds the identity core of a seat view; game views spread it and add their fields. */
export function buildSeatIdentityView<TSeat extends SeatIdentityOccupant>(
  roster: RosterMap<TSeat>,
  seat: number,
  botDisplayName: (seat: number) => string,
): SeatIdentityView {
  return {
    seat,
    displayName: getSeatDisplayName(roster, seat, botDisplayName),
    isBot: isBotSeat(roster, seat),
  };
}
