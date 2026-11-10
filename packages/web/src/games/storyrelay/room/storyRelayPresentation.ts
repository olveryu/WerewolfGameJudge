/** Story Relay presentation projections; writing views never receive whole-story history. */

import {
  type StoryRelayChain,
  type StoryRelayState,
} from '@game-judge/game-engine/games/storyrelay/public';

/** A blank hand-off, as the gallery and the review print it. */
export const STORY_RELAY_BLANK_ENTRY_TEXT = '（空白）';

/** A story nobody handed anything into yet (a round aborted before its first hand-in). */
export const STORY_RELAY_EMPTY_STORY_TEXT = '这篇故事尚未收录稿件';

/** Reveals only the monotonic server-authorized prefix, or the complete terminal fragments. */
export function getStoryRelayVisibleStories(state: StoryRelayState): readonly StoryRelayChain[] {
  if (state.phase === 'ended' || state.phase === 'aborted') return state.chains;
  if (state.phase !== 'gallery' || state.gallery === null) return [];
  const revealedPosition = state.gallery.revealedPosition;
  return state.chains.map((chain, chainIndex) => ({
    ...chain,
    entries: chain.entries.filter(
      (_, stepIndex) => chainIndex * state.config.numberOfPlayers + stepIndex <= revealedPosition,
    ),
  }));
}

/** The author name the round's participant snapshot recorded for a seat. */
export function getStoryRelayAuthorName(state: StoryRelayState, seat: number): string {
  const participant = state.participants.find((author) => author.seat === seat);
  if (participant === undefined) {
    throw new Error(`[FAIL-FAST] Story Relay author snapshot missing for seat ${seat}`);
  }
  return participant.displayName;
}
