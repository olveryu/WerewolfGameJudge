/**
 * RoomOccupant — who sits in a seat, as the shared room UI addresses it.
 *
 * A human occupant is identified by its user id; a bot occupant has no
 * user id at all (the engine roster stores only a bot marker), so it is
 * identified by its seat. Nothing in the shared layer synthesizes a
 * user-id-shaped string for a bot anymore; the one cosmetic place that
 * needs a string (the avatar seed) derives it here, once.
 */

export type RoomOccupant =
  | { readonly kind: 'human'; readonly userId: string }
  | { readonly kind: 'bot'; readonly seat: number };

/** Seed for the generated avatar icon; bots are seeded by seat so every room draws the same bot faces. */
export function getRoomOccupantAvatarSeed(occupant: RoomOccupant): string {
  return occupant.kind === 'human' ? occupant.userId : `bot:${occupant.seat}`;
}

/** The human user id, or null for a bot. */
export function getRoomOccupantUserId(occupant: RoomOccupant): string | null {
  return occupant.kind === 'human' ? occupant.userId : null;
}
