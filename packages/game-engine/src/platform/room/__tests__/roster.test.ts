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

import {
  buildRoomSeatProfile,
  mergeRoomSeatProfile,
  parseRoomHumanSeat,
  parseRoomRoster,
  parseRoomSeatProfile,
} from '../roster';

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

describe('parseRoomSeatProfile', () => {
  it('decodes every profile field without mutating input and preserves canonical wire order', () => {
    const raw = Object.freeze({
      level: 7,
      revealEffect: 'confetti',
      nameStyle: 'gold',
      seatAnimation: 'wave',
      seatFlair: 'star',
      avatarFrame: 'oak',
      avatarUrl: 'https://example.test/avatar.png',
      displayName: 'Ada',
    });
    const profile = parseRoomSeatProfile(raw, 'state.roster.0.profile');

    expect(profile).toEqual(raw);
    expect(Object.keys(profile)).toEqual(CANONICAL_KEYS);
    expect(JSON.stringify(profile)).toBe(
      '{"displayName":"Ada","avatarUrl":"https://example.test/avatar.png","avatarFrame":"oak","seatFlair":"star","seatAnimation":"wave","nameStyle":"gold","revealEffect":"confetti","level":7}',
    );
    expect(Object.keys(parseRoomSeatProfile({ displayName: 'Ada' }, 'profile'))).toEqual(
      CANONICAL_KEYS,
    );
    expect(JSON.stringify(parseRoomSeatProfile({ displayName: 'Ada' }, 'profile'))).toBe(
      '{"displayName":"Ada"}',
    );
  });

  it.each([
    [null, 'state.roster.0.profile must be an object'],
    [{ displayName: '' }, 'state.roster.0.profile.displayName must be a non-empty string'],
    [{ displayName: 'Ada', avatarUrl: null }, 'state.roster.0.profile.avatarUrl must be a string'],
    [{ displayName: 'Ada', level: 1.5 }, 'state.roster.0.profile.level must be a safe integer'],
    [{ displayName: 'Ada', extra: true }, 'state.roster.0.profile contains unknown field: extra'],
  ])('rejects malformed input %j with the original field path', (value, message) => {
    expect(() => parseRoomSeatProfile(value, 'state.roster.0.profile')).toThrow(message);
  });
});

describe('parseRoomRoster', () => {
  it('round-trips sparse human and bot slots in canonical wire order', () => {
    const roster = parseRoomRoster(
      {
        3: { kind: 'bot', seat: 3 },
        0: { profile: { level: 2, displayName: 'Ada' }, userId: 'host', seat: 0 },
      },
      'state.roster',
    );

    expect(JSON.stringify(roster)).toBe(
      '{"0":{"seat":0,"userId":"host","profile":{"displayName":"Ada","level":2}},"3":{"seat":3,"kind":"bot"}}',
    );
    expect(parseRoomRoster({}, 'state.roster')).toEqual({});
    expect(parseRoomRoster(JSON.parse(JSON.stringify(roster)), 'state.roster')).toEqual(roster);
  });

  it.each(['01', '-1', '1.0', '1e0', ' ', '9007199254740992'])(
    'rejects invalid seat key %j',
    (key) => {
      expect(() => parseRoomRoster({ [key]: { seat: 0, kind: 'bot' } }, 'state.roster')).toThrow(
        `state.roster.${key} must be`,
      );
    },
  );

  it.each([
    [null, 'must be an object'],
    [{ seat: 0, kind: 'bot', userId: 'host' }, 'contains unknown field: userId'],
    [{ seat: 0, userId: '' }, '.userId must be a non-empty string'],
    [
      { seat: 0, userId: 'host', profile: { displayName: 'Ada' }, kind: 'human' },
      'contains unknown field: kind',
    ],
  ])('rejects malformed occupant %j', (occupant, message) => {
    expect(() => parseRoomRoster({ 0: occupant }, 'state.roster')).toThrow(message);
  });

  it('rejects bots at the historical human-only decoding boundary', () => {
    expect(() =>
      parseRoomHumanSeat(
        { seat: 0, kind: 'bot', userId: 'host', profile: { displayName: 'Ada' } },
        'state.realSeats.0',
      ),
    ).toThrow('state.realSeats.0 contains unknown field: kind');
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
