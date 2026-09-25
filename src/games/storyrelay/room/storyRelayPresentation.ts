/** Story Relay presentation projections; writing views never receive whole-story history. */

import {
  type StoryRelayChain,
  type StoryRelayState,
} from '@game-judge/game-engine/games/storyrelay/public';

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

/** Formats an already-authorized story projection for its printable image. */
export function formatStoryRelayStory(
  state: StoryRelayState,
  chain: StoryRelayChain,
  chainIndex: number,
): string {
  if (state.startedAt === null) throw new Error('Story Relay start time missing');
  const title = `故事 ${chainIndex + 1}${state.phase === 'aborted' ? '（未完成，房主中止）' : ''}`;
  return [
    title,
    `开局时间：${new Date(state.startedAt).toISOString()}`,
    ...chain.entries.map((entry, stepIndex) => {
      const participant = state.participants.find((author) => author.seat === entry.authorSeat);
      if (participant === undefined) throw new Error('Story Relay author snapshot missing');
      const text = entry.kind === 'text' ? entry.text : '（空白）';
      return `${stepIndex + 1}. ${participant.displayName}\n${text}`;
    }),
  ].join('\n\n');
}
