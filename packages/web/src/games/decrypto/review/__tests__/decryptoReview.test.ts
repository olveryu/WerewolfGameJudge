/** Review facts are derived from a complete match played through engine commands. */
import {
  DECRYPTO_PHASES,
  getDecryptoViewModel,
  projectDecryptoStateForUser,
} from '@game-judge/game-engine/games/decrypto/public';

import {
  buildDecryptoStateForPhase,
  buildDecryptoTiebreakTestGame,
  endDecryptoTestGame,
  startDecryptoTestGame,
} from '@/test-utils/decryptoState';
import { viewerFor } from '@/test-utils/roomViewer';

import { decryptoReview } from '../decryptoReview';
import { toDecryptoReviewDocument } from '../toDecryptoReviewDocument';

const VIEWERS = ['host', 'seated', 'spectator'] as const;

describe('toDecryptoReviewDocument', () => {
  it('records the result, team keywords, both rounds, tiebreak and participants', () => {
    const state = endDecryptoTestGame(buildDecryptoStateForPhase('lobby'));
    const document = toDecryptoReviewDocument({ state, roomCode: '1234' });
    const blocks = document.pages[0]?.blocks;
    if (blocks === undefined) throw new Error('Review has no result page');
    expect(document).toMatchObject({
      roundKey: 'game-1',
      kicker: '解码战 · 第 1 局',
      fileStem: 'decrypto-1234-1',
    });
    expect(blocks).toContainEqual(
      expect.objectContaining({
        kind: 'hero',
        headline: [{ kind: 'text', text: '蓝队获胜' }],
        byline: '共进行 2 轮',
      }),
    );
    expect(blocks).toContainEqual(
      expect.objectContaining({
        kind: 'facts',
        items: [
          { label: '蓝队关键词', value: '苹果 · 桥梁 · 火山 · 钢琴' },
          { label: '紫队关键词', value: '月亮 · 雨伞 · 沙漠 · 冰箱' },
        ],
      }),
    );
    const timeline = blocks.find((block) => block.kind === 'timeline');
    expect(timeline?.kind === 'timeline' ? timeline.steps.map(({ title }) => title) : []).toEqual([
      '第 1 轮',
      '第 2 轮',
      '平局加赛',
    ]);
    const roster = blocks.find((block) => block.kind === 'roster');
    const statuses = roster?.kind === 'roster' ? roster.rows.map(({ status }) => status) : [];
    expect(statuses.filter((status) => status === '获胜')).toHaveLength(2);
    expect(statuses.filter((status) => status === '未获胜')).toHaveLength(2);
  });

  it('uses the game sequence in later-match exports', () => {
    const first = endDecryptoTestGame(buildDecryptoStateForPhase('lobby'));
    const second = endDecryptoTestGame(startDecryptoTestGame(first));
    expect(toDecryptoReviewDocument({ state: second, roomCode: '1234' })).toMatchObject({
      roundKey: 'game-2',
      kicker: '解码战 · 第 2 局',
      fileStem: 'decrypto-1234-2',
    });
  });

  it('fails fast before a game reaches its terminal state', () => {
    expect(() =>
      toDecryptoReviewDocument({
        state: buildDecryptoStateForPhase('playing'),
        roomCode: '1234',
      }),
    ).toThrow('[FAIL-FAST]');
  });
});

describe('decryptoReview', () => {
  it('keeps the review unavailable in every pre-terminal phase', () => {
    const states = DECRYPTO_PHASES.filter((phase) => phase !== 'ended').map((phase) =>
      buildDecryptoStateForPhase(phase),
    );
    expect(states.map((state) => state.phase.kind)).toEqual(
      DECRYPTO_PHASES.filter((phase) => phase !== 'ended'),
    );
    for (const state of states) {
      for (const audience of VIEWERS) {
        expect(
          decryptoReview.resolve({ state, viewer: viewerFor(audience), roomCode: '1234' }),
        ).toEqual({ kind: 'notEnded' });
      }
    }
  });

  it.each(VIEWERS)(
    'opens a shareable, unconfirmed review to the %s after the result',
    (audience) => {
      const state = buildDecryptoStateForPhase('ended');
      expect(
        decryptoReview.resolve({ state, viewer: viewerFor(audience), roomCode: '1234' }),
      ).toEqual({
        kind: 'available',
        document: toDecryptoReviewDocument({ state, roomCode: '1234' }),
        sharing: { isAllowed: true },
        confirmation: null,
      });
    },
  );

  it('reveals both keyword sets only to the host during tiebreak judgement', () => {
    const state = buildDecryptoTiebreakTestGame(buildDecryptoStateForPhase('lobby'));
    if (state.phase.kind !== 'playing') throw new Error('Expected the tiebreak phase');
    const originalKeywords = state.phase.game.keywords;
    if (originalKeywords === null) throw new Error('Expected prepared keywords');
    const hostSnapshot = projectDecryptoStateForUser(state, 'host');
    if (hostSnapshot.phase.kind !== 'playing') throw new Error('Expected host gameplay projection');
    expect(hostSnapshot.phase.game.keywords).toEqual(originalKeywords);
    expect(getDecryptoViewModel(hostSnapshot, 0, true).game?.keywords).toEqual(originalKeywords);

    const humanSeat = Object.entries(state.phase.game.assignments).find(
      ([seat]) => Number(seat) === 1,
    );
    if (humanSeat === undefined) throw new Error('Expected the second human seat');
    const userSnapshot = projectDecryptoStateForUser(state, 'u1');
    if (userSnapshot.phase.kind !== 'playing')
      throw new Error('Expected player gameplay projection');
    const team = humanSeat[1];
    expect(userSnapshot.phase.game.keywords?.[team]).toEqual(originalKeywords[team]);
    expect(userSnapshot.phase.game.keywords?.[team === 'blue' ? 'purple' : 'blue']).not.toEqual(
      originalKeywords[team === 'blue' ? 'purple' : 'blue'],
    );
  });
});
