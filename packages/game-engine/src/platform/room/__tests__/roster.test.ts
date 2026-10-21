/**
 * Roster profile constructor contract (F-8).
 *
 * `buildRoomSeatProfile` is the one producer of the canonical profile
 * field order, and `mergeRoomSeatProfile` is the one merge path over
 * it. Worker persistence compares serialized state byte-for-byte
 * against the parse round-trip, so these tests pin the produced key
 * order directly: every field subset in, the full canonical key list
 * out, values untouched.
 */

import { describe, expect, it } from 'vitest';

import { buildRoomSeatProfile, mergeRoomSeatProfile } from '../roster';

const CANONICAL_KEYS = [
  'displayName',
  'avatarUrl',
  'avatarFrame',
  'seatFlair',
  'seatAnimation',
  'nameStyle',
  'revealEffect',
  'level',
];

describe('buildRoomSeatProfile', () => {
  it('emits the full canonical key order for a complete field set given out of order', () => {
    const profile = buildRoomSeatProfile({
      level: 7,
      revealEffect: 'confetti',
      nameStyle: 'gold',
      seatAnimation: 'wave',
      seatFlair: 'star',
      avatarFrame: 'oak',
      avatarUrl: 'https://example.test/avatar.png',
      displayName: 'Ada',
    });

    expect(Object.keys(profile)).toEqual(CANONICAL_KEYS);
    expect(profile).toEqual({
      displayName: 'Ada',
      avatarUrl: 'https://example.test/avatar.png',
      avatarFrame: 'oak',
      seatFlair: 'star',
      seatAnimation: 'wave',
      nameStyle: 'gold',
      revealEffect: 'confetti',
      level: 7,
    });
  });

  it('holds absent fields as undefined placeholders in canonical position for any subset', () => {
    const subsets = [
      { displayName: 'Ada' },
      { displayName: 'Ada', level: 3 },
      { displayName: 'Ada', seatAnimation: 'wave', nameStyle: 'gold' },
      { displayName: 'Ada', avatarUrl: 'https://example.test/a.png', revealEffect: 'pop' },
    ];

    for (const fields of subsets) {
      const profile = buildRoomSeatProfile(fields);
      expect(Object.keys(profile)).toEqual(CANONICAL_KEYS);
      for (const key of CANONICAL_KEYS) {
        expect(Object.prototype.hasOwnProperty.call(profile, key)).toBe(true);
      }
    }
  });

  it('serializes with only the defined fields, in canonical relative order', () => {
    const profile = buildRoomSeatProfile({ level: 3, nameStyle: 'gold', displayName: 'Ada' });

    expect(JSON.stringify(profile)).toBe('{"displayName":"Ada","nameStyle":"gold","level":3}');
  });
});

describe('mergeRoomSeatProfile', () => {
  it('places a first-time equipped field in its canonical slot, not at the end', () => {
    const base = buildRoomSeatProfile({ displayName: 'Ada', nameStyle: 'gold', level: 3 });

    const merged = mergeRoomSeatProfile(base, { seatAnimation: 'wave' });

    expect(Object.keys(merged)).toEqual(CANONICAL_KEYS);
    expect(JSON.stringify(merged)).toBe(
      '{"displayName":"Ada","seatAnimation":"wave","nameStyle":"gold","level":3}',
    );
  });

  it('lets the update win on carried fields and keeps the rest of the base', () => {
    const base = buildRoomSeatProfile({
      displayName: 'Ada',
      avatarUrl: 'https://example.test/old.png',
      seatFlair: 'star',
    });

    const merged = mergeRoomSeatProfile(base, {
      avatarUrl: 'https://example.test/new.png',
      nameStyle: 'gold',
    });

    expect(merged.displayName).toBe('Ada');
    expect(merged.avatarUrl).toBe('https://example.test/new.png');
    expect(merged.seatFlair).toBe('star');
    expect(merged.nameStyle).toBe('gold');
  });

  it('clears a field the update carries as undefined, as the spread merge did', () => {
    const base = buildRoomSeatProfile({ displayName: 'Ada', avatarUrl: 'https://example.test/a' });

    const merged = mergeRoomSeatProfile(base, { avatarUrl: undefined });

    expect(merged.avatarUrl).toBeUndefined();
    expect(JSON.stringify(merged)).toBe('{"displayName":"Ada"}');
  });
});
