/**
 * 聚会工具命令失败文案的唯一来源。引擎只发稳定英文码（`TOOLBOX_REASONS`）。
 */

import { TOOLBOX_REASONS, type ToolboxView } from '@game-judge/game-engine/games/toolbox/public';

import { createRoomCommandFailureMessage } from '@/features/room/link/createRoomCommandFailureMessage';

const STALE_REFRESH = '房间状态已变化，请查看最新状态后再操作';

/** 把房间命令的失败原因翻译成用户可读的中文。 */
export const getToolboxRoomCommandFailureMessage = createRoomCommandFailureMessage<ToolboxView>({
  [TOOLBOX_REASONS.notMember]: '你还没有进入房间，请刷新后重试',
  [TOOLBOX_REASONS.notHost]: '只有房主可以执行此操作',
  [TOOLBOX_REASONS.alreadyStarted]: '本次使用已开始，不能再修改',
  [TOOLBOX_REASONS.notStarted]: '本次使用还没有开始',
  [TOOLBOX_REASONS.noSeated]: '至少一人入座才能开始',
  [TOOLBOX_REASONS.configInvalid]: '设置有误，请检查后重试',
  [TOOLBOX_REASONS.identityNameDuplicate]: '身份名称不能重复',
  [TOOLBOX_REASONS.noTools]: '请至少选择一个工具',
  [TOOLBOX_REASONS.configChanged]: '房间设置刚刚变化，请确认后再开始',
  [TOOLBOX_REASONS.notEnoughCards]: '身份牌不够每人抽，请增加身份牌数量',
  [TOOLBOX_REASONS.sessionStale]: STALE_REFRESH,
  [TOOLBOX_REASONS.notParticipant]: '你不是本次参与者，只能观看',
  [TOOLBOX_REASONS.diceDisabled]: '本次没有启用骰子',
  [TOOLBOX_REASONS.identityDisabled]: '本次没有启用身份牌',
  [TOOLBOX_REASONS.cupStale]: '骰盅状态已更新，请再试一次',
  [TOOLBOX_REASONS.diceCountInvalid]: '骰子数量需在 1–20 之间',
  [TOOLBOX_REASONS.heldExceedsCount]: '已固定的骰子多于目标数量，请先取消固定',
  [TOOLBOX_REASONS.rollBeforeReveal]: '请先掀开骰盅再摇',
  [TOOLBOX_REASONS.notRolled]: '还没有摇骰',
  [TOOLBOX_REASONS.notRevealed]: '请先掀开骰盅',
  [TOOLBOX_REASONS.dieMissing]: STALE_REFRESH,
  [TOOLBOX_REASONS.holdLimit]: '固定的骰子不能多于目标数量，请先调整数量',
  [TOOLBOX_REASONS.handFull]: '你已经抽满了',
  [TOOLBOX_REASONS.roundStale]: '身份已重开，请在新一轮中抽牌',
});
