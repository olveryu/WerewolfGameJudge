/**
 * 解码战命令失败文案的唯一来源。
 *
 * 引擎只发稳定英文码（`DECRYPTO_REASONS`），匹配走常量引用、不手抄码原文。
 */

import {
  DECRYPTO_REASONS,
  type DecryptoState,
} from '@game-judge/game-engine/games/decrypto/public';

import {
  createRoomCommandFailureMessage,
  ROOM_COMMAND_FAILURE_OCCUPIED_OUT_OF_RANGE,
  ROOM_COMMAND_FAILURE_SEATS_NOT_FULL,
  ROOM_COMMAND_FAILURE_WRONG_PHASE,
} from '@/features/room/link/createRoomCommandFailureMessage';

/** 把房间命令的失败原因翻译成用户可读的中文。 */
export const getDecryptoRoomCommandFailureMessage = createRoomCommandFailureMessage<DecryptoState>({
  [DECRYPTO_REASONS.config]: '配置无效，请检查人数设置',
  [DECRYPTO_REASONS.phase]: ROOM_COMMAND_FAILURE_WRONG_PHASE,
  [DECRYPTO_REASONS.notHostStart]: '只有房主可以开始游戏',
  [DECRYPTO_REASONS.notHostRestart]: '只有房主可以重新开始',
  [DECRYPTO_REASONS.full]: ROOM_COMMAND_FAILURE_SEATS_NOT_FULL,
  [DECRYPTO_REASONS.occupied]: ROOM_COMMAND_FAILURE_OCCUPIED_OUT_OF_RANGE,
  [DECRYPTO_REASONS.notTeamMember]: '只有本局玩家可以执行这个操作',
  [DECRYPTO_REASONS.notEncryptor]: '只有本队出题人可以提交线索',
  [DECRYPTO_REASONS.ineligibleDecoder]: '本队出题人不能参与解码',
  [DECRYPTO_REASONS.invalidClues]: '请填写三条有效线索',
  [DECRYPTO_REASONS.invalidGuess]: '密码猜测无效',
  [DECRYPTO_REASONS.invalidTeam]: '队伍或出题人设置无效',
  [DECRYPTO_REASONS.wordsInvalid]: '词卡或加赛答案无效',
  [DECRYPTO_REASONS.notHostTeams]: '只有房主可以确认分队',
  [DECRYPTO_REASONS.notHostContinue]: '只有房主可以进入下一轮',
  [DECRYPTO_REASONS.notHostJudge]: '只有房主可以判定加赛答案',
  [DECRYPTO_REASONS.revealEarly]: '揭晓尚未完成，请稍候',
});
