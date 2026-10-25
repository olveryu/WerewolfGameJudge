/** Shared room profiles and strict roster decoding, independent of game rules. */

import {
  failDecode,
  finishObject,
  parseInteger,
  parseNonEmptyString,
  parseObject,
  parseOptional,
  parseSeat,
  parseString,
} from '../protocol/runtimeDecoder';
import type { BotSeatOccupant, SeatOccupant } from './seating';

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

/** A profiled human occupant shared by strict room state codecs. */
export interface RoomHumanSeat extends SeatOccupant {
  readonly profile: RoomSeatProfile;
}

export type RoomProfileUpdate = Readonly<Partial<Omit<RoomSeatProfile, 'level'>>>;

/**
 * Decodes shared profile fields in canonical order without game-specific validation.
 * @throws If a field is unknown or has an invalid runtime type.
 */
export function parseRoomSeatProfile(value: unknown, path: string): RoomSeatProfile {
  const raw = parseObject(value, path);
  return finishObject(
    raw,
    buildRoomSeatProfile({
      displayName: parseNonEmptyString(raw.displayName, `${path}.displayName`),
      avatarUrl: parseOptional(raw.avatarUrl, `${path}.avatarUrl`, parseString),
      avatarFrame: parseOptional(raw.avatarFrame, `${path}.avatarFrame`, parseString),
      seatFlair: parseOptional(raw.seatFlair, `${path}.seatFlair`, parseString),
      seatAnimation: parseOptional(raw.seatAnimation, `${path}.seatAnimation`, parseString),
      nameStyle: parseOptional(raw.nameStyle, `${path}.nameStyle`, parseString),
      revealEffect: parseOptional(raw.revealEffect, `${path}.revealEffect`, parseString),
      level: parseOptional(raw.level, `${path}.level`, parseInteger),
    }),
    path,
  );
}

/**
 * Decodes a profiled human seat, including historical human-only roster entries.
 * @throws If a field is unknown or has an invalid runtime type.
 */
export function parseRoomHumanSeat(value: unknown, path: string): RoomHumanSeat {
  const raw = parseObject(value, path);
  return finishObject(
    raw,
    {
      seat: parseSeat(raw.seat, `${path}.seat`),
      userId: parseNonEmptyString(raw.userId, `${path}.userId`),
      profile: parseRoomSeatProfile(raw.profile, `${path}.profile`),
    },
    path,
  );
}

/**
 * Decodes occupied roster slots; game normalization retains range and identity checks.
 * @throws If keys are noncanonical or occupants contain unknown or malformed fields.
 */
export function parseRoomRoster(
  value: unknown,
  path: string,
): Readonly<Record<number, RoomHumanSeat | BotSeatOccupant>> {
  const raw = parseObject(value, path);
  const roster: Record<number, RoomHumanSeat | BotSeatOccupant> = {};
  for (const [key, occupant] of Object.entries(raw)) {
    if (!/^(0|[1-9]\d*)$/.test(key)) {
      failDecode(`${path}.${key}`, 'a canonical non-negative integer key');
    }
    const seat = parseSeat(Number(key), `${path}.${key}`);
    const rawOccupant = parseObject(occupant, `${path}.${key}`);
    roster[seat] =
      rawOccupant.kind === 'bot'
        ? finishObject(
            rawOccupant,
            { seat: parseSeat(rawOccupant.seat, `${path}.${key}.seat`), kind: 'bot' as const },
            `${path}.${key}`,
          )
        : parseRoomHumanSeat(occupant, `${path}.${key}`);
  }
  return roster;
}

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
