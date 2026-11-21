import type { CommandContext } from '../../engine';
import {
  REASON_CONTROLLED_SEAT_NOT_ALLOWED,
  REASON_GAME_IN_PROGRESS,
  REASON_REVIEW_IDENTITY_MISMATCH,
  REASON_REVIEW_NOT_ELIGIBLE,
  REASON_USER_ACTOR_REQUIRED,
} from '../../protocol/reasons';
import { resolveReviewCompletion } from '../reviewCompletion';

function userContext(controlledSeat: number | null = null): CommandContext {
  return {
    nowMs: 1,
    commandId: 'review',
    randomSeed: 'seed',
    actor: { kind: 'user', userId: 'player' },
    controlledSeat,
  };
}

const completeInput = {
  context: userContext(),
  isEnded: true,
  currentIdentity: 2,
  expectedIdentity: 2,
  completedUserIds: [],
  isEligible: () => true,
};

describe('resolveReviewCompletion', () => {
  it.each([
    [
      'system actor',
      () =>
        resolveReviewCompletion({
          ...completeInput,
          context: {
            ...userContext(),
            actor: { kind: 'system', effectId: 'settle' },
            controlledSeat: null,
          },
        }),
      REASON_USER_ACTOR_REQUIRED,
    ],
    [
      'controlled seat',
      () => resolveReviewCompletion({ ...completeInput, context: userContext(1) }),
      REASON_CONTROLLED_SEAT_NOT_ALLOWED,
    ],
    [
      'game in progress',
      () => resolveReviewCompletion({ ...completeInput, isEnded: false }),
      REASON_GAME_IN_PROGRESS,
    ],
    [
      'stale identity',
      () => resolveReviewCompletion({ ...completeInput, expectedIdentity: 1 }),
      REASON_REVIEW_IDENTITY_MISMATCH,
    ],
    [
      'ineligible user',
      () => resolveReviewCompletion({ ...completeInput, isEligible: () => false }),
      REASON_REVIEW_NOT_ELIGIBLE,
    ],
  ] as const)('returns the %s rejection reason', (_description, decide, reason) => {
    expect(decide()).toEqual({ kind: 'reject', reason });
  });

  it('distinguishes an already completed review from a new completion', () => {
    expect(resolveReviewCompletion({ ...completeInput, completedUserIds: ['player'] })).toEqual({
      kind: 'alreadyCompleted',
    });
    expect(resolveReviewCompletion(completeInput)).toEqual({
      kind: 'complete',
      userId: 'player',
    });
  });
});
