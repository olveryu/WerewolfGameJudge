/** Ordinal-list codec and candidate picking: the pure core of the shared word draw. */

import { createSeededRng } from '@game-judge/game-engine/platform/random';
import { describe, expect, it } from 'vitest';

import { decodeDrawMembers, decodeSeenOrdinals, pickDrawOrdinals } from '../wordDrawSets';

const NOTHING_EXCLUDED: ReadonlySet<number> = new Set();

describe('decodeDrawMembers', () => {
  it('decodes an empty and a populated list', () => {
    expect(decodeDrawMembers(',')).toEqual([]);
    expect(decodeDrawMembers(',3,17,42,')).toEqual([3, 17, 42]);
  });

  it('drops duplicate ordinals', () => {
    expect(decodeDrawMembers(',3,17,3,')).toEqual([3, 17]);
  });

  it.each(['3,17,', ',3,17', '', ',3,x,', ',1-5,', ',0,', ',-4,'])(
    'rejects the corrupt list %j',
    (encoded) => {
      expect(() => decodeDrawMembers(encoded)).toThrow('[FAIL-FAST]');
    },
  );
});

describe('decodeSeenOrdinals', () => {
  it('decodes single ordinals and inclusive ranges', () => {
    const seen = decodeSeenOrdinals(',1-250,263,301,');
    expect([...seen.singles]).toEqual([263, 301]);
    expect(seen.ranges).toEqual([[1, 250]]);
  });

  it.each([',5-1,', ',1-,', ',a-b,', '1-5', ',0-3,'])('rejects the corrupt list %j', (encoded) => {
    expect(() => decodeSeenOrdinals(encoded)).toThrow('[FAIL-FAST]');
  });
});

describe('pickDrawOrdinals', () => {
  const members = [1, 2, 3, 4, 5, 6, 7, 8];

  it('never picks a word any participant has seen under excludeSeen', () => {
    const picked = pickDrawOrdinals({
      members,
      seenByParticipant: [decodeSeenOrdinals(',1-3,'), decodeSeenOrdinals(',5,7,')],
      excluded: NOTHING_EXCLUDED,
      count: 8,
      seenPolicy: 'excludeSeen',
      rng: createSeededRng('exclude-seen'),
    });
    expect([...picked].sort()).toEqual([4, 6, 8]);
  });

  it('skips excluded ordinals and returns nothing when none remain', () => {
    const picked = pickDrawOrdinals({
      members: [1, 2],
      seenByParticipant: [],
      excluded: new Set([1, 2]),
      count: 1,
      seenPolicy: 'preferUnseen',
      rng: createSeededRng('excluded'),
    });
    expect(picked).toEqual([]);
  });

  it('fills with seen words only after unseen ones run out under preferUnseen', () => {
    const picked = pickDrawOrdinals({
      members,
      seenByParticipant: [decodeSeenOrdinals(',1-6,')],
      excluded: NOTHING_EXCLUDED,
      count: 4,
      seenPolicy: 'preferUnseen',
      rng: createSeededRng('prefer-unseen'),
    });
    expect(picked).toHaveLength(4);
    expect([...picked.slice(0, 2)].sort()).toEqual([7, 8]);
    expect(picked.slice(2).every((ordinal) => ordinal >= 1 && ordinal <= 6)).toBe(true);
    expect(new Set(picked).size).toBe(4);
  });

  it('is deterministic for a seed and spreads picks across the pool', () => {
    const pickWith = (seed: string) =>
      pickDrawOrdinals({
        members,
        seenByParticipant: [],
        excluded: NOTHING_EXCLUDED,
        count: 1,
        seenPolicy: 'excludeSeen',
        rng: createSeededRng(seed),
      })[0];
    expect(pickWith('seed-a')).toBe(pickWith('seed-a'));
    const firstPicks = new Set(
      Array.from({ length: 200 }, (_, index) => pickWith(`spread-${index}`)),
    );
    expect(firstPicks.size).toBe(members.length);
  });

  it('does not mutate the members it is given', () => {
    const frozen = Object.freeze([...members]);
    pickDrawOrdinals({
      members: frozen,
      seenByParticipant: [],
      excluded: NOTHING_EXCLUDED,
      count: 3,
      seenPolicy: 'excludeSeen',
      rng: createSeededRng('immutable'),
    });
    expect(frozen).toEqual(members);
  });
});
