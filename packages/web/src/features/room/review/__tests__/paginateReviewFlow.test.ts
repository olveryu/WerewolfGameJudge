/** paginateReviewFlow: platform-owned height estimates and meaning-preserving page packing. */

import {
  estimateFlowBlockHeight,
  paginateReviewFlow,
  paginateReviewUnit,
  REVIEW_PAGE_FLOW_BUDGET,
  type ReviewFlowBlock,
  type ReviewFlowGroup,
} from '../paginateReviewFlow';
import { REVIEW_PAGE_MAX_HEIGHT } from '../reportTheme';

function leg(index: number, text: string): ReviewFlowGroup {
  return [
    {
      kind: 'paragraph',
      caption: `第 ${index + 1} 棒 · 玩家 ${index + 1}`,
      text,
      isMissing: false,
    },
  ];
}

function pageHeight(blocks: readonly ReviewFlowBlock[]): number {
  return blocks.reduce((sum, block) => sum + estimateFlowBlockHeight(block), 0);
}

describe('estimateFlowBlockHeight', () => {
  it('wraps text a full em per glyph on the narrowest page, keeping explicit line breaks', () => {
    // 320px window → 300.8px dialog → 252.8px content: 15 body glyphs a line.
    expect(
      estimateFlowBlockHeight({
        kind: 'paragraph',
        caption: null,
        text: '一'.repeat(15),
        isMissing: false,
      }),
    ).toBe(24);
    expect(
      estimateFlowBlockHeight({
        kind: 'paragraph',
        caption: null,
        text: '一'.repeat(16),
        isMissing: false,
      }),
    ).toBe(48);
    expect(
      estimateFlowBlockHeight({
        kind: 'paragraph',
        caption: null,
        text: '一\n二\n三',
        isMissing: false,
      }),
    ).toBe(72);
  });

  it('adds a caption line above captioned text and drawings, sizing drawings on the widest page', () => {
    expect(
      estimateFlowBlockHeight({
        kind: 'paragraph',
        caption: '第 1 棒 · 小明',
        text: '苹果',
        isMissing: false,
      }),
    ).toBe(16 + 4 + 24);
    expect(
      estimateFlowBlockHeight({
        kind: 'image',
        assetId: 'a',
        caption: '第 2 棒 · 小红',
        aspectRatio: 4 / 3,
        load: async () => ({ kind: 'unavailable', message: 'x' }),
      }),
    ).toBeCloseTo(16 + 4 + 392 * 0.75);
  });
});

describe('paginateReviewFlow', () => {
  it('keeps short content on one page', () => {
    const groups = [leg(0, '从前有座山'), leg(1, '山里有座庙')];
    expect(paginateReviewFlow(groups)).toEqual([[...groups[0]!, ...groups[1]!]]);
  });

  it('splits the longest possible relay into parts within the budget, in order, never breaking a group', () => {
    const groups = Array.from({ length: 20 }, (_, index) => leg(index, '字'.repeat(512)));
    const pages = paginateReviewFlow(groups);

    expect(pages.length).toBeGreaterThan(1);
    expect(pages.flat()).toEqual(groups.flat());
    for (const page of pages) {
      expect(pageHeight(page) + (page.length - 1) * 16).toBeLessThanOrEqual(
        REVIEW_PAGE_FLOW_BUDGET,
      );
    }
    expect(REVIEW_PAGE_FLOW_BUDGET).toBeLessThan(REVIEW_PAGE_MAX_HEIGHT);
  });

  it('gives a group taller than the budget a page of its own', () => {
    const tall: ReviewFlowGroup = [
      { kind: 'paragraph', caption: null, text: '字'.repeat(15 * 200), isMissing: false },
    ];
    const pages = paginateReviewFlow([leg(0, '开头'), tall, leg(2, '结尾')]);
    expect(pages).toEqual([[...leg(0, '开头')], [...tall], [...leg(2, '结尾')]]);
  });

  it('fails fast on an empty flow or an empty group', () => {
    expect(() => paginateReviewFlow([])).toThrow(
      '[FAIL-FAST] A review flow needs at least one group',
    );
    expect(() => paginateReviewFlow([[]])).toThrow('[FAIL-FAST] A review flow group needs a block');
  });
});

describe('paginateReviewUnit', () => {
  it('keeps a short unit as one page under its own key and label', () => {
    expect(
      paginateReviewUnit({ key: 'story-1', label: '第 1 篇故事', groups: [leg(0, '开头')] }),
    ).toEqual([{ key: 'story-1', label: '第 1 篇故事', blocks: [...leg(0, '开头')] }]);
  });

  it('numbers the parts of a long unit, the first keeping the unit key', () => {
    const groups = Array.from({ length: 20 }, (_, index) => leg(index, '字'.repeat(512)));
    const pages = paginateReviewUnit({ key: 'story-1', label: '第 1 篇故事', groups });
    expect(pages[0]).toMatchObject({ key: 'story-1', label: `第 1 篇故事（1/${pages.length}）` });
    expect(pages[1]).toMatchObject({
      key: 'story-1:part-2',
      label: `第 1 篇故事（2/${pages.length}）`,
    });
    expect(new Set(pages.map((page) => page.key)).size).toBe(pages.length);
  });
});
