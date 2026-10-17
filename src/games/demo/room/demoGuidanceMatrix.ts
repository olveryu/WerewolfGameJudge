/**
 * Demo（生成器样例游戏）（阶段 × 观看者）底部提示矩阵声明：逐格事实以
 * demoGuidanceMatrix.test.ts 用真实引擎流驱动 createDemoRoomShellModel
 * 对账为准。模板生成的游戏以本表为起点声明各自矩阵。
 */
import type { DemoPhaseKind } from '@game-judge/game-engine/games/demo/public';

import {
  GUIDANCE_MESSAGE,
  guidanceExempt,
  type RoomGuidanceMatrix,
} from '@/features/room/model/RoomGuidanceMatrix';

export const DEMO_GUIDANCE_MATRIX: RoomGuidanceMatrix<DemoPhaseKind> = {
  lobby: {
    host: guidanceExempt('房主由房主面板承载分配身份动作'),
    seated: GUIDANCE_MESSAGE,
    spectator: guidanceExempt('无座位无个人提示；房间状态归座位盘'),
  },
  viewing: {
    host: guidanceExempt('房主由房主面板承载开始游戏动作'),
    seated: guidanceExempt('查看动作与阶段说明在 stage 区，查看进度归座位盘勾'),
    spectator: guidanceExempt('身份查看阶段由 stage 区呈现，查看进度归座位盘勾'),
  },
  playing: {
    host: guidanceExempt('玩法阶段界面在 stage 区（模板占位面）'),
    seated: guidanceExempt('玩法阶段界面在 stage 区（模板占位面）'),
    spectator: guidanceExempt('玩法阶段界面在 stage 区（模板占位面）'),
  },
  ended: {
    host: guidanceExempt('房主由房主面板承载再来一局 / 返回大厅'),
    seated: GUIDANCE_MESSAGE,
    spectator: guidanceExempt('终局由 stage 区呈现本局已结束'),
  },
};
