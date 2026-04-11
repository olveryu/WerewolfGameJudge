/**
 * @werewolf/game-engine/growth — 成长体系模块
 *
 * 等级系统 + 等级解锁奖励（头像/头像框）。纯函数，客户端与服务端共用。
 */

export {
  FREE_REWARDS,
  getLevelReward,
  getUnlockedAvatars,
  getUnlockedFrames,
  isFrameUnlocked,
  LEVEL_REWARDS,
  type LevelReward,
  type RewardType,
} from './frameUnlock';
export {
  getLevel,
  getLevelProgress,
  LEVEL_THRESHOLDS,
  rollXp,
  XP_BASE,
  XP_RANDOM_MAX,
} from './level';
