/** The FibKing review: when a round is reviewable, and the document an ended round yields. */

import type { FibRound, FibState } from '@game-judge/game-engine/games/fibking/public';

import { assertReviewDocument } from '@/features/room/review/assertReviewDocument';
import type { RoomReviewDocument } from '@/features/room/review/types';
import { dispatchFibkingTestCommand, playFibkingTestRound } from '@/test-utils/fibkingState';

import { fibReview } from '../fibReview';
import { type FibReviewInput, toFibReviewDocument } from '../toFibReviewDocument';

const VIEWER = { userId: 'u1', isHost: false, seat: 1 };

function resolve(state: FibState) {
  return fibReview.resolve({ state, viewer: VIEWER, roomCode: '4321' });
}

function documentOf(state: FibState): RoomReviewDocument {
  const availability = resolve(state);
  if (availability.kind !== 'available') throw new Error('expected an available review');
  return availability.document;
}

describe('fibReview.resolve', () => {
  it.each([
    ['lobby', () => playFibkingTestRound('lobby')],
    ['preparing', () => playFibkingTestRound('preparing')],
    [
      'preparationFailed',
      () => {
        const state = playFibkingTestRound('preparing');
        if (state.phase !== 'preparing') throw new Error('expected a preparing state');
        return dispatchFibkingTestCommand(
          state,
          {
            type: 'fibking.round.failPreparation',
            roundId: state.pendingRound.roundId,
            failureCode: 'selectionFailed',
          },
          'system',
        );
      },
    ],
    ['viewing', () => playFibkingTestRound('viewing')],
    ['ongoing', () => playFibkingTestRound('ongoing')],
  ])('has nothing to review while the round is %s', (phase, build) => {
    const state = build();
    expect(state.phase).toBe(phase);
    expect(resolve(state)).toEqual({ kind: 'notEnded' });
  });

  it('lets every reader read and share an ended round without a confirmation', () => {
    const state = playFibkingTestRound('ended');
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
    // Pure: the same state resolves to a structurally equal result.
    expect(resolve(state)).toEqual(availability);
  });

  it('reads the outcome the engine decided: the pick of 老实人 ends the round as found', () => {
    const ongoing = playFibkingTestRound('ongoing');
    if (ongoing.phase !== 'ongoing') throw new Error('expected an ongoing state');
    const { guesserSeat, honestSeat } = ongoing.round.roles;
    const fibberSeat = [0, 1, 2, 3].find((seat) => seat !== guesserSeat && seat !== honestSeat);
    if (fibberSeat === undefined) throw new Error('expected a fibber seat');
    const missed = dispatchFibkingTestCommand(ongoing, {
      type: 'fibking.round.guess',
      seat: fibberSeat,
    });
    expect(missed.phase).toBe('ongoing');
    const found = dispatchFibkingTestCommand(missed, {
      type: 'fibking.round.guess',
      seat: honestSeat,
    });
    expect(found.phase).toBe('ended');
    expect(documentOf(found).pages[0]?.blocks).toEqual([
      expect.objectContaining({ kind: 'hero', byline: '大聪明选中了老实人' }),
      expect.objectContaining({ kind: 'facts' }),
      { kind: 'section', title: '全员身份' },
      expect.objectContaining({ kind: 'roster' }),
      { kind: 'section', title: '点选记录' },
      {
        kind: 'timeline',
        steps: [
          expect.objectContaining({
            lines: [[expect.objectContaining({ seat: fibberSeat }), expect.anything()]],
          }),
          expect.objectContaining({
            lines: [[expect.objectContaining({ seat: honestSeat }), expect.anything()]],
          }),
        ],
      },
    ]);

    const revealed = dispatchFibkingTestCommand(missed, { type: 'fibking.round.reveal' });
    expect(documentOf(revealed).pages[0]?.blocks[0]).toMatchObject({
      byline: '大聪明被瞎掰王骗过',
    });
  });
});

const ROUND: FibRound = {
  roundId: 'fib-round:r1',
  word: '山谷',
  definition: {
    coreMeaning: '两山之间低洼而且狭长的自然地形区域。',
    usageNote: '常用于描述山地之间可供河流或道路穿行的低地。',
  },
  source: 'local',
  roles: { guesserSeat: 1, honestSeat: 2 },
  viewedSeats: [0, 1, 2, 3],
  guesses: [
    { seat: 3, role: 'fibber', revealedAt: 10 },
    { seat: 2, role: 'honest', revealedAt: 20 },
  ],
};

const INPUT: FibReviewInput = {
  round: ROUND,
  numberOfPlayers: 4,
  roster: {
    0: { userId: 'host', seat: 0, profile: { displayName: '房主' } },
    1: { userId: 'u1', seat: 1, profile: { displayName: '小明' } },
    2: { seat: 2, kind: 'bot' },
    3: { seat: 3, kind: 'bot' },
  },
  roomCode: '4321',
};

describe('toFibReviewDocument', () => {
  it('reviews a round 大聪明 closed by picking 老实人', () => {
    expect(toFibReviewDocument(INPUT)).toEqual({
      roundKey: 'fib-round:r1',
      kicker: '💡 本局 · 终局',
      fileStem: 'fibking-4321',
      footer: '本局复盘由对局记录自动生成',
      isAborted: false,
      pages: [
        {
          key: 'round',
          label: null,
          blocks: [
            {
              kind: 'hero',
              headline: [{ kind: 'text', text: '山谷' }],
              tone: 'neutral',
              stamps: [],
              byline: '大聪明选中了老实人',
            },
            {
              kind: 'facts',
              items: [
                { label: '核心释义', value: '两山之间低洼而且狭长的自然地形区域。' },
                { label: '使用提示', value: '常用于描述山地之间可供河流或道路穿行的低地。' },
              ],
            },
            { kind: 'section', title: '全员身份' },
            {
              kind: 'roster',
              columns: 1,
              rows: [
                {
                  seat: 0,
                  seatTone: 'evil',
                  name: '房主',
                  role: '瞎掰王',
                  status: '未被选中',
                  statusTone: 'muted',
                  isOut: false,
                },
                {
                  seat: 1,
                  seatTone: 'highlight',
                  name: '小明',
                  role: '大聪明',
                  status: '未被选中',
                  statusTone: 'muted',
                  isOut: false,
                },
                {
                  seat: 2,
                  seatTone: 'good',
                  name: '机器人3号',
                  role: '老实人',
                  status: '第 2 个被选中',
                  statusTone: 'good',
                  isOut: false,
                },
                {
                  seat: 3,
                  seatTone: 'evil',
                  name: '机器人4号',
                  role: '瞎掰王',
                  status: '第 1 个被选中',
                  statusTone: 'evil',
                  isOut: false,
                },
              ],
            },
            { kind: 'section', title: '点选记录' },
            {
              kind: 'timeline',
              steps: [
                {
                  title: null,
                  tone: 'evil',
                  lines: [
                    [
                      { kind: 'seat', seat: 3, tone: 'evil' },
                      { kind: 'tag', text: '瞎掰王', tone: 'evil' },
                    ],
                  ],
                },
                {
                  title: null,
                  tone: 'good',
                  lines: [
                    [
                      { kind: 'seat', seat: 2, tone: 'good' },
                      { kind: 'tag', text: '老实人', tone: 'good' },
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

  it('reviews a round the host revealed before 大聪明 found 老实人', () => {
    const document = toFibReviewDocument({
      ...INPUT,
      round: { ...ROUND, guesses: [{ seat: 3, role: 'fibber', revealedAt: 10 }] },
    });
    const blocks = document.pages[0]?.blocks ?? [];
    expect(blocks[0]).toMatchObject({ kind: 'hero', byline: '大聪明被瞎掰王骗过' });
    expect(blocks[3]).toMatchObject({
      kind: 'roster',
      rows: [
        { seat: 0, status: '未被选中' },
        { seat: 1, status: '未被选中' },
        { seat: 2, role: '老实人', status: '未被选中', statusTone: 'muted' },
        { seat: 3, status: '第 1 个被选中', statusTone: 'evil' },
      ],
    });
    expect(blocks[5]).toMatchObject({ kind: 'timeline', steps: [{ tone: 'evil' }] });
  });

  it('leaves out the pick record of a round revealed before any pick', () => {
    const document = toFibReviewDocument({ ...INPUT, round: { ...ROUND, guesses: [] } });
    expect(document.pages[0]?.blocks.map((block) => block.kind)).toEqual([
      'hero',
      'facts',
      'section',
      'roster',
    ]);
    expect(document.pages[0]?.blocks[0]).toMatchObject({ byline: '大聪明被瞎掰王骗过' });
  });

  it('fails fast on a seat of the round that holds no player', () => {
    expect(() => toFibReviewDocument({ ...INPUT, roster: { ...INPUT.roster, 3: null } })).toThrow(
      '[FAIL-FAST] FibKing review seat 3 holds no player',
    );
  });
});
