/**
 * The Story Relay review document, built from rounds played through the
 * real engine: one page per story in the round's story order (numbered
 * parts when a story runs long), each hand-off a passage labelled with
 * its leg and author.
 */

import type {
  StoryRelayChain,
  StoryRelayState,
} from '@game-judge/game-engine/games/storyrelay/public';

import { assertReviewDocument } from '@/features/room/review/assertReviewDocument';
import type { ReviewBlock } from '@/features/room/review/types';
import {
  buildStoryRelayTestState,
  playStoryRelayTestRound,
  STORY_RELAY_TEST_PLAYER_NAMES,
  storyRelayTestText,
} from '@/test-utils/storyrelayState';

import { storyRelayStoryPageKey, toStoryRelayReviewDocument } from '../toStoryRelayReviewDocument';

function build(state: StoryRelayState) {
  return toStoryRelayReviewDocument({ state, roomCode: 'ABCD' });
}

function nameOf(seat: number): string {
  const name = STORY_RELAY_TEST_PLAYER_NAMES[seat];
  if (name === undefined) throw new Error(`no test player at seat ${seat}`);
  return name;
}

/** The blocks a story prints as, per the document's rules. */
function expectedStory(chain: StoryRelayChain): readonly ReviewBlock[] {
  return chain.entries.map((entry, index): ReviewBlock => {
    const caption = `第 ${index + 1} 棒 · ${nameOf(entry.authorSeat)}`;
    return entry.kind === 'text'
      ? {
          kind: 'paragraph',
          caption,
          text: storyRelayTestText(index, entry.authorSeat),
          isMissing: false,
        }
      : { kind: 'paragraph', caption, text: '（空白）', isMissing: true };
  });
}

describe('toStoryRelayReviewDocument', () => {
  const ended = playStoryRelayTestRound();

  it('describes the round in the shared masthead', () => {
    const document = build(ended);
    expect(() => assertReviewDocument(document)).not.toThrow();
    expect(document).toMatchObject({
      roundKey: 'round-1',
      kicker: '📖 第 1 轮 · 故事',
      fileStem: 'storyrelay-ABCD-1',
      footer: '本局复盘由对局记录自动生成',
      isAborted: false,
    });
  });

  it('gives every story one labelled page, in the round story order', () => {
    const document = build(ended);
    expect(document.pages.map((page) => page.key)).toEqual(ended.chains.map((chain) => chain.id));
    expect(document.pages.map((page) => page.key)).toEqual(
      ended.chains.map(storyRelayStoryPageKey),
    );
    expect(document.pages.map((page) => page.label)).toEqual([
      '第 1 篇故事',
      '第 2 篇故事',
      '第 3 篇故事',
      '第 4 篇故事',
    ]);
  });

  it('prints each hand-off as its passage labelled with its leg and author', () => {
    const document = build(ended);
    ended.chains.forEach((chain, storyIndex) => {
      expect(chain.entries).toHaveLength(4);
      expect(document.pages[storyIndex]?.blocks).toEqual(expectedStory(chain));
    });
  });

  it('prints a blank hand-off as the blank copy', () => {
    const state = playStoryRelayTestRound({ blankSeats: [[], [2], [], [0, 3]] });
    const document = build(state);
    const blankCaptions = document.pages.flatMap((page) =>
      page.blocks.flatMap((block) =>
        block.kind === 'paragraph' && block.isMissing ? [block.caption] : [],
      ),
    );
    expect(blankCaptions.sort()).toEqual(
      [`第 2 棒 · ${nameOf(2)}`, `第 4 棒 · ${nameOf(0)}`, `第 4 棒 · ${nameOf(3)}`].sort(),
    );
    state.chains.forEach((chain, storyIndex) => {
      expect(document.pages[storyIndex]?.blocks).toEqual(expectedStory(chain));
    });
  });

  it('marks an aborted round and keeps only the passages handed in', () => {
    const state = playStoryRelayTestRound({ abortAtStep: 2 });
    const document = build(state);
    expect(document.isAborted).toBe(true);
    state.chains.forEach((chain, storyIndex) => {
      expect(chain.entries).toHaveLength(2);
      expect(document.pages[storyIndex]?.blocks).toEqual(expectedStory(chain));
    });
  });

  it('prints a story that received nothing as one missing paragraph', () => {
    const document = build(playStoryRelayTestRound({ abortAtStep: 0 }));
    expect(() => assertReviewDocument(document)).not.toThrow();
    for (const page of document.pages) {
      expect(page.blocks).toEqual([
        { kind: 'paragraph', caption: null, text: '这篇故事尚未收录稿件', isMissing: true },
      ]);
    }
  });

  it('continues a story too long for one image on numbered parts, opening on the first', () => {
    const [first, ...rest] = ended.chains;
    if (first === undefined) throw new Error('expected a story');
    const passages = first.entries.filter((entry) => entry.kind === 'text');
    const long: StoryRelayChain = {
      ...first,
      entries: Array.from({ length: 8 }, (_, index) => {
        const entry = passages[index % passages.length];
        if (entry === undefined) throw new Error('expected a passage');
        return { ...entry, text: '字'.repeat(512) };
      }),
    };
    const document = build({ ...ended, chains: [long, ...rest] });

    expect(() => assertReviewDocument(document)).not.toThrow();
    expect(document.pages.slice(0, 2).map((page) => [page.key, page.label])).toEqual([
      [storyRelayStoryPageKey(first), '第 1 篇故事（1/2）'],
      [`${storyRelayStoryPageKey(first)}:part-2`, '第 1 篇故事（2/2）'],
    ]);
    expect(document.pages.slice(0, 2).flatMap((page) => page.blocks)).toHaveLength(8);
    expect(document.pages[2]?.label).toBe('第 2 篇故事');
  });

  it('builds structurally equal documents from the same state', () => {
    expect(build(ended)).toEqual(build(ended));
  });

  it('fails fast outside a finished round', () => {
    expect(() => build(buildStoryRelayTestState())).toThrow(
      '[FAIL-FAST] Story Relay review built during lobby',
    );
  });
});
