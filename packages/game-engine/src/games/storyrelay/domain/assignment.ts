/** Pure Story Relay assignment; preserves one task per seat and one visit per story. */

import { createSeededRng, shuffleArray } from '../../../platform/random';
import { STORY_RELAY_MAX_PLAYERS, STORY_RELAY_MIN_PLAYERS } from '../state/types';

/** Creates the persisted player permutation and Williams relay offsets for one round. */
export function createStoryRelayAssignment(numberOfPlayers: number, randomSeed: string) {
  if (
    !Number.isSafeInteger(numberOfPlayers) ||
    numberOfPlayers < STORY_RELAY_MIN_PLAYERS ||
    numberOfPlayers > STORY_RELAY_MAX_PLAYERS
  ) {
    throw new Error('Story Relay requires 4 to 20 players');
  }
  const seatOrder = shuffleArray(
    Array.from({ length: numberOfPlayers }, (_, seat) => seat),
    createSeededRng(`${randomSeed}:storyrelay`),
  );
  const stepOffsets = Array.from({ length: numberOfPlayers }, (_, stepIndex) =>
    stepIndex % 2 === 1 ? (stepIndex + 1) / 2 : (numberOfPlayers - stepIndex / 2) % numberOfPlayers,
  );
  return { seatOrder, stepOffsets };
}
