/**
 * @werewolf/game-engine/growth — 成长体系模块
 *
 * 等级系统 + 随机解锁奖励（头像/头像框）+ 扭蛋概率引擎。纯函数，客户端与服务端共用。
 */

export {
  getUnlockedAvatars,
  getUnlockedFlairs,
  getUnlockedFrames,
  getUnlockedNameStyles,
  getUnlockedRoleRevealEffects,
  isFlairUnlocked,
  isFrameUnlocked,
  isNameStyleUnlocked,
  isRoleRevealEffectUnlocked,
  pickRandomReward,
} from './frameUnlock';
export {
  type DrawType,
  GOLDEN_RATES,
  NORMAL_RATES,
  PITY_THRESHOLD,
  rollRarity,
  selectReward,
} from './gachaProbability';
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
  FREE_NAME_STYLE_IDS,
  FREE_ROLE_REVEAL_EFFECT_IDS,
  getItemRarity,
  LEGENDARY_FRAME_IDS,
  NAME_STYLE_IDS,
  type NameStyleId,
  type Rarity,
  REWARD_POOL,
  type RewardItem,
  type RewardType,
  ROLE_REVEAL_EFFECT_IDS,
  type RoleRevealEffectId,
  SEAT_FLAIR_IDS,
  TOTAL_UNLOCKABLE_COUNT,
} from './rewardCatalog';
