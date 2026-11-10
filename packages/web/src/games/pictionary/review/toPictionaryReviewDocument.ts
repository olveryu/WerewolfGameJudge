/**
 * The Pictionary review document: one page per album, in the round's
 * album order — an album too long for one image continues on numbered
 * parts. Every leg is labelled with its number and author, as the relay
 * ran: the starting word and each guess as a paragraph, a drawing as an
 * image, a missed leg as the game's blank-leg copy. An album that
 * received nothing (a round aborted before its first hand-in) is one
 * missing paragraph.
 *
 * Every fact comes from the round's chains and its participant snapshot.
 * The builder is pure: a drawing loads through the injected loader when a
 * surface shows it.
 */

import type {
  PictionaryChain,
  PictionaryDrawingEntry,
  PictionaryEntry,
  PictionaryState,
} from '@game-judge/game-engine/games/pictionary/public';

import {
  paginateReviewUnit,
  type ReviewFlowBlock,
  type ReviewFlowGroup,
} from '@/features/room/review/paginateReviewFlow';
import { REVIEW_GENERATED_FOOTER } from '@/features/room/review/reviewCopy';
import type { ReviewImageLoadResult, RoomReviewDocument } from '@/features/room/review/types';
import {
  getPictionarySeatDisplayName,
  PICTIONARY_MISSED_ENTRY_TEXT,
} from '@/games/pictionary/model/pictionarySelectors';

const EMPTY_ALBUM_TEXT = '本册尚无已提交作品';

/** Loads one drawing of the reviewed round by its entry id. */
export type PictionaryDrawingLoader = (
  entryId: string,
  signal: AbortSignal,
) => Promise<ReviewImageLoadResult>;

/** The review page key of one album: its chain id, stable for the round. */
export function pictionaryAlbumPageKey(chain: PictionaryChain): string {
  return chain.id;
}

function legCaption(state: PictionaryState, entry: PictionaryEntry, leg: number): string {
  return `第 ${leg} 棒 · ${getPictionarySeatDisplayName(state, entry.authorSeat)}`;
}

function drawingBlock(
  state: PictionaryState,
  entry: PictionaryDrawingEntry,
  leg: number,
  loadDrawing: PictionaryDrawingLoader,
): ReviewFlowBlock {
  const entryId = entry.id;
  return {
    kind: 'image',
    assetId: entryId,
    caption: legCaption(state, entry, leg),
    aspectRatio: entry.media.width / entry.media.height,
    load: (signal) => loadDrawing(entryId, signal),
  };
}

/** One leg: the starting word or a guess, a drawing, or the blank leg. */
function legBlock(
  state: PictionaryState,
  entry: PictionaryEntry,
  leg: number,
  loadDrawing: PictionaryDrawingLoader,
): ReviewFlowBlock {
  switch (entry.kind) {
    case 'drawing':
      if (leg === 1) throw new Error(`[FAIL-FAST] Pictionary album opens with drawing ${entry.id}`);
      return drawingBlock(state, entry, leg, loadDrawing);
    case 'text':
      return {
        kind: 'paragraph',
        caption: legCaption(state, entry, leg),
        text: entry.text,
        isMissing: false,
      };
    case 'missed':
      return {
        kind: 'paragraph',
        caption: legCaption(state, entry, leg),
        text: PICTIONARY_MISSED_ENTRY_TEXT,
        isMissing: true,
      };
  }
}

/** One group per leg: a drawing or a guess never leaves its label. */
function albumGroups(
  state: PictionaryState,
  chain: PictionaryChain,
  loadDrawing: PictionaryDrawingLoader,
): readonly ReviewFlowGroup[] {
  if (chain.entries.length === 0) {
    return [[{ kind: 'paragraph', caption: null, text: EMPTY_ALBUM_TEXT, isMissing: true }]];
  }
  return chain.entries.map((entry, index) => [legBlock(state, entry, index + 1, loadDrawing)]);
}

/** Builds the review of an ended or aborted Pictionary round. */
export function toPictionaryReviewDocument(input: {
  readonly state: PictionaryState;
  readonly roomCode: string;
  readonly loadDrawing: PictionaryDrawingLoader;
}): RoomReviewDocument {
  const { state, roomCode, loadDrawing } = input;
  if (state.phase !== 'ended' && state.phase !== 'aborted') {
    throw new Error(`[FAIL-FAST] Pictionary review built during ${state.phase}`);
  }
  return {
    roundKey: `round-${state.roundNumber}`,
    kicker: `🖼️ 第 ${state.roundNumber} 轮 · 画册`,
    fileStem: `pictionary-${roomCode}-${state.roundNumber}`,
    footer: REVIEW_GENERATED_FOOTER,
    isAborted: state.phase === 'aborted',
    pages: state.chains.flatMap((chain, albumIndex) =>
      paginateReviewUnit({
        key: pictionaryAlbumPageKey(chain),
        label: `第 ${albumIndex + 1} 篇 · ${getPictionarySeatDisplayName(state, chain.originSeat)} 的画册`,
        groups: albumGroups(state, chain, loadDrawing),
      }),
    ),
  };
}
