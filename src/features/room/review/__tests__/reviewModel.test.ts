/** Document structure rules, the JSON projection, and the shared entry builders. */

import { canonicalJson } from '@game-judge/game-engine/platform/protocol/canonicalJson';

import {
  HOST_ACTION_KEYS,
  hostClosingTask,
  hostReviewClosingTask,
} from '@/features/room/model/hostManagementActions';
import { TESTIDS } from '@/testids';

import { assertReviewDocument } from '../assertReviewDocument';
import { buildReviewBottomButton, buildReviewHostAction } from '../roomReviewActions';
import { serializeReviewDocument } from '../serializeReviewDocument';
import { reviewImageFilename } from '../useRoomReviewExport';
import { imageBlock, page, reviewDocument, twoPageDocument } from './reviewFixtures';

describe('assertReviewDocument', () => {
  it('accepts single-page and labelled multi-page documents', () => {
    expect(() => assertReviewDocument(reviewDocument())).not.toThrow();
    expect(() => assertReviewDocument(twoPageDocument())).not.toThrow();
  });

  it.each([
    ['no pages', reviewDocument({ pages: [] }), 'has no pages'],
    [
      'an empty page',
      reviewDocument({ pages: [page('only', null, [])] }),
      'page only has no blocks',
    ],
    [
      'a repeated page key',
      reviewDocument({
        pages: [
          page('same', '第 1 篇', [{ kind: 'divider' }]),
          page('same', '第 2 篇', [{ kind: 'divider' }]),
        ],
      }),
      'repeats page key same',
    ],
    [
      'an unlabelled page of a multi-page document',
      reviewDocument({
        pages: [
          page('a', '第 1 篇', [{ kind: 'divider' }]),
          page('b', null, [{ kind: 'divider' }]),
        ],
      }),
      'page b must carry a label',
    ],
    [
      'a labelled single page',
      reviewDocument({ pages: [page('only', '第 1 篇', [{ kind: 'divider' }])] }),
      'page only must carry a label',
    ],
  ])('rejects %s', (_name, document, message) => {
    expect(() => assertReviewDocument(document)).toThrow(message);
  });
});

describe('serializeReviewDocument', () => {
  it('replaces image loaders with their asset ids so the document is canonical JSON', () => {
    const document = reviewDocument({
      pages: [page('only', null, [imageBlock('turn-1'), { kind: 'divider' }])],
    });
    expect(() => canonicalJson(document)).toThrow();
    const serialized = serializeReviewDocument(document);
    expect(serialized.pages[0]?.blocks).toEqual([
      { kind: 'image', assetId: 'turn-1', caption: '画作 turn-1', aspectRatio: 4 / 3 },
      { kind: 'divider' },
    ]);
    expect(canonicalJson(serialized)).toBe(canonicalJson(serializeReviewDocument(document)));
  });

  it('distinguishes documents by content, not by loader identity', () => {
    const first = reviewDocument({ pages: [page('only', null, [imageBlock('a')])] });
    const second = reviewDocument({ pages: [page('only', null, [imageBlock('a')])] });
    const third = reviewDocument({ pages: [page('only', null, [imageBlock('b')])] });
    expect(canonicalJson(serializeReviewDocument(first))).toBe(
      canonicalJson(serializeReviewDocument(second)),
    );
    expect(canonicalJson(serializeReviewDocument(first))).not.toBe(
      canonicalJson(serializeReviewDocument(third)),
    );
  });
});

describe('reviewImageFilename', () => {
  it('names a single page by the stem and each page of a longer document by position', () => {
    expect(reviewImageFilename(reviewDocument(), 0)).toBe('demo-1234-1.png');
    expect(reviewImageFilename(twoPageDocument(), 1)).toBe('demo-1234-1-p2.png');
  });
});

describe('review entry builders', () => {
  it('builds the bottom button every game renders, addressed to anyone', () => {
    const onPress = jest.fn();
    expect(buildReviewBottomButton({ isEnabled: true, onPress }, 'secondary')).toEqual({
      key: HOST_ACTION_KEYS.review,
      label: '本局复盘',
      audience: 'anyone',
      icon: 'document-text-outline',
      variant: 'secondary',
      size: 'md',
      testID: TESTIDS.roomReviewOpenButton,
      isEnabled: true,
      onPress,
    });
    expect(
      buildReviewBottomButton(
        { isEnabled: false, disabledReason: '房主尚未向你开放复盘' },
        'ghost',
      ),
    ).toMatchObject({ isEnabled: false, disabledReason: '房主尚未向你开放复盘', variant: 'ghost' });
  });

  it('builds the host sheet action under the canonical review key', () => {
    const onPress = jest.fn();
    expect(buildReviewHostAction({ isEnabled: true, onPress })).toEqual({
      key: 'review',
      label: '本局复盘',
      icon: 'document-text-outline',
      variant: 'secondary',
      testID: TESTIDS.roomReviewHostAction,
      isEnabled: true,
      onPress,
    });
  });

  it('closes a round with the review as an equal option beside the terminal pair', () => {
    expect(hostReviewClosingTask()).toEqual({
      kind: 'choice',
      actionKeys: ['review', 'next-round', 'return-lobby'],
    });
    expect(hostClosingTask()).toEqual({
      kind: 'choice',
      actionKeys: ['next-round', 'return-lobby'],
    });
  });
});
