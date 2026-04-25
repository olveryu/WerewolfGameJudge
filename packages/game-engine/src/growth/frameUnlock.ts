/**
 * frameUnlock — 解锁查询与随机抽取
 *
 * 数据来自 `rewardCatalog.ts`（唯一权威 ID 注册表）。
 * 本模块提供：已解锁集合查询、随机抽取、免费物品判断。
 * 纯函数，客户端与服务端共用。
 */

import {
  FREE_AVATAR_IDS,
  FREE_FLAIR_IDS,
  FREE_FRAME_IDS,
  FREE_NAME_STYLE_IDS,
  FREE_ROLE_REVEAL_EFFECT_IDS,
  REWARD_POOL,
  REWARD_POOL_BY_ID,
  type RewardItem,
  type RewardType,
} from './rewardCatalog';

/**
 * 从未解锁池中随机抽取一个奖励。
 *
 * 规则：每 5 级优先头像框，每 3 级优先座位装饰，每 7 级优先名字特效，其余级别优先头像。
 * 如果目标类型池已空，fallback 到任意未解锁物品。
 *
 * @param unlockedIds - 玩家已解锁的 id 集合（含免费物品）
 * @param randomFn - 返回 [0, max) 整数的随机函数（服务端用 crypto）
 * @param level - 本次升到的等级（决定抽取类型）
 * @returns 抽中的奖励，池空则 undefined
 */
export function pickRandomReward(
  unlockedIds: ReadonlySet<string>,
  randomFn: (max: number) => number,
  level: number,
): RewardItem | undefined {
  const preferredType: RewardType =
    level % 5 === 0
      ? 'frame'
      : level % 7 === 0
        ? 'nameStyle'
        : level % 11 === 0
          ? 'roleRevealEffect'
          : level % 3 === 0
            ? 'seatFlair'
            : 'avatar';
  const preferred = REWARD_POOL.filter(
    (item) => item.type === preferredType && !unlockedIds.has(item.id),
  );
  if (preferred.length > 0) return preferred[randomFn(preferred.length)];

  // Fallback: 目标类型已抽完，从任意未解锁物品抽
  const fallback = REWARD_POOL.filter((item) => !unlockedIds.has(item.id));
  if (fallback.length === 0) return undefined;
  return fallback[randomFn(fallback.length)];
}

/** 已解锁头像 id 集合（免费 + 玩家解锁的 avatar 类型） */
export function getUnlockedAvatars(unlockedIds: readonly string[]): ReadonlySet<string> {
  const set = new Set<string>(FREE_AVATAR_IDS);
  for (const id of unlockedIds) {
    if (REWARD_POOL_BY_ID.get(id)?.type === 'avatar') set.add(id);
  }
  return set;
}

/** 已解锁头像框 id 集合（免费 + 玩家解锁的 frame 类型） */
export function getUnlockedFrames(unlockedIds: readonly string[]): ReadonlySet<string> {
  const set = new Set<string>(FREE_FRAME_IDS);
  for (const id of unlockedIds) {
    if (REWARD_POOL_BY_ID.get(id)?.type === 'frame') set.add(id);
  }
  return set;
}

/** 头像框是否已解锁 */
export function isFrameUnlocked(frameId: string, unlockedIds: readonly string[]): boolean {
  return getUnlockedFrames(unlockedIds).has(frameId);
}

/** 已解锁座位装饰 id 集合（免费 + 玩家解锁的 seatFlair 类型） */
export function getUnlockedFlairs(unlockedIds: readonly string[]): ReadonlySet<string> {
  const set = new Set<string>(FREE_FLAIR_IDS);
  for (const id of unlockedIds) {
    if (REWARD_POOL_BY_ID.get(id)?.type === 'seatFlair') set.add(id);
  }
  return set;
}

/** 座位装饰是否已解锁 */
export function isFlairUnlocked(flairId: string, unlockedIds: readonly string[]): boolean {
  return getUnlockedFlairs(unlockedIds).has(flairId);
}

/** 已解锁名字特效 id 集合（免费 + 玩家解锁的 nameStyle 类型） */
export function getUnlockedNameStyles(unlockedIds: readonly string[]): ReadonlySet<string> {
  const set = new Set<string>(FREE_NAME_STYLE_IDS);
  for (const id of unlockedIds) {
    if (REWARD_POOL_BY_ID.get(id)?.type === 'nameStyle') set.add(id);
  }
  return set;
}

/** 名字特效是否已解锁 */
export function isNameStyleUnlocked(nameStyleId: string, unlockedIds: readonly string[]): boolean {
  return getUnlockedNameStyles(unlockedIds).has(nameStyleId);
}

/** 已解锁开牌特效 id 集合（免费 + 玩家解锁的 roleRevealEffect 类型） */
export function getUnlockedRoleRevealEffects(unlockedIds: readonly string[]): ReadonlySet<string> {
  const set = new Set<string>(FREE_ROLE_REVEAL_EFFECT_IDS);
  for (const id of unlockedIds) {
    if (REWARD_POOL_BY_ID.get(id)?.type === 'roleRevealEffect') set.add(id);
  }
  return set;
}

/** 开牌特效是否已解锁 */
export function isRoleRevealEffectUnlocked(
  effectId: string,
  unlockedIds: readonly string[],
): boolean {
  return getUnlockedRoleRevealEffects(unlockedIds).has(effectId);
}
