/**
 * frameUnlock — 解锁查询与随机抽取
 *
 * 数据来自 `rewardCatalog.ts`（唯一权威 ID 注册表）。
 * 本模块提供：已解锁集合查询、随机抽取、免费物品判断。
 * 纯函数，客户端与服务端共用。
 */

import { FREE_AVATAR_IDS, FREE_FRAME_IDS, REWARD_POOL, type RewardItem } from './rewardCatalog';

/**
 * 从未解锁池中随机抽取一个奖励。
 *
 * @param unlockedIds - 玩家已解锁的 id 集合（含免费物品）
 * @param randomFn - 返回 [0, max) 整数的随机函数（服务端用 crypto）
 * @returns 抽中的奖励，池空则 undefined
 */
export function pickRandomReward(
  unlockedIds: ReadonlySet<string>,
  randomFn: (max: number) => number,
): RewardItem | undefined {
  const available = REWARD_POOL.filter((item) => !unlockedIds.has(item.id));
  if (available.length === 0) return undefined;
  return available[randomFn(available.length)];
}

/** 已解锁头像 id 集合（免费 + 玩家解锁的 avatar 类型） */
export function getUnlockedAvatars(unlockedIds: readonly string[]): ReadonlySet<string> {
  const set = new Set<string>(FREE_AVATAR_IDS);
  for (const id of unlockedIds) {
    const item = REWARD_POOL.find((r) => r.id === id);
    if (item?.type === 'avatar') set.add(id);
  }
  return set;
}

/** 已解锁头像框 id 集合（免费 + 玩家解锁的 frame 类型） */
export function getUnlockedFrames(unlockedIds: readonly string[]): ReadonlySet<string> {
  const set = new Set<string>(FREE_FRAME_IDS);
  for (const id of unlockedIds) {
    const item = REWARD_POOL.find((r) => r.id === id);
    if (item?.type === 'frame') set.add(id);
  }
  return set;
}

/** 头像框是否已解锁 */
export function isFrameUnlocked(frameId: string, unlockedIds: readonly string[]): boolean {
  return getUnlockedFrames(unlockedIds).has(frameId);
}
