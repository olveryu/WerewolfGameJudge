/**
 * 一眼成对本局复盘：文档由真实引擎流打到终局接缝后断言块序列与关键事实；
 * 贡献按阶段 × 观看者断言可用性、分享与确认。
 */
import { SPOTMATCH_PHASES } from '@game-judge/game-engine/games/spotmatch/public';

import type { ReviewRosterRow } from '@/features/room/review/types';
import { viewerFor } from '@/test-utils/roomViewer';
import {
  buildSpotmatchTestLobby,
  endSpotmatchTestGame,
  startSpotmatchTestGame,
} from '@/test-utils/spotmatchState';

import { spotmatchReview } from '../spotmatchReview';
import { toSpotmatchReviewDocument } from '../toSpotmatchReviewDocument';

const VIEWERS = ['host', 'seated', 'spectator'] as const;

function participant(seat: number, name: string): ReviewRosterRow {
  return {
    seat,
    seatTone: 'neutral',
    name,
    role: seat === 0 ? '第 1 名 · 剩余 0 张' : '第 2 名 · 剩余 8 张',
    status: seat === 0 ? '出对 8 · 误点 0' : '出对 0 · 误点 0',
    statusTone: 'muted',
    isOut: false,
  };
}

describe('toSpotmatchReviewDocument', () => {
  it('reviews the ended game on one page: the ended hero, then every participant', () => {
    expect(
      toSpotmatchReviewDocument({
        state: endSpotmatchTestGame(startSpotmatchTestGame(buildSpotmatchTestLobby())),
        roomCode: '1234',
      }),
    ).toEqual({
      roundKey: 'game-1',
      kicker: '一眼成对 · 第 1 局',
      fileStem: 'spotmatch-1234-1',
      footer: '本局复盘由对局记录自动生成',
      isAborted: false,
      pages: [
        {
          key: 'result',
          label: null,
          blocks: [
            {
              kind: 'hero',
              headline: [{ kind: 'text', text: '房主 率先出完' }],
              tone: 'neutral',
              stamps: [],
              byline: '按剩余张数排名，同数并列',
            },
            { kind: 'section', title: '本局出牌' },
            {
              kind: 'roster',
              columns: 1,
              rows: [
                participant(0, '房主'),
                participant(1, '小明'),
                participant(2, '机器人3号'),
                participant(3, '机器人4号'),
              ],
            },
          ],
        },
      ],
    });
  });

  it('keys every game by its own sequence', () => {
    const secondGame = endSpotmatchTestGame(
      startSpotmatchTestGame(
        endSpotmatchTestGame(startSpotmatchTestGame(buildSpotmatchTestLobby())),
      ),
    );
    expect(toSpotmatchReviewDocument({ state: secondGame, roomCode: '1234' })).toMatchObject({
      roundKey: 'game-2',
      kicker: '一眼成对 · 第 2 局',
      fileStem: 'spotmatch-1234-2',
    });
  });

  it('fails fast for a game that has not ended', () => {
    expect(() =>
      toSpotmatchReviewDocument({
        state: startSpotmatchTestGame(buildSpotmatchTestLobby()),
        roomCode: '1234',
      }),
    ).toThrow('[FAIL-FAST]');
  });
});

describe('spotmatchReview', () => {
  it('has nothing to review in any phase before the end', () => {
    const lobby = buildSpotmatchTestLobby();
    const beforeEnd = [lobby, startSpotmatchTestGame(lobby)];
    expect(beforeEnd.map((state) => state.phase.kind)).toEqual(
      SPOTMATCH_PHASES.filter((phase) => phase !== 'ended'),
    );
    for (const state of beforeEnd) {
      for (const audience of VIEWERS) {
        expect(
          spotmatchReview.resolve({ state, viewer: viewerFor(audience), roomCode: '1234' }),
        ).toEqual({ kind: 'notEnded' });
      }
    }
  });

  it.each(VIEWERS)('opens the ended review to the %s, shareable and unconfirmed', (audience) => {
    const state = endSpotmatchTestGame(startSpotmatchTestGame(buildSpotmatchTestLobby()));
    expect(
      spotmatchReview.resolve({ state, viewer: viewerFor(audience), roomCode: '1234' }),
    ).toEqual({
      kind: 'available',
      document: toSpotmatchReviewDocument({ state, roomCode: '1234' }),
      sharing: { isAllowed: true },
      confirmation: null,
    });
  });
});
