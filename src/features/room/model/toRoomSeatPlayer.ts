/** The one projection from a seat occupant's profile facts to the seat player model. */

import type { RoomSeatPlayer } from './RoomSeatDataSource';

/**
 * Source facts for a seat player. Mirrors the engine roster profile
 * (RoomSeatProfile) plus identity, so roster games can spread a profile
 * straight in; a game whose local model names the reveal effect
 * differently maps it onto revealEffect at the call site.
 */
export interface RoomSeatPlayerSource {
  readonly kind: 'human' | 'bot';
  readonly userId: string;
  readonly displayName: string;
  readonly avatarUrl?: string;
  readonly avatarFrame?: string;
  readonly seatFlair?: string;
  readonly seatAnimation?: string;
  readonly nameStyle?: string;
  readonly revealEffect?: string;
  readonly level?: number;
}

/**
 * Projects source facts to a RoomSeatPlayer: revealEffect is renamed to
 * seatPetId, and isAnonymous is derived from the absence of an avatar.
 * All seven games previously wrote this eleven-field mapping in four
 * different styles (explicit list, profile spread, target-derived,
 * local-player fields).
 */
export function toRoomSeatPlayer(source: RoomSeatPlayerSource): RoomSeatPlayer {
  return {
    kind: source.kind,
    userId: source.userId,
    displayName: source.displayName,
    avatarUrl: source.avatarUrl,
    avatarFrame: source.avatarFrame,
    seatFlair: source.seatFlair,
    seatAnimation: source.seatAnimation,
    nameStyle: source.nameStyle,
    seatPetId: source.revealEffect,
    level: source.level,
    isAnonymous: source.avatarUrl === undefined,
  };
}
