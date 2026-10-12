import { describe, expect, it } from 'vitest';

import { buildGameCompletionPayload } from '../completionEffect';

const humans = [
  { seat: 0, userId: 'host' },
  { seat: 2, userId: 'u2' },
  { seat: 3, userId: 'u3' },
];

describe('buildGameCompletionPayload', () => {
  it('assembles the payload from the supplied humans in seat order', () => {
    expect(buildGameCompletionPayload({ roundId: 'r1', completedAt: 42, humans })).toEqual({
      roundId: 'r1',
      completedAt: 42,
      participantUserIds: ['host', 'u2', 'u3'],
    });
  });

  it('narrows the roster with the game authorship filter when one is given', () => {
    expect(
      buildGameCompletionPayload({
        roundId: 'r1',
        completedAt: 42,
        humans,
        includeSeat: (seat) => seat.seat !== 2,
      }).participantUserIds,
    ).toEqual(['host', 'u3']);
  });
});
