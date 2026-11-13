import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import {
  buildGameCompletionPayload,
  buildGameCompletionPayloadV2,
  gameCompletionPayloadV2Schema,
} from '../completionEffect';

const humans = [
  { seat: 0, userId: 'host' },
  { seat: 2, userId: 'u2' },
  { seat: 3, userId: 'u3' },
];

describe('buildGameCompletionPayload', () => {
  it('assembles the payload from the supplied humans in seat order', () => {
    expect(
      buildGameCompletionPayload({
        roundId: 'r1',
        completedAt: 42,
        humans,
        minimumHumanPlayers: 3,
      }),
    ).toEqual({
      roundId: 'r1',
      completedAt: 42,
      participantUserIds: ['host', 'u2', 'u3'],
    });
  });

  describe('versioned completion facts', () => {
    const schema = gameCompletionPayloadV2Schema(
      z.strictObject({ userId: z.string().min(1), gamesPlayed: z.literal(1) }),
    );
    const input = {
      roundId: 'r1',
      completedAt: 42,
      minimumHumanPlayers: 3,
      humans,
      includeSeat: (human: (typeof humans)[number]) => human.seat !== 2,
      stats: [
        { userId: 'host', gamesPlayed: 1 },
        { userId: 'u3', gamesPlayed: 1 },
      ],
    };

    it('keeps facts aligned with the authored reward roster after the minimum gate', () => {
      const payload = buildGameCompletionPayloadV2(input);
      expect(payload).toEqual({
        roundId: 'r1',
        completedAt: 42,
        participantUserIds: ['host', 'u3'],
        completionVersion: 2,
        stats: input.stats,
      });
      expect(schema.parse(payload)).toEqual(payload);
      expect(buildGameCompletionPayloadV2({ ...input, minimumHumanPlayers: 4 })).toBeNull();
    });

    it('rejects missing, duplicate, reordered and unrecognized facts rather than interpreting v2 as legacy', () => {
      const payload = buildGameCompletionPayloadV2(input);
      if (payload === null) throw new Error('Expected completion');
      for (const stats of [
        [],
        [input.stats[0], input.stats[0]],
        [...input.stats].reverse(),
        [{ userId: 'host', gamesPlayed: 2 }, input.stats[1]],
        [{ userId: 'host', gamesPlayed: 1, extra: true }, input.stats[1]],
      ]) {
        expect(schema.safeParse({ ...payload, stats }).success).toBe(false);
      }
      const { stats: _stats, ...missingStats } = payload;
      expect(schema.safeParse(missingStats).success).toBe(false);
      expect(() => buildGameCompletionPayloadV2({ ...input, stats: input.stats.slice(1) })).toThrow(
        'Completion stats users must match',
      );
    });
  });

  it('narrows the roster with the game authorship filter when one is given', () => {
    const payload = buildGameCompletionPayload({
      roundId: 'r1',
      completedAt: 42,
      humans,
      minimumHumanPlayers: 3,
      includeSeat: (seat) => seat.seat !== 2,
    });
    expect(payload?.participantUserIds).toEqual(['host', 'u3']);
  });

  it('checks the human minimum before applying an authorship filter', () => {
    expect(
      buildGameCompletionPayload({
        roundId: 'r1',
        completedAt: 42,
        humans,
        minimumHumanPlayers: 4,
        includeSeat: () => false,
      }),
    ).toBeNull();
  });
});
