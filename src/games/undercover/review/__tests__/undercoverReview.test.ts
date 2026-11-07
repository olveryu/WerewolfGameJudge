/** The undercover review: when a round is reviewable, and the document a concluded round yields. */

import type {
  UndercoverRole,
  UndercoverRound,
  UndercoverState,
} from '@game-judge/game-engine/games/undercover/public';

import { assertReviewDocument } from '@/features/room/review/assertReviewDocument';
import type { RoomReviewDocument } from '@/features/room/review/types';
import {
  dispatchUndercoverTestCommand,
  playUndercoverTestRound,
} from '@/test-utils/undercoverState';

import {
  toUndercoverReviewDocument,
  type UndercoverReviewInput,
} from '../toUndercoverReviewDocument';
import { undercoverReview } from '../undercoverReview';

const VIEWER = { userId: 'u2', isHost: false, seat: 2 };

function resolve(state: UndercoverState) {
  return undercoverReview.resolve({ state, viewer: VIEWER, roomCode: '1234' });
}

describe('undercoverReview.resolve', () => {
  it.each([
    ['lobby', () => playUndercoverTestRound('lobby')],
    ['preparing', () => playUndercoverTestRound('preparing')],
    [
      'preparationFailed',
      () =>
        dispatchUndercoverTestCommand(
          playUndercoverTestRound('preparing'),
          {
            type: 'undercover.round.failPreparation',
            roundId: 'undercover-round:start',
            failureCode: 'selectionFailed',
          },
          'system',
        ),
    ],
    ['viewing', () => playUndercoverTestRound('viewing')],
    ['ongoing', () => playUndercoverTestRound('ongoing')],
  ])('has nothing to review while the round is %s', (phase, build) => {
    const state = build();
    expect(state.phase).toBe(phase);
    expect(resolve(state)).toEqual({ kind: 'notEnded' });
  });

  it('lets every reader read and share an ended round without a confirmation', () => {
    const state = playUndercoverTestRound('ended');
    if (state.phase !== 'ended') throw new Error('expected an ended state');
    const availability = resolve(state);
    if (availability.kind !== 'available') throw new Error('expected an available review');
    expect(availability.sharing).toEqual({ isAllowed: true });
    expect(availability.confirmation).toBeNull();
    expect(availability.document).toMatchObject({
      roundKey: state.round.roundId,
      isAborted: false,
    });
    expect(() => assertReviewDocument(availability.document)).not.toThrow();
    expect(availability.document.pages[0]?.blocks.map((block) => block.kind)).toEqual([
      'hero',
      'facts',
      'section',
      'roster',
      'section',
      'timeline',
    ]);
    // Pure: the same state resolves to a structurally equal result.
    expect(resolve(state)).toEqual(availability);
  });

  it('reviews a round aborted after the deal, and nothing for an abort during preparation', () => {
    const viewing = playUndercoverTestRound('viewing');
    const aborted = dispatchUndercoverTestCommand(viewing, {
      type: 'undercover.game.abort',
      roundId: 'undercover-round:start',
    });
    const availability = resolve(aborted);
    if (availability.kind !== 'available') throw new Error('expected an available review');
    expect(availability.document.isAborted).toBe(true);
    expect(availability.sharing).toEqual({ isAllowed: true });

    const abortedEarly = dispatchUndercoverTestCommand(playUndercoverTestRound('preparing'), {
      type: 'undercover.game.abort',
      roundId: 'undercover-round:start',
    });
    expect(abortedEarly).toMatchObject({ phase: 'aborted', round: null });
    expect(resolve(abortedEarly)).toEqual({ kind: 'notEnded' });
  });
});

const ROUND: UndercoverRound = {
  roundId: 'undercover-round:r1',
  wordPair: { id: 'pair-1', wordA: '牛奶', wordB: '豆浆', category: 'food' },
  civilianWord: '豆浆',
  undercoverWord: '牛奶',
  roles: ['civilian', 'undercover', 'civilian', 'blank', 'civilian', 'civilian'],
  speakingStartSeat: 0,
  confirmedSeats: [0, 1, 2, 3, 4, 5],
  revelations: [
    { seat: 3, role: 'blank', revealedAt: 10 },
    { seat: 1, role: 'undercover', revealedAt: 20 },
  ],
};

const INPUT: UndercoverReviewInput = {
  round: ROUND,
  conclusion: { kind: 'won', winner: 'civilian' },
  config: { numberOfPlayers: 6, hasBlank: true, category: 'all' },
  roster: {
    0: { userId: 'host', seat: 0, profile: { displayName: '小明' } },
    1: { seat: 1, kind: 'bot' },
    2: { userId: 'u2', seat: 2, profile: { displayName: '小红' } },
    3: { seat: 3, kind: 'bot' },
    4: { seat: 4, kind: 'bot' },
    5: { seat: 5, kind: 'bot' },
  },
  roomCode: '1234',
};

function blocksOf(document: RoomReviewDocument) {
  const [page] = document.pages;
  if (page === undefined || document.pages.length !== 1) throw new Error('expected one page');
  return page.blocks;
}

describe('toUndercoverReviewDocument', () => {
  it('reviews a won round: verdict, words, identity wall and elimination order', () => {
    expect(toUndercoverReviewDocument(INPUT)).toEqual({
      roundKey: 'undercover-round:r1',
      kicker: '🕵️ 本局 · 终局',
      fileStem: 'undercover-1234',
      footer: '本局复盘由对局记录自动生成',
      isAborted: false,
      pages: [
        {
          key: 'round',
          label: null,
          blocks: [
            {
              kind: 'hero',
              headline: [{ kind: 'text', text: '平民获胜' }],
              tone: 'good',
              stamps: [
                { seat: 3, tone: 'out', title: '白板', caption: '第 1 个出局', note: null },
                { seat: 1, tone: 'out', title: '卧底', caption: '第 2 个出局', note: null },
              ],
              byline: null,
            },
            {
              kind: 'facts',
              items: [
                { label: '平民词', value: '豆浆' },
                { label: '卧底词', value: '牛奶' },
                { label: '词语分类', value: '吃喝美食' },
                { label: '白板', value: '有白板' },
              ],
            },
            { kind: 'section', title: '全员身份' },
            {
              kind: 'roster',
              columns: 1,
              rows: [
                {
                  seat: 0,
                  seatTone: 'good',
                  name: '小明',
                  role: '平民',
                  status: '存活',
                  statusTone: 'muted',
                  isOut: false,
                },
                {
                  seat: 1,
                  seatTone: 'out',
                  name: '机器人2号',
                  role: '卧底',
                  status: '第 2 个出局',
                  statusTone: 'out',
                  isOut: true,
                },
                {
                  seat: 2,
                  seatTone: 'good',
                  name: '小红',
                  role: '平民',
                  status: '存活',
                  statusTone: 'muted',
                  isOut: false,
                },
                {
                  seat: 3,
                  seatTone: 'out',
                  name: '机器人4号',
                  role: '白板',
                  status: '第 1 个出局',
                  statusTone: 'out',
                  isOut: true,
                },
                {
                  seat: 4,
                  seatTone: 'good',
                  name: '机器人5号',
                  role: '平民',
                  status: '存活',
                  statusTone: 'muted',
                  isOut: false,
                },
                {
                  seat: 5,
                  seatTone: 'good',
                  name: '机器人6号',
                  role: '平民',
                  status: '存活',
                  statusTone: 'muted',
                  isOut: false,
                },
              ],
            },
            { kind: 'section', title: '出局顺序' },
            {
              kind: 'timeline',
              steps: [
                {
                  title: null,
                  tone: 'special',
                  lines: [
                    [
                      { kind: 'seat', seat: 3, tone: 'out' },
                      { kind: 'tag', text: '白板', tone: 'special' },
                    ],
                  ],
                },
                {
                  title: null,
                  tone: 'evil',
                  lines: [
                    [
                      { kind: 'seat', seat: 1, tone: 'out' },
                      { kind: 'tag', text: '卧底', tone: 'evil' },
                    ],
                  ],
                },
              ],
            },
          ],
        },
      ],
    });
  });

  it.each<[UndercoverRole, string, string]>([
    ['civilian', '平民获胜', 'good'],
    ['undercover', '卧底获胜', 'evil'],
    ['blank', '白板获胜', 'special'],
  ])('names the %s side the winner in its tone', (winner, headline, tone) => {
    const [hero] = blocksOf(
      toUndercoverReviewDocument({ ...INPUT, conclusion: { kind: 'won', winner } }),
    );
    expect(hero).toMatchObject({
      kind: 'hero',
      headline: [{ kind: 'text', text: headline }],
      tone,
    });
  });

  it('states the room without a blank', () => {
    const facts = blocksOf(
      toUndercoverReviewDocument({ ...INPUT, config: { ...INPUT.config, hasBlank: false } }),
    )[1];
    expect(facts).toMatchObject({ kind: 'facts', items: [{}, {}, {}, { value: '无白板' }] });
  });

  it('reviews an aborted round with only what play made public', () => {
    const document = toUndercoverReviewDocument({
      ...INPUT,
      round: { ...ROUND, revelations: [{ seat: 3, role: 'blank', revealedAt: 10 }] },
      conclusion: { kind: 'aborted' },
    });
    expect(document.isAborted).toBe(true);
    expect(blocksOf(document)).toEqual([
      {
        kind: 'hero',
        headline: [{ kind: 'text', text: '本局已中止' }],
        tone: 'neutral',
        stamps: [{ seat: 3, tone: 'out', title: '白板', caption: '第 1 个出局', note: null }],
        byline: '本局不计胜负，不公开未揭晓身份和词语。',
      },
      {
        kind: 'facts',
        items: [
          { label: '词语分类', value: '全部分类' },
          { label: '白板', value: '有白板' },
        ],
      },
      { kind: 'section', title: '出局顺序' },
      {
        kind: 'timeline',
        steps: [
          {
            title: null,
            tone: 'special',
            lines: [
              [
                { kind: 'seat', seat: 3, tone: 'out' },
                { kind: 'tag', text: '白板', tone: 'special' },
              ],
            ],
          },
        ],
      },
    ]);
    // Neither word, the drawn category nor an unrevealed role reaches the review.
    const text = JSON.stringify(document);
    for (const secret of ['豆浆', '牛奶', '吃喝美食', '平民', '卧底']) {
      expect(text).not.toContain(secret);
    }
  });

  it('reviews an abort before any elimination as the verdict and the room facts alone', () => {
    const document = toUndercoverReviewDocument({
      ...INPUT,
      round: { ...ROUND, revelations: [] },
      conclusion: { kind: 'aborted' },
    });
    expect(blocksOf(document).map((block) => block.kind)).toEqual(['hero', 'facts']);
    expect(blocksOf(document)[0]).toMatchObject({ stamps: [] });
  });

  it('fails fast on a seat of the round that holds no player', () => {
    expect(() =>
      toUndercoverReviewDocument({ ...INPUT, roster: { ...INPUT.roster, 4: null } }),
    ).toThrow('[FAIL-FAST] Undercover review seat 4 holds no player');
  });
});
