/**
 * @werewolf/game-engine/growth - Growth system module
 *
 * Level system + random unlock rewards (avatars / avatar frames) + gacha probability engine. Pure functions, shared by client and server.
 */

export {
  getUnlockedAvatars,
  getUnlockedFlairs,
  getUnlockedFrames,
  getUnlockedNameStyles,
  getUnlockedRoleRevealEffects,
  getUnlockedSeatAnimations,
  isFlairUnlocked,
  isFrameUnlocked,
  isNameStyleUnlocked,
  isRoleRevealEffectUnlocked,
  isSeatAnimationUnlocked,
  pickRandomReward,
} from './frameUnlock';
export {
  type DrawType,
  GOLDEN_RATES,
  NORMAL_RATES,
  PITY_THRESHOLD,
  rollRarity,
  selectReward,
  type SelectRewardResult,
} from './gachaProbability';
export {
  getLevel,
  getLevelProgress,
  getLevelTitle,
  LEVEL_THRESHOLDS,
  rollGoldenDraws,
  rollNormalDraws,
  rollXp,
  XP_BASE,
  XP_RANDOM_BASE,
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
  FREE_SEAT_ANIMATION_IDS,
  getItemRarity,
  LEGENDARY_FRAME_IDS,
  NAME_STYLE_IDS,
  type NameStyleId,
  type Rarity,
  REWARD_POOL,
  REWARD_POOL_BY_ID,
  type RewardItem,
  type RewardType,
  SEAT_ANIMATION_IDS,
  SEAT_FLAIR_IDS,
  type SeatAnimationId,
  SHARD_COSTS,
  SHARD_VALUES,
  TOTAL_UNLOCKABLE_COUNT,
} from './rewardCatalog';
