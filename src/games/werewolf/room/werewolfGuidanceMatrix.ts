/**
 * 狼人杀（状态 × 观看者）底部提示矩阵声明：逐格事实以
 * werewolfGuidanceMatrix.test.ts 对账为准——guide 句经真实的
 * buildWerewolfGuideMessage 派生，再过 createWerewolfRoomShellModel
 * 的三路合成（行动句 / 夜晚等待句 / guide 句）。格子语义为阶段入口态。
 * Day 的引导面是底部专属警长 dock（非 message），故声明为豁免并在
 * 测试里额外钉住 dock 形态。
 */
import { GameStatus } from '@game-judge/game-engine/games/werewolf/public';

import {
  GUIDANCE_MESSAGE,
  guidanceExempt,
  type RoomGuidanceMatrix,
} from '@/features/room/model/RoomGuidanceMatrix';

export const WEREWOLF_GUIDANCE_MATRIX: RoomGuidanceMatrix<GameStatus> = {
  [GameStatus.Unseated]: {
    host: guidanceExempt('房主由房主面板与座位盘承载入座进度'),
    seated: GUIDANCE_MESSAGE,
    spectator: GUIDANCE_MESSAGE,
  },
  [GameStatus.Seated]: {
    host: guidanceExempt('房主由房主面板承载发牌动作'),
    seated: GUIDANCE_MESSAGE,
    spectator: GUIDANCE_MESSAGE,
  },
  [GameStatus.Assigned]: {
    host: guidanceExempt('房主同为玩家，查看身份由底部查看按钮承载；开始门归房主面板'),
    seated: GUIDANCE_MESSAGE,
    spectator: GUIDANCE_MESSAGE,
  },
  [GameStatus.Ready]: {
    host: guidanceExempt('房主由房主面板承载开始游戏动作'),
    seated: GUIDANCE_MESSAGE,
    spectator: GUIDANCE_MESSAGE,
  },
  [GameStatus.Ongoing]: {
    host: GUIDANCE_MESSAGE,
    seated: GUIDANCE_MESSAGE,
    spectator: GUIDANCE_MESSAGE,
  },
  [GameStatus.Day]: {
    host: guidanceExempt('警长竞选由底部专属 dock 承载（竞选主按钮与详情入口）'),
    seated: guidanceExempt('警长竞选由底部专属 dock 承载（竞选主按钮与详情入口）'),
    spectator: guidanceExempt('警长竞选由底部专属 dock 承载（竞选主按钮与详情入口）'),
  },
  [GameStatus.Ended]: {
    host: GUIDANCE_MESSAGE,
    seated: GUIDANCE_MESSAGE,
    spectator: GUIDANCE_MESSAGE,
  },
};
