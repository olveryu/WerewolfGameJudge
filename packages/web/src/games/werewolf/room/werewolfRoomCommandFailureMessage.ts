/**
 * Werewolf's Chinese copy for engine rejection reasons the platform
 * chassis does not cover; everything else falls through to
 * `translateReasonCode` (which passes Chinese rejection text as-is).
 */

import {
  type GameState,
  REASON_ACTION_INPUT_MISMATCH,
  REASON_ACTION_STEP_CHANGED,
  REASON_DEADLINE_NOT_REACHED,
  REASON_PHASE_NOT_EXPIRABLE,
} from '@game-judge/game-engine/games/werewolf/public';

import { createRoomCommandFailureMessage } from '@/features/room/link/createRoomCommandFailureMessage';

export const getWerewolfRoomCommandFailureMessage = createRoomCommandFailureMessage<GameState>({
  [REASON_PHASE_NOT_EXPIRABLE]: '当前阶段没有倒计时可结算',
  [REASON_DEADLINE_NOT_REACHED]: '倒计时尚未结束',
  [REASON_ACTION_STEP_CHANGED]: '当前行动步骤已变化，请重新选择',
  [REASON_ACTION_INPUT_MISMATCH]: '行动内容与当前步骤不符，请重新选择',
});
