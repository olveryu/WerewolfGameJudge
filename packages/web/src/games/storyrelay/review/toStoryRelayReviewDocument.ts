/**
 * The Story Relay review document: one page per story, in the round's
 * story order — a story too long for one image continues on numbered
 * parts. Each hand-off is a paragraph of its passage, labelled with its
 * leg and author, original line breaks kept; a blank hand-off prints the
 * game's blank copy. A story that received nothing (a round aborted
 * before its first hand-in) is one missing paragraph.
 *
 * Every fact comes from the stories the room may read
 * (`getStoryRelayVisibleStories`, the whole round once it ended or was
 * aborted) and the round's participant snapshot.
 */

import type {
  StoryRelayChain,
  StoryRelayState,
} from '@game-judge/game-engine/games/storyrelay/public';

import {
  paginateReviewUnit,
  type ReviewFlowGroup,
} from '@/features/room/review/paginateReviewFlow';
import { REVIEW_GENERATED_FOOTER } from '@/features/room/review/reviewCopy';
import type { RoomReviewDocument } from '@/features/room/review/types';

import {
  getStoryRelayAuthorName,
  getStoryRelayVisibleStories,
  STORY_RELAY_BLANK_ENTRY_TEXT,
  STORY_RELAY_EMPTY_STORY_TEXT,
} from '../room/storyRelayPresentation';

/** The review page key of one story: its chain id, stable for the round. */
export function storyRelayStoryPageKey(chain: StoryRelayChain): string {
  return chain.id;
}

/** One group per hand-off: a passage never leaves its leg label. */
function storyGroups(state: StoryRelayState, chain: StoryRelayChain): readonly ReviewFlowGroup[] {
  if (chain.entries.length === 0) {
    return [
      [{ kind: 'paragraph', caption: null, text: STORY_RELAY_EMPTY_STORY_TEXT, isMissing: true }],
    ];
  }
  return chain.entries.map((entry, index): ReviewFlowGroup => {
    const caption = `第 ${index + 1} 棒 · ${getStoryRelayAuthorName(state, entry.authorSeat)}`;
    return [
      entry.kind === 'text'
        ? { kind: 'paragraph', caption, text: entry.text, isMissing: false }
        : { kind: 'paragraph', caption, text: STORY_RELAY_BLANK_ENTRY_TEXT, isMissing: true },
    ];
  });
}

/** Builds the review of an ended or aborted Story Relay round. */
export function toStoryRelayReviewDocument(input: {
  readonly state: StoryRelayState;
  readonly roomCode: string;
}): RoomReviewDocument {
  const { state, roomCode } = input;
  if (state.phase !== 'ended' && state.phase !== 'aborted') {
    throw new Error(`[FAIL-FAST] Story Relay review built during ${state.phase}`);
  }
  return {
    roundKey: `round-${state.roundNumber}`,
    kicker: `📖 第 ${state.roundNumber} 轮 · 故事`,
    fileStem: `storyrelay-${roomCode}-${state.roundNumber}`,
    footer: REVIEW_GENERATED_FOOTER,
    isAborted: state.phase === 'aborted',
    pages: getStoryRelayVisibleStories(state).flatMap((chain, storyIndex) =>
      paginateReviewUnit({
        key: storyRelayStoryPageKey(chain),
        label: `第 ${storyIndex + 1} 篇故事`,
        groups: storyGroups(state, chain),
      }),
    ),
  };
}
