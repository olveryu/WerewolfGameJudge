/**
 * 聚会工具（阶段 × 观看者）底部提示矩阵。准备阶段的入座状态由工作区中央的
 * 大号状态卡承载；底部只给已入座的非房主一句「等待房主开始」。使用中的
 * 一切交互都在工作区的骰盅 / 身份牌里。
 */
import type { ToolboxView } from '@game-judge/game-engine/games/toolbox/public';

import {
  GUIDANCE_MESSAGE,
  guidanceExempt,
  type RoomGuidanceMatrix,
} from '@/features/room/model/RoomGuidanceMatrix';

export const TOOLBOX_GUIDANCE_MATRIX: RoomGuidanceMatrix<ToolboxView['phase']['kind']> = {
  preparing: {
    host: guidanceExempt('房主由房主面板承载开始动作'),
    seated: GUIDANCE_MESSAGE,
    spectator: guidanceExempt('入座引导由工作区中央的入座状态卡与底部入座按钮承载'),
  },
  active: {
    host: guidanceExempt('骰盅与身份牌在工作区'),
    seated: guidanceExempt('骰盅与身份牌在工作区'),
    spectator: guidanceExempt('工作区显示本次使用中，后进来的玩家只观看'),
  },
};
