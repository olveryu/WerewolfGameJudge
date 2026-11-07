/**
 * Demo本局复盘：文档由真实引擎流打到终局接缝后断言块序列与关键事实；
 * 贡献按阶段 × 观看者断言可用性、分享与确认。
 */
import { DEMO_PHASES } from '@game-judge/game-engine/games/demo/public';

import type { ReviewRosterRow } from '@/features/room/review/types';
import {
  buildDemoTestLobby,
  driveDemoTestCommand,
  endDemoTestGame,
  startDemoTestGame,
} from '@/test-utils/demoState';
import { viewerFor } from '@/test-utils/roomViewer';

import { demoReview } from '../demoReview';
import { toDemoReviewDocument } from '../toDemoReviewDocument';

const VIEWERS = ['host', 'seated', 'spectator'] as const;

function participant(seat: number, name: string): ReviewRosterRow {
  return {
    seat,
    seatTone: 'neutral',
    name,
    role: '参与者',
    status: '完成',
    statusTone: 'muted',
    isOut: false,
  };
}

describe('toDemoReviewDocument', () => {
  it('reviews the ended game on one page: the ended hero, then every participant', () => {
    expect(
      toDemoReviewDocument({
        state: endDemoTestGame(startDemoTestGame(buildDemoTestLobby())),
        roomCode: '1234',
      }),
    ).toEqual({
      roundKey: 'game-1',
      kicker: '🎮 第 1 局 · 终局',
      fileStem: 'demo-1234-1',
      footer: '本局复盘由对局记录自动生成',
      isAborted: false,
      pages: [
        {
          key: 'result',
          label: null,
          blocks: [
            {
              kind: 'hero',
              headline: [{ kind: 'text', text: '本局结束' }],
              tone: 'neutral',
              stamps: [],
              byline: null,
            },
            { kind: 'section', title: '参与者' },
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
    const secondGame = endDemoTestGame(
      startDemoTestGame(endDemoTestGame(startDemoTestGame(buildDemoTestLobby()))),
    );
    expect(toDemoReviewDocument({ state: secondGame, roomCode: '1234' })).toMatchObject({
      roundKey: 'game-2',
      kicker: '🎮 第 2 局 · 终局',
      fileStem: 'demo-1234-2',
    });
  });

  it('fails fast for a game that has not ended', () => {
    expect(() =>
      toDemoReviewDocument({ state: startDemoTestGame(buildDemoTestLobby()), roomCode: '1234' }),
    ).toThrow('[FAIL-FAST]');
  });
});

describe('demoReview', () => {
  it('has nothing to review in any phase before the end', () => {
    const lobby = buildDemoTestLobby();
    const beforeEnd = [
      lobby,
      driveDemoTestCommand(lobby, { type: 'demo.roles.assign' }),
      startDemoTestGame(lobby),
    ];
    expect(beforeEnd.map((state) => state.phase.kind)).toEqual(
      DEMO_PHASES.filter((phase) => phase !== 'ended'),
    );
    for (const state of beforeEnd) {
      for (const audience of VIEWERS) {
        expect(
          demoReview.resolve({ state, viewer: viewerFor(audience), roomCode: '1234' }),
        ).toEqual({ kind: 'notEnded' });
      }
    }
  });

  it.each(VIEWERS)('opens the ended review to the %s, shareable and unconfirmed', (audience) => {
    const state = endDemoTestGame(startDemoTestGame(buildDemoTestLobby()));
    expect(demoReview.resolve({ state, viewer: viewerFor(audience), roomCode: '1234' })).toEqual({
      kind: 'available',
      document: toDemoReviewDocument({ state, roomCode: '1234' }),
      sharing: { isAllowed: true },
      confirmation: null,
    });
  });
});
