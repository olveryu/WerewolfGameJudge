/**
 * 阿瓦隆（阶段 × 观看者）底部提示矩阵声明：逐格事实以
 * avalonGuidanceMatrix.test.ts 用真实引擎流驱动 createAvalonRoomShellModel
 * 对账为准。格子语义为阶段入口态（观看者尚未行动时）。
 */
import type { AvalonPhaseKind } from '@game-judge/game-engine/games/avalon/public';

import {
  GUIDANCE_MESSAGE,
  guidanceExempt,
  type RoomGuidanceMatrix,
} from '@/features/room/model/RoomGuidanceMatrix';

export const AVALON_GUIDANCE_MATRIX: RoomGuidanceMatrix<AvalonPhaseKind> = {
  lobby: {
    host: guidanceExempt('房主由房主面板承载分配与开始动作，底部无个人提示'),
    seated: GUIDANCE_MESSAGE,
    spectator: guidanceExempt('无座位无个人提示；房间状态归摘要条与座位盘'),
  },
  viewing: {
    host: GUIDANCE_MESSAGE,
    seated: GUIDANCE_MESSAGE,
    spectator: guidanceExempt('旁观无个人身份；全员查看进度归座位盘勾'),
  },
  night: {
    host: GUIDANCE_MESSAGE,
    seated: GUIDANCE_MESSAGE,
    spectator: guidanceExempt('步进归底部进度行（全观看者同源派生）；等待句只给有座位的等待者'),
  },
  nominate: {
    host: GUIDANCE_MESSAGE,
    seated: GUIDANCE_MESSAGE,
    spectator: GUIDANCE_MESSAGE,
  },
  vote: {
    host: guidanceExempt('入口由「去投票」主按钮承载；投后底部出已投计数句'),
    seated: guidanceExempt('入口由「去投票」主按钮承载；投后底部出已投计数句'),
    spectator: GUIDANCE_MESSAGE,
  },
  quest: {
    host: guidanceExempt('队员入口由「去出牌」主按钮承载；非队员（含房主）有「等待队员出牌…」句'),
    seated: guidanceExempt('队员入口由「去出牌」主按钮承载；非队员有「等待队员出牌…」句'),
    spectator: GUIDANCE_MESSAGE,
  },
  lady: {
    host: GUIDANCE_MESSAGE,
    seated: GUIDANCE_MESSAGE,
    spectator: GUIDANCE_MESSAGE,
  },
  assassin: {
    host: GUIDANCE_MESSAGE,
    seated: GUIDANCE_MESSAGE,
    spectator: GUIDANCE_MESSAGE,
  },
  ended: {
    host: guidanceExempt('房主由房主面板承载再来一局 / 返回大厅'),
    seated: GUIDANCE_MESSAGE,
    spectator: guidanceExempt('结算归座位表上方结算区，全观看者可见'),
  },
};
