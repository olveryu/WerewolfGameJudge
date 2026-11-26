/**
 * Regression pin for the profile key-order hazard: zod emits parsed keys in
 * schema declaration order, room state is persisted from the parsed profile,
 * and roomRepository byte-compares JSON.stringify against a parseState
 * rebuild (canonical RosterEntry order). If the profile schemas drift from
 * the canonical order again, a profile carrying two or more cosmetic fields
 * makes every later rejected command in that room throw
 * "Rejected commands cannot change state or create effects".
 */
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { ROOM_HUMAN_PUBLIC_COMMAND_SCHEMAS, ROOM_PUBLIC_COMMAND_SCHEMAS } from '../commandSchemas';

const roomCommandSchema = z.discriminatedUnion('type', [...ROOM_PUBLIC_COMMAND_SCHEMAS]);

// Canonical RosterEntry order (game-engine platform/room/roster.ts and every
// game's parseRosterEntry literal), restricted to the fields sent here.
const CANONICAL_PROFILE_KEYS = [
  'displayName',
  'seatFlair',
  'seatAnimation',
  'nameStyle',
  'revealEffect',
  'level',
] as const;

const CANONICAL_PROFILE = {
  displayName: 'Alice',
  seatFlair: 'flair-1',
  seatAnimation: 'anim-1',
  nameStyle: 'style-1',
  revealEffect: 'reveal-1',
  level: 3,
};

describe('room profile command schemas', () => {
  it('emits room.seat.take profile keys in canonical RosterEntry order', () => {
    // Input deliberately arrives in the old schema order; the parsed output
    // order must follow the canonical order, not the input order.
    const parsed = roomCommandSchema.parse({
      type: 'room.seat.take',
      seat: 0,
      profile: {
        displayName: 'Alice',
        nameStyle: 'style-1',
        revealEffect: 'reveal-1',
        seatAnimation: 'anim-1',
        seatFlair: 'flair-1',
        level: 3,
      },
    });
    if (parsed.type !== 'room.seat.take') throw new Error('Expected room.seat.take');
    expect(Object.keys(parsed.profile)).toEqual([...CANONICAL_PROFILE_KEYS]);
    expect(JSON.stringify(parsed.profile)).toBe(JSON.stringify(CANONICAL_PROFILE));
  });

  it('emits room.profile.update keys in canonical RosterEntry order', () => {
    const parsed = roomCommandSchema.parse({
      type: 'room.profile.update',
      profile: {
        nameStyle: 'style-1',
        revealEffect: 'reveal-1',
        seatAnimation: 'anim-1',
        seatFlair: 'flair-1',
      },
    });
    if (parsed.type !== 'room.profile.update') throw new Error('Expected room.profile.update');
    expect(Object.keys(parsed.profile)).toEqual([
      'seatFlair',
      'seatAnimation',
      'nameStyle',
      'revealEffect',
    ]);
    expect(JSON.stringify(parsed.profile)).toBe(
      JSON.stringify({
        seatFlair: 'flair-1',
        seatAnimation: 'anim-1',
        nameStyle: 'style-1',
        revealEffect: 'reveal-1',
      }),
    );
  });
});

describe('room command schemas of a game without bots', () => {
  const humanRoomCommandSchema = z.discriminatedUnion('type', [
    ...ROOM_HUMAN_PUBLIC_COMMAND_SCHEMAS,
  ]);

  it('rejects fill-bots and accepts every other shared room command', () => {
    expect(humanRoomCommandSchema.safeParse({ type: 'room.seat.fillBots' }).success).toBe(false);
    for (const command of [
      { type: 'room.seat.take', seat: 0, profile: { displayName: 'Alice' } },
      { type: 'room.seat.leave' },
      { type: 'room.seat.kick', seat: 1 },
      { type: 'room.seat.clear' },
      { type: 'room.profile.update', profile: { displayName: 'Bob' } },
    ]) {
      expect(humanRoomCommandSchema.parse(command)).toEqual(command);
    }
  });
});
