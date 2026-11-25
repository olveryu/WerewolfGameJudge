/**
 * Werewolf's Chinese copy for engine rejection reasons the platform
 * chassis does not cover; everything else falls through to
 * `translateReasonCode` (which passes Chinese rejection text as-is).
 */

import {
  type GameState,
  REASON_DEADLINE_NOT_REACHED,
  REASON_PHASE_NOT_EXPIRABLE,
} from '@game-judge/game-engine/games/werewolf/public';

import { createRoomCommandFailureMessage } from '@/features/room/link/createRoomCommandFailureMessage';

export const getWerewolfRoomCommandFailureMessage = createRoomCommandFailureMessage<GameState>({
  [REASON_PHASE_NOT_EXPIRABLE]: '当前阶段没有倒计时可结算',
  [REASON_DEADLINE_NOT_REACHED]: '倒计时尚未结束',
});
