/**
 * Demo本局复盘文档：一页——终局结论与参与者名单。事实全部取自引擎的
 * 公开投影（观战视角的 getDemoViewModel），本模块只把事实译成复盘块。
 * TODO(gameplay): 玩法落地后按设计文档补本局事实——胜负进 hero（标题、
 * 色调、出局印章），过程进 timeline / groups，得分进 scoreboard；
 * 长内容按语义分页（每页带 label）。块词汇见 src/features/room/review/types.ts。
 */

import {
  DEMO_GAME_TYPE,
  type DemoState,
  getDemoViewModel,
} from '@game-judge/game-engine/games/demo/public';

import { REVIEW_GENERATED_FOOTER } from '@/features/room/review/reviewCopy';
import type { ReviewRosterRow, RoomReviewDocument } from '@/features/room/review/types';

const ENDED_HEADLINE = '本局结束';
const PARTICIPANTS_TITLE = '参与者';
// TODO(gameplay): 身份列换成本游戏的身份名（终局全公开、座位色调按阵营），
// 状态列换成本局结局（存活 / 出局 / 名次）。
const PARTICIPANT_ROLE = '参与者';
const PARTICIPANT_STATUS = '完成';

/** 参与者名单：观战视角公开的已入座座位（含机器人），按座位号。 */
function participantRows(state: DemoState): readonly ReviewRosterRow[] {
  return getDemoViewModel(state, null).seats.map((seat) => ({
    seat: seat.seat,
    seatTone: 'neutral',
    name: seat.displayName,
    role: PARTICIPANT_ROLE,
    status: PARTICIPANT_STATUS,
    statusTone: 'muted',
    isOut: false,
  }));
}

/** Builds the review of one ended Demo game; a game that has not ended is a construction error. */
export function toDemoReviewDocument(input: {
  readonly state: DemoState;
  readonly roomCode: string;
}): RoomReviewDocument {
  const { state, roomCode } = input;
  if (state.phase.kind !== 'ended') {
    throw new Error(`[FAIL-FAST] Demo review built in phase ${state.phase.kind}`);
  }
  return {
    roundKey: `game-${state.gameSequence}`,
    // TODO(gameplay): 图标与「局」的叫法换成本游戏自己的。
    kicker: `🎮 第 ${state.gameSequence} 局 · 终局`,
    fileStem: `${DEMO_GAME_TYPE}-${roomCode}-${state.gameSequence}`,
    footer: REVIEW_GENERATED_FOOTER,
    isAborted: false,
    pages: [
      {
        key: 'result',
        label: null,
        blocks: [
          {
            kind: 'hero',
            headline: [{ kind: 'text', text: ENDED_HEADLINE }],
            tone: 'neutral',
            stamps: [],
            byline: null,
          },
          { kind: 'section', title: PARTICIPANTS_TITLE },
          { kind: 'roster', columns: 1, rows: participantRows(state) },
        ],
      },
    ],
  };
}
