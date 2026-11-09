/**
 * The one derivation from a roster seat to its public profile target.
 *
 * A human occupant contributes its user id and profile display name; a
 * bot occupant has no identity in the roster, so its target is the seat
 * itself with the shared bot display name. Every roster game calls this
 * with its engine roster; the werewolf rebuild reads the same roster.
 */

import { getBotDisplayName } from '@game-judge/game-engine/platform/room/getBotDisplayName';
import type { RoomSeatProfile } from '@game-judge/game-engine/platform/room/roster';

import type { RoomProfileTarget } from './RoomCapabilities';

/** A human roster occupant as this derivation reads it (mirrors the engine roster occupant). */
export interface RoomProfileTargetHuman {
  readonly userId: string;
  readonly profile: RoomSeatProfile;
}

/** A bot roster occupant: a marker carrying no identity of its own. */
export interface RoomProfileTargetBot {
  readonly kind: 'bot';
}

export type RoomProfileTargetOccupant = RoomProfileTargetHuman | RoomProfileTargetBot;

function isBotOccupant(occupant: RoomProfileTargetOccupant): occupant is RoomProfileTargetBot {
  return 'kind' in occupant && occupant.kind === 'bot';
}

/** Resolve only public roster identity for the shared profile controls. */
export function getRoomProfileTarget(
  roster: Readonly<Record<number, RoomProfileTargetOccupant | null | undefined>>,
  seat: number,
): RoomProfileTarget | null {
  const occupant = roster[seat];
  if (occupant == null) return null;
  if (isBotOccupant(occupant)) {
    return { seat, occupant: { kind: 'bot', seat }, rosterName: getBotDisplayName(seat) };
  }
  return {
    seat,
    occupant: { kind: 'human', userId: occupant.userId },
    rosterName: occupant.profile.displayName,
  };
}
