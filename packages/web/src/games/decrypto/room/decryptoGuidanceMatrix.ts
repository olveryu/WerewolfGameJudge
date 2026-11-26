/**
 * Decrypto（阶段 × 观看者）底部提示矩阵声明：本表是新游戏的起点声明——
 * 每格要么承诺该阶段入口态底部有一句提示，要么登记豁免理由（指出由哪个
 * 表面承载引导）。生成器已把本表登记进 packages/web/src/__tests__/roomGuidanceMatrix.contract.test.ts
 * 的注册表，并生成 decryptoGuidanceMatrix.test.ts 用真实引擎流驱动本游戏的
 * shell model 逐格对账；玩法阶段落地时两者同步改。
 */
import type { DecryptoPhaseKind } from '@game-judge/game-engine/games/decrypto/public';

import {
  GUIDANCE_MESSAGE,
  guidanceExempt,
  type RoomGuidanceMatrix,
} from '@/features/room/model/RoomGuidanceMatrix';

export const DECRYPTO_GUIDANCE_MATRIX: RoomGuidanceMatrix<DecryptoPhaseKind> = {
  lobby: {
    host: guidanceExempt('房主由房主面板承载开始动作'),
    seated: GUIDANCE_MESSAGE,
    spectator: guidanceExempt('无座位无个人提示；房间状态归座位盘'),
  },
  teams: {
    host: guidanceExempt('强制分队弹窗承载本阶段操作'),
    seated: guidanceExempt('强制分队弹窗承载本阶段状态'),
    spectator: guidanceExempt('强制分队弹窗承载本阶段状态'),
  },
  preparing: {
    host: guidanceExempt('舞台阶段界面在 stage 区'),
    seated: guidanceExempt('舞台阶段界面在 stage 区'),
    spectator: guidanceExempt('舞台阶段界面在 stage 区'),
  },
  playing: {
    host: guidanceExempt('舞台阶段界面在 stage 区'),
    seated: guidanceExempt('舞台阶段界面在 stage 区'),
    spectator: guidanceExempt('舞台阶段界面在 stage 区'),
  },
  ended: {
    host: guidanceExempt('房主由房主面板承载本局复盘和重新开始'),
    seated: GUIDANCE_MESSAGE,
    spectator: guidanceExempt('终局由 stage 区呈现本局已结束'),
  },
};
