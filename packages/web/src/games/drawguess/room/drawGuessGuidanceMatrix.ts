/**
 * 经典你画我猜（阶段 × 观看者）底部提示矩阵声明：逐格事实以
 * drawGuessGuidanceMatrix.test.ts 用真实引擎流驱动
 * createDrawGuessRoomShellModel 对账为准。格子语义为阶段入口态。
 */
import type { DrawGuessPhase } from '@game-judge/game-engine/games/drawguess/public';

import {
  GUIDANCE_MESSAGE,
  guidanceExempt,
  type RoomGuidanceMatrix,
} from '@/features/room/model/RoomGuidanceMatrix';

export const DRAWGUESS_GUIDANCE_MATRIX: RoomGuidanceMatrix<DrawGuessPhase['kind']> = {
  lobby: {
    host: guidanceExempt('房主由房主面板承载开始动作'),
    seated: GUIDANCE_MESSAGE,
    spectator: guidanceExempt('无座位无个人提示；房间状态归座位盘'),
  },
  wordSelect: {
    host: guidanceExempt('舞台内容：画手在舞台选词，选词倒计时在顶部信息条'),
    seated: guidanceExempt('舞台内容：画手选词，其余人看「正在选词…」，倒计时在顶部信息条'),
    spectator: guidanceExempt('舞台内容：选词进程由舞台与顶部信息条呈现'),
  },
  drawing: {
    host: guidanceExempt('舞台内容：画布与猜词在舞台，题目、分数与作画倒计时在顶部信息条'),
    seated: guidanceExempt('舞台内容：画布与猜词在舞台，题目、分数与作画倒计时在顶部信息条'),
    spectator: guidanceExempt('舞台内容：作画进程由舞台与顶部信息条呈现'),
  },
  roundEnd: {
    host: guidanceExempt('舞台内容：等待本轮结算由顶部信息条的「结算」倒计时承载'),
    seated: guidanceExempt('舞台内容：等待本轮结算由顶部信息条的「结算」倒计时承载'),
    spectator: guidanceExempt('舞台内容：等待本轮结算由顶部信息条的「结算」倒计时承载'),
  },
  ended: {
    host: guidanceExempt('房主由房主面板承载本局复盘 / 再来一局 / 返回大厅'),
    seated: guidanceExempt('终局等待句在终局工作区视图（全平台终局等待句的基准出处）'),
    spectator: guidanceExempt('终局视图全观看者可见'),
  },
};
