import type { SecrethitlerPhaseKind } from '@game-judge/game-engine/games/secrethitler/public';

import {
  GUIDANCE_MESSAGE,
  guidanceExempt,
  type RoomGuidanceMatrix,
} from '@/features/room/model/RoomGuidanceMatrix';

const activeGuidance = {
  host: GUIDANCE_MESSAGE,
  seated: GUIDANCE_MESSAGE,
  spectator: GUIDANCE_MESSAGE,
};

export const SECRETHITLER_GUIDANCE_MATRIX: RoomGuidanceMatrix<SecrethitlerPhaseKind> = {
  lobby: {
    host: guidanceExempt('房主任务卡承载分配身份动作'),
    seated: GUIDANCE_MESSAGE,
    spectator: guidanceExempt('旁观者从座位盘查看入座进度'),
  },
  viewing: activeGuidance,
  night: activeGuidance,
  election: activeGuidance,
  voting: activeGuidance,
  legislativePresident: activeGuidance,
  legislativeChancellor: activeGuidance,
  vetoResponse: activeGuidance,
  executive: activeGuidance,
  ended: {
    host: guidanceExempt('房主任务卡承载本局复盘、再来一局和返回大厅'),
    seated: GUIDANCE_MESSAGE,
    spectator: guidanceExempt('终局结论与身份由座位盘上方结算面板呈现'),
  },
};
