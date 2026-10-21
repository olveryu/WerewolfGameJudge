/**
 * FibKing persisted-state profile decoding contract.
 *
 * The worker compares serialized state byte-for-byte against the parse
 * round-trip, so a parsed seat profile must carry the roster fields in
 * the canonical order `buildRoomSeatProfile` produces — every key
 * present (absent fields as undefined placeholders) in RosterEntry
 * declaration order — no matter which subset the stored JSON carried
 * or in which order it carried them.
 */

import { describe, expect, it } from 'vitest';

import { fibEngine } from '../engine';
import { parseFibState } from '../state/parseState';

const CANONICAL_PROFILE_KEYS = [
  'displayName',
  'avatarUrl',
  'avatarFrame',
  'seatFlair',
  'seatAnimation',
  'nameStyle',
  'revealEffect',
  'level',
] as const;

function storedStateWithProfile(profile: Record<string, unknown>): unknown {
  const created = fibEngine.createInitialState(
    { numberOfPlayers: 4 },
    { roomCode: '1234', hostUserId: 'host', nowMs: 1000, commandId: 'create' },
  );
  const raw = JSON.parse(JSON.stringify(created)) as Record<string, unknown>;
  raw.roster = { 0: { seat: 0, userId: 'host', profile } };
  return raw;
}

describe('FibKing state parsing — seat profile key order', () => {
  it('rebuilds a sparse stored profile with every roster key in canonical order', () => {
    // Stored JSON carries only the defined fields, out of order.
    const parsed = parseFibState(
      storedStateWithProfile({ level: 3, seatAnimation: 'anim-1', displayName: 'Host' }),
    );
    const occupant = parsed.roster[0];
    if (!occupant || !('profile' in occupant)) {
      throw new Error('expected seat 0 to hold a human occupant');
    }
    expect(Object.keys(occupant.profile)).toEqual([...CANONICAL_PROFILE_KEYS]);
    expect(occupant.profile.displayName).toBe('Host');
    expect(occupant.profile.seatAnimation).toBe('anim-1');
    expect(occupant.profile.level).toBe(3);
    // Serialization drops the undefined placeholders and keeps the
    // defined fields in canonical relative order.
    expect(JSON.stringify(occupant.profile)).toBe(
      '{"displayName":"Host","seatAnimation":"anim-1","level":3}',
    );
  });

  it('rejects a stored profile carrying an unknown field', () => {
    expect(() =>
      parseFibState(storedStateWithProfile({ displayName: 'Host', nickname: 'H' })),
    ).toThrow('contains unknown field: nickname');
  });
});
