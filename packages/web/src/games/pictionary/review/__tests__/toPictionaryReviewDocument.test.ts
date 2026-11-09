/**
 * The Pictionary review document, built from rounds played through the
 * real engine: one page per album in the round's album order (numbered
 * parts when an album runs long), opening on the starting word and
 * following the relay leg by leg, every leg labelled with its author.
 */

import {
  PICTIONARY_MAX_PLAYERS,
  PICTIONARY_TEXT_MAX_LENGTH,
  type PictionaryChain,
  type PictionaryEntry,
  type PictionaryState,
} from '@game-judge/game-engine/games/pictionary/public';

import { assertReviewDocument } from '@/features/room/review/assertReviewDocument';
import { serializeReviewDocument } from '@/features/room/review/serializeReviewDocument';
import type { ReviewImageLoadResult } from '@/features/room/review/types';
import {
  buildPictionaryTestState,
  PICTIONARY_TEST_PLAYER_NAMES,
  pictionaryTestText,
  playPictionaryTestRound,
} from '@/test-utils/pictionaryState';

import { pictionaryAlbumPageKey, toPictionaryReviewDocument } from '../toPictionaryReviewDocument';

const MISSED_LEG_TEXT = '这一棒交了空白';

const loadDrawing = vi.fn(
  async (entryId: string): Promise<ReviewImageLoadResult> => ({
    kind: 'loaded',
    dataUri: `data:image/png;base64,${entryId}`,
  }),
);

function build(state: PictionaryState) {
  return toPictionaryReviewDocument({ state, roomCode: 'ABCD', loadDrawing });
}

function nameOf(seat: number): string {
  const name = PICTIONARY_TEST_PLAYER_NAMES[seat];
  if (name === undefined) throw new Error(`no test player at seat ${seat}`);
  return name;
}

/** The plain-data block a leg prints as, per the document's rules. */
function expectedLeg(entry: PictionaryEntry, index: number) {
  const caption = `第 ${index + 1} 棒 · ${nameOf(entry.authorSeat)}`;
  switch (entry.kind) {
    case 'text':
      return {
        kind: 'paragraph',
        caption,
        text: pictionaryTestText(index, entry.authorSeat),
        isMissing: false,
      };
    case 'drawing':
      return { kind: 'image', assetId: entry.id, caption, aspectRatio: 4 / 3 };
    case 'missed':
      return { kind: 'paragraph', caption, text: MISSED_LEG_TEXT, isMissing: true };
  }
}

/** A full-size album: one leg per seat of the largest room, every guess at the length cap. */
function longestAlbum(template: PictionaryChain): PictionaryChain {
  const [prompt, drawing] = template.entries;
  if (prompt?.kind !== 'text' || drawing?.kind !== 'drawing') {
    throw new Error('expected an album opening on a prompt and a drawing');
  }
  return {
    ...template,
    entries: Array.from(
      { length: PICTIONARY_MAX_PLAYERS },
      (_, index): PictionaryEntry =>
        index % 2 === 0
          ? {
              ...prompt,
              id: `${prompt.id}:${index}`,
              text: '字'.repeat(PICTIONARY_TEXT_MAX_LENGTH),
            }
          : { ...drawing, id: `${drawing.id}:${index}` },
    ),
  };
}

describe('toPictionaryReviewDocument', () => {
  const ended = playPictionaryTestRound();

  beforeEach(() => {
    loadDrawing.mockClear();
  });

  it('describes the round in the shared masthead', () => {
    const document = build(ended);
    expect(() => assertReviewDocument(document)).not.toThrow();
    expect(document).toMatchObject({
      roundKey: 'round-1',
      kicker: '🖼️ 第 1 轮 · 画册',
      fileStem: 'pictionary-ABCD-1',
      footer: '本局复盘由对局记录自动生成',
      isAborted: false,
    });
  });

  it('gives every album one labelled page, in the round album order', () => {
    const document = build(ended);
    expect(document.pages.map((page) => page.key)).toEqual(ended.chains.map((chain) => chain.id));
    expect(document.pages.map((page) => page.key)).toEqual(
      ended.chains.map(pictionaryAlbumPageKey),
    );
    expect(document.pages.map((page) => page.label)).toEqual(
      ended.chains.map((chain, index) => `第 ${index + 1} 篇 · ${nameOf(chain.originSeat)} 的画册`),
    );
  });

  it('opens each album on its starting word, then follows the relay leg by leg', () => {
    const { pages } = serializeReviewDocument(build(ended));
    ended.chains.forEach((chain, chainIndex) => {
      expect(chain.entries.map((entry) => entry.kind)).toEqual([
        'text',
        'drawing',
        'text',
        'drawing',
      ]);
      expect(pages[chainIndex]?.blocks).toEqual(chain.entries.map(expectedLeg));
    });
    const originSeat = ended.chains[0]!.originSeat;
    expect(pages[0]?.blocks[0]).toEqual({
      kind: 'paragraph',
      caption: `第 1 棒 · ${nameOf(originSeat)}`,
      text: pictionaryTestText(0, originSeat),
      isMissing: false,
    });
  });

  it('loads a drawing through the injected loader', async () => {
    const image = build(ended)
      .pages.flatMap((page) => page.blocks)
      .find((block) => block.kind === 'image');
    if (image?.kind !== 'image') throw new Error('expected a drawing');
    const signal = new AbortController().signal;
    await expect(image.load(signal)).resolves.toEqual({
      kind: 'loaded',
      dataUri: `data:image/png;base64,${image.assetId}`,
    });
    expect(loadDrawing).toHaveBeenCalledWith(image.assetId, signal);
  });

  it('prints every missed leg — a prompt, a drawing, a guess — as the blank-leg copy', () => {
    const state = playPictionaryTestRound({ missedSeats: [[1], [2], [3]] });
    const { pages } = serializeReviewDocument(build(state));
    const missedLegs = state.chains.flatMap((chain) =>
      chain.entries.flatMap((entry, index) => (entry.kind === 'missed' ? [index] : [])),
    );
    expect(missedLegs.sort()).toEqual([0, 1, 2]);
    state.chains.forEach((chain, chainIndex) => {
      expect(pages[chainIndex]?.blocks).toEqual(chain.entries.map(expectedLeg));
    });
    const missedPrompt = state.chains.findIndex((chain) => chain.originSeat === 1);
    expect(pages[missedPrompt]?.blocks[0]).toEqual({
      kind: 'paragraph',
      caption: `第 1 棒 · ${nameOf(1)}`,
      text: MISSED_LEG_TEXT,
      isMissing: true,
    });
  });

  it('marks an aborted round and keeps only the legs handed in', () => {
    const state = playPictionaryTestRound({ abortAtStep: 2 });
    const document = build(state);
    expect(document.isAborted).toBe(true);
    const { pages } = serializeReviewDocument(document);
    state.chains.forEach((chain, chainIndex) => {
      expect(chain.entries).toHaveLength(2);
      expect(pages[chainIndex]?.blocks).toEqual(chain.entries.map(expectedLeg));
    });
  });

  it('prints an album that received nothing as one missing paragraph', () => {
    const document = build(playPictionaryTestRound({ abortAtStep: 0 }));
    expect(() => assertReviewDocument(document)).not.toThrow();
    for (const page of document.pages) {
      expect(page.blocks).toEqual([
        { kind: 'paragraph', caption: null, text: '本册尚无已提交作品', isMissing: true },
      ]);
    }
  });

  it('continues a full-size album on numbered parts, opening on the first, never splitting a leg', () => {
    const [first, ...rest] = ended.chains;
    if (first === undefined) throw new Error('expected an album');
    const album = longestAlbum(first);
    const document = build({ ...ended, chains: [album, ...rest] });
    expect(() => assertReviewDocument(document)).not.toThrow();

    const label = `第 1 篇 · ${nameOf(album.originSeat)} 的画册`;
    const parts = document.pages.filter((page) => page.label?.startsWith(label));
    expect(parts.length).toBeGreaterThan(1);
    expect(parts.map((page) => [page.key, page.label])).toEqual(
      parts.map((_, index) => [
        index === 0 ? pictionaryAlbumPageKey(album) : `${album.id}:part-${index + 1}`,
        `${label}（${index + 1}/${parts.length}）`,
      ]),
    );
    expect(parts.flatMap((page) => page.blocks.map((block) => block.kind))).toEqual(
      album.entries.map((entry) => (entry.kind === 'drawing' ? 'image' : 'paragraph')),
    );
    expect(document.pages[parts.length]?.key).toBe(pictionaryAlbumPageKey(rest[0]!));
  });

  it('builds structurally equal documents from the same state', () => {
    expect(serializeReviewDocument(build(ended))).toEqual(serializeReviewDocument(build(ended)));
  });

  it('fails fast outside a finished round', () => {
    expect(() => build(buildPictionaryTestState())).toThrow(
      '[FAIL-FAST] Pictionary review built during lobby',
    );
  });
});
