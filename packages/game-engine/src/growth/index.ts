/**
 * @werewolf/game-engine/growth — 成长体系模块
 *
 * 等级系统 + 随机解锁奖励（头像/头像框）。纯函数，客户端与服务端共用。
 */

export {
  getUnlockedAvatars,
  getUnlockedFlairs,
  getUnlockedFrames,
  isFlairUnlocked,
  isFrameUnlocked,
  pickRandomReward,
} from './frameUnlock';
export {
  getLevel,
  getLevelProgress,
  getLevelTitle,
  LEVEL_THRESHOLDS,
  rollXp,
  XP_BASE,
  XP_RANDOM_MAX,
} from './level';
export {
  AVATAR_IDS,
  type AvatarId,
  type FlairId,
  FRAME_IDS,
  type FrameId,
  FREE_AVATAR_IDS,
  FREE_FLAIR_IDS,
  FREE_FRAME_IDS,
  REWARD_POOL,
  type RewardItem,
  type RewardType,
  SEAT_FLAIR_IDS,
  TOTAL_UNLOCKABLE_COUNT,
} from './rewardCatalog';
