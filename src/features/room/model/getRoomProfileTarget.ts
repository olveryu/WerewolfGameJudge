/**
 * The one derivation from a roster seat to its public profile target.
 *
 * The six roster games (avalon, drawguess, fibking, pictionary,
 * storyrelay, undercover) each wrote this verbatim: a human occupant
 * contributes its own userId and profile display name; a bot occupant
 * has no identity in the roster, so the game synthesizes one from the
 * seat through its own botUserId / botDisplayName functions (the id
 * formats stay game-owned and are not unified here). Werewolf builds
 * its target from a LocalPlayer in its interaction dispatcher — a
 * different source model, so it does not use this function.
 */

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
  botUserId: (seat: number) => string,
  botDisplayName: (seat: number) => string,
): RoomProfileTarget | null {
  const occupant = roster[seat];
  if (occupant != null && !isBotOccupant(occupant))
    return {
      seat,
      userId: occupant.userId,
      occupantKind: 'human',
      rosterName: occupant.profile.displayName,
    };
  return occupant != null && isBotOccupant(occupant)
    ? {
        seat,
        userId: botUserId(seat),
        occupantKind: 'bot',
        rosterName: botDisplayName(seat),
      }
    : null;
}
