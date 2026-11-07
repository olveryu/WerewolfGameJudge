/**
 * The document as plain data: every block is already JSON except an image's
 * loader, which is identified by its `assetId`. Export cache scopes and the
 * cross-game contract compare documents through this one projection.
 */

import type { ReviewBlock, RoomReviewDocument, RoomReviewPage } from './types';

type SerializedBlock =
  | Exclude<ReviewBlock, { readonly kind: 'image' }>
  | {
      readonly kind: 'image';
      readonly assetId: string;
      readonly caption: string;
      readonly aspectRatio: number;
    };

interface SerializedPage extends Omit<RoomReviewPage, 'blocks'> {
  readonly blocks: readonly SerializedBlock[];
}

export interface SerializedReviewDocument extends Omit<RoomReviewDocument, 'pages'> {
  readonly pages: readonly SerializedPage[];
}

function serializeBlock(block: ReviewBlock): SerializedBlock {
  if (block.kind !== 'image') return block;
  return {
    kind: 'image',
    assetId: block.assetId,
    caption: block.caption,
    aspectRatio: block.aspectRatio,
  };
}

export function serializeReviewDocument(document: RoomReviewDocument): SerializedReviewDocument {
  return {
    ...document,
    pages: document.pages.map((page) => ({ ...page, blocks: page.blocks.map(serializeBlock) })),
  };
}
