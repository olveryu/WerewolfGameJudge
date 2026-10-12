/**
 * Story Relay viewer projections: what one seat may see of the
 * relay. The task projection is the privacy boundary of the game:
 * it exposes only the immediately previous entry of the seat's
 * current chain, never the story's earlier entries.
 */

import type { StoryRelayState, StoryRelayTask } from '../state/types';

/** Resolves a seat's current task without exposing the story's earlier entries. */
export function getStoryRelayTaskForSeat(
  state: StoryRelayState,
  seat: number,
): StoryRelayTask | null {
  if (state.roundId === null || !['answering', 'settling', 'transition'].includes(state.phase))
    return null;
  const seatIndex = state.seatOrder.indexOf(seat);
  if (seatIndex < 0) return null;
  const offset = state.stepOffsets[state.stepIndex];
  if (offset === undefined) throw new Error('Story Relay task offset missing');
  const chain =
    state.chains[
      (seatIndex - offset + state.config.numberOfPlayers) % state.config.numberOfPlayers
    ];
  if (chain === undefined) throw new Error('Story Relay task chain missing');
  const previousEntry = state.stepIndex === 0 ? null : chain.entries[state.stepIndex - 1];
  if (previousEntry === undefined) throw new Error('Story Relay previous entry missing');
  return {
    roundId: state.roundId,
    stepIndex: state.stepIndex,
    chainId: chain.id,
    authorSeat: seat,
    previousEntry:
      previousEntry === null
        ? null
        : previousEntry.kind === 'text'
          ? { kind: 'text', text: previousEntry.text }
          : { kind: previousEntry.kind },
    isSubmitted: chain.entries.length > state.stepIndex,
  };
}
