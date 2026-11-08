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
    host: guidanceExempt('投票进度、未投票名单与倒计时都在座位表上方摘要条；去投票走主按钮'),
    seated: guidanceExempt('投票进度、未投票名单与倒计时都在座位表上方摘要条；去投票走主按钮'),
    spectator: guidanceExempt('投票进度、未投票名单与倒计时都在座位表上方摘要条'),
  },
  quest: {
    host: guidanceExempt('出牌进度、未出牌名单与倒计时都在座位表上方摘要条；去出牌走主按钮'),
    seated: guidanceExempt('出牌进度、未出牌名单与倒计时都在座位表上方摘要条；去出牌走主按钮'),
    spectator: guidanceExempt('出牌进度、未出牌名单与倒计时都在座位表上方摘要条'),
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
