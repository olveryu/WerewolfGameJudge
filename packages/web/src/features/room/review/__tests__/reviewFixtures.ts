/** Synthetic review documents for platform tests: every block kind, no game code. */

import type {
  ReviewBlock,
  ReviewImageBlock,
  ReviewImageLoadResult,
  RoomReviewDocument,
  RoomReviewPage,
} from '../types';

export function imageBlock(
  assetId: string,
  load: (signal: AbortSignal) => Promise<ReviewImageLoadResult> = async () => ({
    kind: 'loaded',
    dataUri: `data:image/png;base64,${assetId}`,
  }),
): ReviewImageBlock {
  return { kind: 'image', assetId, caption: `画作 ${assetId}`, aspectRatio: 4 / 3, load };
}

/** One block of every kind but image, in a plausible report order. */
const TEXT_BLOCKS: readonly ReviewBlock[] = [
  {
    kind: 'hero',
    headline: [
      { kind: 'text', text: '昨夜 ' },
      { kind: 'figure', text: '2', tone: 'out' },
      { kind: 'text', text: ' 人出局' },
    ],
    tone: 'neutral',
    stamps: [{ seat: 2, tone: 'out', title: '预言家', caption: '狼杀出局', note: '狼队 3 票锁定' }],
    byline: '刺客指认出了梅林',
  },
  {
    kind: 'stats',
    items: [
      { label: '成功', value: '3' },
      { label: '失败', value: '2' },
    ],
  },
  { kind: 'section', title: '第一夜' },
  {
    kind: 'timeline',
    steps: [
      {
        title: null,
        tone: 'neutral',
        lines: [
          [
            { kind: 'text', text: '1号狼人', tone: 'neutral' },
            { kind: 'text', text: '袭击3号', tone: 'evil' },
            { kind: 'text', text: '。', tone: 'neutral' },
          ],
        ],
      },
      {
        title: '首轮投票结果',
        tone: 'highlight',
        lines: [
          [
            { kind: 'seat', seat: 2, tone: 'highlight' },
            { kind: 'text', text: '4 票：', tone: 'neutral' },
            { kind: 'seat', seat: 0, tone: 'neutral' },
            { kind: 'tag', text: '当选', tone: 'highlight' },
          ],
        ],
      },
    ],
  },
  {
    kind: 'groups',
    groups: [
      {
        title: '第 1 次任务',
        railTone: 'good',
        tag: { text: '成功', tone: 'good' },
        rows: [
          {
            cells: [
              { kind: 'seat', seat: 0, tone: 'neutral' },
              { kind: 'tag', text: '否决', tone: 'evil' },
            ],
            isDimmed: true,
          },
        ],
        footnote: '队长 1 号',
      },
    ],
  },
  { kind: 'divider' },
  { kind: 'section', title: '全员身份' },
  {
    kind: 'roster',
    columns: 2,
    rows: [
      {
        seat: 0,
        seatTone: 'evil',
        name: null,
        role: '狼人',
        status: '存活',
        statusTone: 'muted',
        isOut: false,
      },
      {
        seat: 2,
        seatTone: 'out',
        name: null,
        role: '预言家',
        status: '狼杀出局',
        statusTone: 'out',
        isOut: true,
      },
    ],
  },
  {
    kind: 'facts',
    items: [
      { label: '平民词', value: '苹果' },
      { label: '卧底词', value: '梨' },
    ],
  },
  {
    kind: 'scoreboard',
    rows: [
      { rank: 1, seat: 1, name: '小明', scoreText: '12 分', tag: null },
      {
        rank: 1,
        seat: 3,
        name: '机器人 4',
        scoreText: '12 分',
        tag: { text: '机器人', tone: 'muted' },
      },
    ],
  },
  { kind: 'paragraph', caption: '第 1 棒 · 小明', text: '从前有座山。', isMissing: false },
  { kind: 'paragraph', caption: null, text: '这一棒交了空白', isMissing: true },
];

export function page(
  key: string,
  label: string | null,
  blocks: readonly ReviewBlock[],
): RoomReviewPage {
  return { key, label, blocks };
}

export function reviewDocument(overrides: Partial<RoomReviewDocument> = {}): RoomReviewDocument {
  return {
    roundKey: 'round-1',
    kicker: '🌙 第一夜 · 夜报',
    fileStem: 'demo-1234-1',
    footer: '本局复盘由对局记录自动生成',
    isAborted: false,
    pages: [page('only', null, TEXT_BLOCKS)],
    ...overrides,
  };
}

export function twoPageDocument(overrides: Partial<RoomReviewDocument> = {}): RoomReviewDocument {
  return reviewDocument({
    pages: [
      page('album-1', '第 1 篇 · 小明的画册', [{ kind: 'section', title: '起手词：苹果' }]),
      page('album-2', '第 2 篇 · 小红的画册', [{ kind: 'section', title: '起手词：梨' }]),
    ],
    ...overrides,
  });
}
