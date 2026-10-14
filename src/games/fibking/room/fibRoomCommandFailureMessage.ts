/** FibKing-owned presentation for domain command rejections. */

import {
  type FibState,
  REASON_FIB_GAME_NOT_ENDED,
  REASON_FIB_NOT_ALL_VIEWED,
  REASON_FIB_OCCUPIED_SEAT_OUT_OF_RANGE,
  REASON_FIB_PLAYER_COUNT_INVALID,
  REASON_FIB_ROUND_ALREADY_ONGOING,
  REASON_FIB_ROUND_MISMATCH,
  REASON_FIB_ROUND_NOT_FULL,
  REASON_FIB_ROUND_NOT_ONGOING,
  REASON_FIB_ROUND_NOT_PREPARING,
  REASON_FIB_ROUND_NOT_VIEWING,
  REASON_FIB_ROUND_SEAT_ALREADY_GUESSED,
  REASON_FIB_WORD_INVALID,
  REASON_FIB_WORD_REUSED,
} from '@game-judge/game-engine/games/fibking/public';

import {
  createRoomCommandFailureMessage,
  ROOM_COMMAND_FAILURE_SEATS_NOT_FULL,
} from '@/features/room/session/createRoomCommandFailureMessage';

export const getFibRoomCommandFailureMessage = createRoomCommandFailureMessage<FibState>({
  [REASON_FIB_GAME_NOT_ENDED]: '当前游戏尚未结束',
  [REASON_FIB_OCCUPIED_SEAT_OUT_OF_RANGE]:
    '目标人数之外的座位仍有真人入座，请先让这些玩家离座或换到空位',
  [REASON_FIB_PLAYER_COUNT_INVALID]: '人数必须是 4 到 20 之间的整数',
  [REASON_FIB_ROUND_NOT_FULL]: ROOM_COMMAND_FAILURE_SEATS_NOT_FULL,
  [REASON_FIB_ROUND_ALREADY_ONGOING]: '本轮已经开始',
  [REASON_FIB_ROUND_NOT_PREPARING]: '当前没有正在准备的轮次',
  [REASON_FIB_ROUND_NOT_ONGOING]: '当前没有进行中的轮次',
  [REASON_FIB_ROUND_NOT_VIEWING]: '当前不在查看身份阶段',
  [REASON_FIB_NOT_ALL_VIEWED]: '还有玩家未查看身份',
  [REASON_FIB_ROUND_SEAT_ALREADY_GUESSED]: '该座位已经选择过',
  [REASON_FIB_ROUND_MISMATCH]: '本轮状态已变化，请等待房间状态刷新',
  [REASON_FIB_WORD_REUSED]: '生成的词语与本房间历史词语重复，请重试',
  [REASON_FIB_WORD_INVALID]: '生成的词语不符合玩法要求，请重试',
});
