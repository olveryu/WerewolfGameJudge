/**
 * The DrawGuess review document, pinned from games played through the real
 * engine: the standings page, then one page per finished turn.
 */

import type { DrawGuessState } from '@game-judge/game-engine/games/drawguess/public';

import { assertReviewDocument } from '@/features/room/review/assertReviewDocument';
import type {
  ReviewImageLoadResult,
  ReviewTimelineStep,
  RoomReviewDocument,
  RoomReviewPage,
} from '@/features/room/review/types';
import {
  buildDrawGuessTestState,
  type DrawGuessTestTurn,
  playDrawGuessTestGame,
} from '@/test-utils/drawguessState';

import {
  DRAWGUESS_DRAWER_ZEROED_DETAIL,
  DRAWGUESS_DRAWER_ZEROED_TITLE,
} from '../../model/drawGuessResults';
import {
  type DrawGuessDrawingLoader,
  toDrawGuessReviewDocument,
} from '../toDrawGuessReviewDocument';

const DATA_URI = 'data:image/png;base64,AA==';

/**
 * Turn 0: 阿杰 draws and files, 小雨 then 机器人3号 guess. Turn 1: 小雨 draws,
 * every guesser guesses (the drawer's gain is zeroed). Turn 2: a bot drawer
 * files a drawing nobody guesses. Turn 3: 小雨 guesses alone. Later turns pass
 * with no guess and no drawing.
 */
const SCRIPT: readonly DrawGuessTestTurn[] = [
  { guessers: [1, 2], filesDrawing: true },
  { guessers: [0, 2, 3], filesDrawing: false },
  { guessers: [], filesDrawing: true },
  { guessers: [1], filesDrawing: false },
];

const loadDrawing = jest.fn<Promise<ReviewImageLoadResult>, Parameters<DrawGuessDrawingLoader>>(
  async () => ({ kind: 'loaded', dataUri: DATA_URI }),
);

function documentFor(state: DrawGuessState): RoomReviewDocument {
  return toDrawGuessReviewDocument({ state, roomCode: 'ABCD', loadDrawing });
}

function pageOf(document: RoomReviewDocument, key: string): RoomReviewPage {
  const page = document.pages.find((candidate) => candidate.key === key);
  if (page === undefined) throw new Error(`expected page ${key}`);
  return page;
}

function guessStep(seat: number, name: string, score: number): ReviewTimelineStep {
  return {
    title: null,
    tone: 'good',
    lines: [
      [
        { kind: 'seat', seat, tone: 'good' },
        { kind: 'text', text: name, tone: 'neutral' },
        { kind: 'text', text: ` +${score} 分`, tone: 'good' },
      ],
    ],
  };
}

describe('toDrawGuessReviewDocument', () => {
  const ended = playDrawGuessTestGame(SCRIPT);
  const document = documentFor(ended);

  beforeEach(() => {
    loadDrawing.mockClear();
  });

  it('frames the game as one standings page plus one page per finished turn', () => {
    expect(() => assertReviewDocument(document)).not.toThrow();
    expect(document).toMatchObject({
      roundKey: 'game-1',
      kicker: '🎨 第 1 局 · 终局',
      fileStem: 'drawguess-ABCD-1',
      footer: '本局复盘由对局记录自动生成',
      isAborted: false,
    });
    expect(document.pages.map((page) => page.key)).toEqual([
      'standings',
      ...ended.turnHistory.map((turn) => `turn-${turn.turnIndex}`),
    ]);
    expect(document.pages.map((page) => page.label)).toEqual([
      '最终排名',
      '第 1 轮 · 阿杰 画「大熊猫」',
      '第 2 轮 · 小雨 画「火锅」',
      '第 3 轮 · 机器人3号 画「风筝」',
      '第 4 轮 · 机器人4号 画「长城」',
      '第 5 轮 · 阿杰 画「月亮」',
      '第 6 轮 · 小雨 画「雪人」',
      '第 7 轮 · 机器人3号 画「钢琴」',
      '第 8 轮 · 机器人4号 画「西瓜」',
    ]);
  });

  it('crowns the leader and ranks every seat on the in-room competition ranking', () => {
    expect(pageOf(document, 'standings').blocks).toEqual([
      {
        kind: 'hero',
        headline: [{ kind: 'text', text: '第一名 小雨' }],
        tone: 'highlight',
        stamps: [
          { seat: 1, tone: 'highlight', title: '小雨', caption: '第 1 名', note: '392 分' },
          { seat: 2, tone: 'highlight', title: '机器人3号', caption: '第 2 名', note: '384 分' },
          { seat: 0, tone: 'highlight', title: '阿杰', caption: '第 3 名', note: '314 分' },
        ],
        byline: null,
      },
      {
        kind: 'scoreboard',
        rows: [
          { rank: 1, seat: 1, name: '小雨', scoreText: '392 分', tag: null },
          {
            rank: 2,
            seat: 2,
            name: '机器人3号',
            scoreText: '384 分',
            tag: { text: '机器人', tone: 'muted' },
          },
          { rank: 3, seat: 0, name: '阿杰', scoreText: '314 分', tag: null },
          {
            rank: 4,
            seat: 3,
            name: '机器人4号',
            scoreText: '286 分',
            tag: { text: '机器人', tone: 'muted' },
          },
        ],
      },
    ]);
  });

  it('shares the podium between tied seats', () => {
    const [hero, scoreboard] = pageOf(documentFor(playDrawGuessTestGame([])), 'standings').blocks;
    expect(hero).toMatchObject({
      kind: 'hero',
      headline: [{ kind: 'text', text: '第一名 阿杰、小雨、机器人3号、机器人4号' }],
      stamps: [0, 1, 2, 3].map((seat) => ({ seat, caption: '第 1 名', note: '0 分' })),
    });
    expect(scoreboard).toMatchObject({
      kind: 'scoreboard',
      rows: [0, 1, 2, 3].map((seat) => ({ rank: 1, seat, scoreText: '0 分' })),
    });
  });

  it('shows a turn as its filed drawing, its facts and the guess order', async () => {
    const [turn] = ended.turnHistory;
    if (turn?.entryId == null) throw new Error('expected the first turn to file a drawing');
    const blocks = pageOf(document, 'turn-0').blocks;
    expect(blocks.map((block) => block.kind)).toEqual(['image', 'facts', 'section', 'timeline']);
    const [image, ...rest] = blocks;
    if (image?.kind !== 'image') throw new Error('expected the drawing first');
    expect(image).toMatchObject({
      assetId: turn.entryId,
      caption: '阿杰的终稿',
      aspectRatio: 1024 / 768,
    });
    const signal = new AbortController().signal;
    await expect(image.load(signal)).resolves.toEqual({ kind: 'loaded', dataUri: DATA_URI });
    expect(loadDrawing).toHaveBeenCalledWith(turn.entryId, signal);
    expect(rest).toEqual([
      {
        kind: 'facts',
        items: [
          { label: '题目', value: '大熊猫' },
          { label: '画手', value: '阿杰' },
          { label: '猜中人数', value: '2 人' },
        ],
      },
      { kind: 'section', title: '猜中顺序' },
      { kind: 'timeline', steps: [guessStep(1, '小雨', 196), guessStep(2, '机器人3号', 192)] },
    ]);
  });

  it('marks a drawing that was never filed and notes the all-guessed zeroing', () => {
    expect(pageOf(document, 'turn-1').blocks).toEqual([
      { kind: 'paragraph', caption: '小雨的终稿', text: '未提交画作', isMissing: true },
      {
        kind: 'facts',
        items: [
          { label: '题目', value: '火锅' },
          { label: '画手', value: '小雨' },
          { label: '猜中人数', value: '3 人' },
          { label: DRAWGUESS_DRAWER_ZEROED_TITLE, value: DRAWGUESS_DRAWER_ZEROED_DETAIL },
        ],
      },
      { kind: 'section', title: '猜中顺序' },
      {
        kind: 'timeline',
        steps: [
          guessStep(0, '阿杰', 196),
          guessStep(2, '机器人3号', 192),
          guessStep(3, '机器人4号', 188),
        ],
      },
    ]);
  });

  it('keeps a turn nobody guessed to its drawing and facts', () => {
    const blocks = pageOf(document, 'turn-2').blocks;
    expect(blocks.map((block) => block.kind)).toEqual(['image', 'facts']);
    expect(blocks[0]).toMatchObject({ caption: '机器人3号的终稿' });
    expect(blocks[1]).toEqual({
      kind: 'facts',
      items: [
        { label: '题目', value: '风筝' },
        { label: '画手', value: '机器人3号' },
        { label: '猜中人数', value: '0 人' },
      ],
    });
  });

  it('renders a single unlabeled page when the history is empty', () => {
    // A room migrated from state v3 after its last turn closed keeps no history.
    const migrated = documentFor({ ...ended, turnHistory: [] });
    expect(() => assertReviewDocument(migrated)).not.toThrow();
    expect(migrated.pages.map((page) => [page.key, page.label])).toEqual([['standings', null]]);
  });

  it('fails fast outside the ended phase', () => {
    expect(() => documentFor(buildDrawGuessTestState())).toThrow(
      '[FAIL-FAST] DrawGuess review built during lobby',
    );
  });

  it('fails fast on a filed drawing without its media', () => {
    const [first, ...rest] = ended.turnHistory;
    if (first === undefined) throw new Error('expected a turn history');
    const broken: DrawGuessState = {
      ...ended,
      turnHistory: [{ ...first, pngEntry: null }, ...rest],
    };
    expect(() => documentFor(broken)).toThrow('[FAIL-FAST] DrawGuess turn 0 drawing');
  });
});
