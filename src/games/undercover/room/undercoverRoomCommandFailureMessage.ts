/** Chinese presentation of Undercover command failures; transport failures retain shared handling. */
import {
  UNDERCOVER_REASONS,
  type UndercoverState,
} from '@game-judge/game-engine/games/undercover/public';

import {
  createRoomCommandFailureMessage,
  ROOM_COMMAND_FAILURE_OCCUPIED_OUT_OF_RANGE_WITH_MOVE,
  ROOM_COMMAND_FAILURE_SEATS_NOT_FULL,
  ROOM_COMMAND_FAILURE_WRONG_PHASE,
} from '@/features/room/session/createRoomCommandFailureMessage';

export const getUndercoverRoomCommandFailureMessage =
  createRoomCommandFailureMessage<UndercoverState>({
    [UNDERCOVER_REASONS.phase]: ROOM_COMMAND_FAILURE_WRONG_PHASE,
    [UNDERCOVER_REASONS.config]: '人数需为 4 至 12 人；启用白板至少需要 6 人',
    [UNDERCOVER_REASONS.occupied]: ROOM_COMMAND_FAILURE_OCCUPIED_OUT_OF_RANGE_WITH_MOVE,
    [UNDERCOVER_REASONS.notFull]: ROOM_COMMAND_FAILURE_SEATS_NOT_FULL,
    [UNDERCOVER_REASONS.round]: '对局已变化，请等待房间状态刷新',
    [UNDERCOVER_REASONS.alreadyRevealed]: '该玩家已经出局',
    [UNDERCOVER_REASONS.word]: '词对不符合当前设置，请重新准备',
    [UNDERCOVER_REASONS.reused]: '该词对已使用，请重新准备',
    [UNDERCOVER_REASONS.bot]: '该操作只能接管机器人座位',
    [UNDERCOVER_REASONS.failure]: '准备结果无效，请重新准备',
  });
