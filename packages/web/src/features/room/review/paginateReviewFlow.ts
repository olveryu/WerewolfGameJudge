/**
 * Splits long flowing content — relay legs, story passages — into pages
 * that print inside every export limit without breaking what belongs
 * together.
 *
 * The platform owns layout, so it owns the estimate, from the renderer's
 * own tokens and always on the side that prints taller: text on the
 * narrowest supported page, where it wraps the most (every glyph a full em
 * wide), drawings on the widest page, where they scale up the most. A game
 * only declares what must stay together (a leg's label with its content);
 * this packs those groups into pages in order. The budget keeps a captured
 * page inside mobile WebKit's canvas area (about 16.7 megapixels) at 3×
 * density on the widest phone, well below the export's hard cap.
 */

import { resolveRoomDialogWidth } from '@/features/room/components/roomDialogSize';

import type { ReviewBlock, RoomReviewPage } from './types';

/** The blocks a flow may hold: the ones whose height follows from their content alone. */
export type ReviewFlowBlock = Extract<
  ReviewBlock,
  { readonly kind: 'section' | 'divider' | 'paragraph' | 'image' }
>;

/** Blocks that must print on the same page. */
export type ReviewFlowGroup = readonly ReviewFlowBlock[];

/** The narrowest viewport the app supports (the small-mobile layout). */
const NARROWEST_WINDOW_WIDTH = 320;

/** Estimated block height one page may hold. */
export const REVIEW_PAGE_FLOW_BUDGET = 4000;

/**
 * The review renderer's tokens (`theme/tokens.css`, applied in `review.css`):
 * `.review-body` gaps and padding, `.review-caption`, `.review-paragraph`,
 * `.review-divider`.
 */
const SPACE_TIGHT = 4;
const SPACE_SMALL = 8;
const SPACE_MEDIUM = 16;
const SPACE_LARGE = 24;
const BORDER_WIDTH_THICK = 2;
const FONT_CAPTION = 12;
const LINE_CAPTION = 16;
const FONT_BODY = 16;
const LINE_BODY = 24;

const PAGE_PADDING = SPACE_LARGE * 2;
const TEXT_WIDTH = resolveRoomDialogWidth(NARROWEST_WINDOW_WIDTH) - PAGE_PADDING;
const IMAGE_WIDTH = resolveRoomDialogWidth(Number.POSITIVE_INFINITY) - PAGE_PADDING;

function lineCount(text: string, fontSize: number): number {
  const glyphsPerLine = Math.max(1, Math.floor(TEXT_WIDTH / fontSize));
  return text
    .split('\n')
    .reduce(
      (lines, line) => lines + Math.max(1, Math.ceil(Array.from(line).length / glyphsPerLine)),
      0,
    );
}

function captionHeight(caption: string | null): number {
  if (caption === null) return 0;
  return lineCount(caption, FONT_CAPTION) * LINE_CAPTION + SPACE_TIGHT;
}

/** A flow block's printed height on the page where it prints tallest, from the renderer's tokens. */
export function estimateFlowBlockHeight(block: ReviewFlowBlock): number {
  switch (block.kind) {
    case 'section':
      return lineCount(block.title, FONT_CAPTION) * LINE_CAPTION;
    case 'divider':
      return BORDER_WIDTH_THICK + SPACE_SMALL;
    case 'paragraph':
      return captionHeight(block.caption) + lineCount(block.text, FONT_BODY) * LINE_BODY;
    case 'image':
      return captionHeight(block.caption) + IMAGE_WIDTH / block.aspectRatio;
  }
}

function groupHeight(group: ReviewFlowGroup): number {
  return group.reduce(
    (height, block, index) =>
      height + (index === 0 ? 0 : SPACE_MEDIUM) + estimateFlowBlockHeight(block),
    0,
  );
}

/**
 * Packs groups into page bodies, in order. A group never splits; a group
 * taller than the budget takes a page of its own (the export's hard cap
 * still guards it).
 */
export function paginateReviewFlow(
  groups: readonly ReviewFlowGroup[],
): readonly (readonly ReviewFlowBlock[])[] {
  if (groups.length === 0) throw new Error('[FAIL-FAST] A review flow needs at least one group');
  const pages: ReviewFlowBlock[][] = [];
  let page: ReviewFlowBlock[] = [];
  let height = 0;
  for (const group of groups) {
    if (group.length === 0) throw new Error('[FAIL-FAST] A review flow group needs a block');
    const added = (page.length === 0 ? 0 : SPACE_MEDIUM) + groupHeight(group);
    if (page.length > 0 && height + added > REVIEW_PAGE_FLOW_BUDGET) {
      pages.push(page);
      page = [...group];
      height = groupHeight(group);
      continue;
    }
    page.push(...group);
    height += added;
  }
  pages.push(page);
  return pages;
}

/**
 * The pages of one unit of meaning (an album, a story): a single page under
 * the unit's key and label, or numbered parts when it runs long. The first
 * part keeps the unit's key, so opening the unit lands on its beginning.
 */
export function paginateReviewUnit(unit: {
  readonly key: string;
  readonly label: string;
  readonly groups: readonly ReviewFlowGroup[];
}): readonly RoomReviewPage[] {
  const bodies = paginateReviewFlow(unit.groups);
  return bodies.map((blocks, index) => ({
    key: index === 0 ? unit.key : `${unit.key}:part-${index + 1}`,
    label: bodies.length === 1 ? unit.label : `${unit.label}（${index + 1}/${bodies.length}）`,
    blocks,
  }));
}
