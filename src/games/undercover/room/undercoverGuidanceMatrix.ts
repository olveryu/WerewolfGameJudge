/**
 * 谁是卧底（阶段 × 观看者）底部提示矩阵声明：逐格事实以
 * undercoverGuidanceMatrix.test.ts 用真实引擎流驱动
 * createUndercoverBottomActions 对账为准。格子语义为阶段入口态。
 */
import type { UndercoverState } from '@game-judge/game-engine/games/undercover/public';

import {
  GUIDANCE_MESSAGE,
  guidanceExempt,
  type RoomGuidanceMatrix,
} from '@/features/room/model/RoomGuidanceMatrix';

export const UNDERCOVER_GUIDANCE_MATRIX: RoomGuidanceMatrix<UndercoverState['phase']> = {
  lobby: {
    host: guidanceExempt('房主由房主面板承载开局动作'),
    seated: GUIDANCE_MESSAGE,
    spectator: guidanceExempt('无座位无个人提示；房间状态归座位盘'),
  },
  preparing: {
    host: GUIDANCE_MESSAGE,
    seated: GUIDANCE_MESSAGE,
    spectator: GUIDANCE_MESSAGE,
  },
  preparationFailed: {
    host: GUIDANCE_MESSAGE,
    seated: GUIDANCE_MESSAGE,
    spectator: GUIDANCE_MESSAGE,
  },
  viewing: {
    host: GUIDANCE_MESSAGE,
    seated: GUIDANCE_MESSAGE,
    spectator: guidanceExempt('旁观无词卡；全员查看进度归座位盘勾'),
  },
  ongoing: {
    host: GUIDANCE_MESSAGE,
    seated: GUIDANCE_MESSAGE,
    spectator: GUIDANCE_MESSAGE,
  },
  aborted: {
    host: GUIDANCE_MESSAGE,
    seated: GUIDANCE_MESSAGE,
    spectator: GUIDANCE_MESSAGE,
  },
  ended: {
    host: guidanceExempt('房主由房主面板承载再来一局 / 返回大厅'),
    seated: guidanceExempt('胜负与身份揭晓归结算区，房主后续动作归房主面板'),
    spectator: guidanceExempt('结算区全观看者可见'),
  },
};
