/**
 * 瞎掰王（阶段 × 观看者）底部提示矩阵声明：逐格事实以
 * fibGuidanceMatrix.test.ts 驱动 createFibBottomActions 对账为准。
 * 本家底部 message 按构造只给非房主（房主恒走房主面板），故 host 列全豁免。
 */
import type { FibPhase } from '@game-judge/game-engine/games/fibking/public';

import {
  GUIDANCE_MESSAGE,
  guidanceExempt,
  type RoomGuidanceMatrix,
} from '@/features/room/model/RoomGuidanceMatrix';

export const FIBKING_GUIDANCE_MATRIX: RoomGuidanceMatrix<FibPhase> = {
  lobby: {
    host: guidanceExempt('房主由房主面板承载分配角色动作'),
    seated: GUIDANCE_MESSAGE,
    spectator: guidanceExempt('无座位无个人提示；房间状态归座位盘'),
  },
  preparing: {
    host: guidanceExempt('房主由房主面板承载准备进度与取消动作'),
    seated: GUIDANCE_MESSAGE,
    spectator: GUIDANCE_MESSAGE,
  },
  preparationFailed: {
    host: guidanceExempt('房主由房主面板承载重新准备等补救动作'),
    seated: GUIDANCE_MESSAGE,
    spectator: GUIDANCE_MESSAGE,
  },
  viewing: {
    host: guidanceExempt('房主由房主面板承载开始门与标记动作'),
    seated: GUIDANCE_MESSAGE,
    spectator: GUIDANCE_MESSAGE,
  },
  ongoing: {
    host: guidanceExempt('房主由房主面板承载揭示等流程动作'),
    seated: guidanceExempt('局中描述与指认由对局工作区与座位盘承载，底部仅常驻查看动作'),
    spectator: guidanceExempt('局中进程由对局工作区与座位盘承载'),
  },
  ended: {
    host: guidanceExempt('房主由房主面板承载再来一局动作'),
    seated: guidanceExempt('结果由结算区与「查看结果」动作承载'),
    spectator: guidanceExempt('结算区全观看者可见'),
  },
};
