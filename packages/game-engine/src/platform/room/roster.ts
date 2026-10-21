/** Shared room roster profile fields, independent of any game rules. */

export interface RosterEntry {
  displayName: string;
  avatarUrl?: string;
  avatarFrame?: string;
  /** Equipped seat flair gacha item ID. */
  seatFlair?: string;
  /** Equipped seat animation gacha item ID. */
  seatAnimation?: string;
  /** Equipped name style gacha item ID. */
  nameStyle?: string;
  /** Equipped reveal effect gacha item ID. */
  revealEffect?: string;
  level?: number;
}

export type RoomSeatProfile = Readonly<RosterEntry>;

export type RoomProfileUpdate = Readonly<Partial<Omit<RoomSeatProfile, 'level'>>>;

/**
 * Builds a seat profile holding every roster field in the canonical
 * order declared on {@link RosterEntry} — the one place that order is
 * produced. Fields absent from `fields` stay present with value
 * `undefined`, matching the shape the state parsers rebuild, and drop
 * out again on serialization.
 *
 * Producers (seat takes, profile merges, parsers) build profiles here
 * instead of trusting the key order of whatever object they were
 * handed: worker persistence compares serialized state byte-for-byte
 * against the parse round-trip, so a profile's key order is payload
 * contract, not an implementation detail.
 */
export function buildRoomSeatProfile(
  fields: Partial<RosterEntry> & Pick<RosterEntry, 'displayName'>,
): RosterEntry {
  return {
    displayName: fields.displayName,
    avatarUrl: fields.avatarUrl,
    avatarFrame: fields.avatarFrame,
    seatFlair: fields.seatFlair,
    seatAnimation: fields.seatAnimation,
    nameStyle: fields.nameStyle,
    revealEffect: fields.revealEffect,
    level: fields.level,
  };
}

/**
 * Merges a profile update over the seated profile: fields the update
 * carries win (an explicit `undefined` clears), the rest keep the
 * seated values, and the result is rebuilt through
 * {@link buildRoomSeatProfile} so the merged key order is canonical no
 * matter what order either side arrived in.
 */
export function mergeRoomSeatProfile(base: RosterEntry, patch: RoomProfileUpdate): RosterEntry {
  return buildRoomSeatProfile({ ...base, ...patch });
}
