/**
 * levelRewards — 等级解锁奖励配置
 *
 * Lv.0 免费：villager 头像 + ironForge 头像框。
 * Lv.1–51 每级解锁 1 样东西（头像或头像框），随机穿插分配。
 * 纯数据+查询函数，客户端与服务端共用。
 */

export type RewardType = 'avatar' | 'frame';

export interface LevelReward {
  readonly level: number;
  readonly type: RewardType;
  /** avatar key (matches AVATAR_KEYS) 或 frame id */
  readonly id: string;
}

/**
 * Lv.0 免费奖励（注册即得）。
 * villager 头像 + ironForge 头像框。
 */
export const FREE_REWARDS: readonly LevelReward[] = [
  { level: 0, type: 'avatar', id: 'villager' },
  { level: 0, type: 'frame', id: 'ironForge' },
] as const;

/**
 * Lv.1–51 解锁表。每级 1 个奖励。
 * 9 个头像框均匀穿插（约每 5–6 级 1 个框），42 个头像填充其余等级。
 */
export const LEVEL_REWARDS: readonly LevelReward[] = [
  // Lv.1–5
  { level: 1, type: 'avatar', id: 'seer' },
  { level: 2, type: 'avatar', id: 'wolf' },
  { level: 3, type: 'avatar', id: 'witch' },
  { level: 4, type: 'avatar', id: 'hunter' },
  { level: 5, type: 'frame', id: 'moonSilver' },
  // Lv.6–11
  { level: 6, type: 'avatar', id: 'guard' },
  { level: 7, type: 'avatar', id: 'wolfKing' },
  { level: 8, type: 'avatar', id: 'idiot' },
  { level: 9, type: 'avatar', id: 'knight' },
  { level: 10, type: 'avatar', id: 'piper' },
  { level: 11, type: 'frame', id: 'darkVine' },
  // Lv.12–17
  { level: 12, type: 'avatar', id: 'poisoner' },
  { level: 13, type: 'avatar', id: 'cupid' },
  { level: 14, type: 'avatar', id: 'wolfQueen' },
  { level: 15, type: 'avatar', id: 'psychic' },
  { level: 16, type: 'avatar', id: 'dancer' },
  { level: 17, type: 'frame', id: 'boneGate' },
  // Lv.18–23
  { level: 18, type: 'avatar', id: 'thief' },
  { level: 19, type: 'avatar', id: 'cursedFox' },
  { level: 20, type: 'avatar', id: 'gargoyle' },
  { level: 21, type: 'avatar', id: 'magician' },
  { level: 22, type: 'avatar', id: 'nightmare' },
  { level: 23, type: 'frame', id: 'frostCrystal' },
  // Lv.24–29
  { level: 24, type: 'avatar', id: 'shadow' },
  { level: 25, type: 'avatar', id: 'darkWolfKing' },
  { level: 26, type: 'avatar', id: 'crow' },
  { level: 27, type: 'avatar', id: 'dreamcatcher' },
  { level: 28, type: 'avatar', id: 'mirrorSeer' },
  { level: 29, type: 'frame', id: 'runicSeal' },
  // Lv.30–35
  { level: 30, type: 'avatar', id: 'drunkSeer' },
  { level: 31, type: 'avatar', id: 'wolfRobot' },
  { level: 32, type: 'avatar', id: 'wildChild' },
  { level: 33, type: 'avatar', id: 'spiritKnight' },
  { level: 34, type: 'avatar', id: 'silenceElder' },
  { level: 35, type: 'frame', id: 'pharaohGold' },
  // Lv.36–41
  { level: 36, type: 'avatar', id: 'avenger' },
  { level: 37, type: 'avatar', id: 'maskedMan' },
  { level: 38, type: 'avatar', id: 'wolfWitch' },
  { level: 39, type: 'avatar', id: 'pureWhite' },
  { level: 40, type: 'avatar', id: 'graveyardKeeper' },
  { level: 41, type: 'frame', id: 'bloodThorn' },
  // Lv.42–46
  { level: 42, type: 'avatar', id: 'warden' },
  { level: 43, type: 'avatar', id: 'masquerade' },
  { level: 44, type: 'avatar', id: 'awakenedGargoyle' },
  { level: 45, type: 'avatar', id: 'witcher' },
  { level: 46, type: 'frame', id: 'hellFire' },
  // Lv.47–51
  { level: 47, type: 'avatar', id: 'slacker' },
  { level: 48, type: 'avatar', id: 'votebanElder' },
  { level: 49, type: 'avatar', id: 'treasureMaster' },
  { level: 50, type: 'avatar', id: 'bloodMoon' },
  { level: 51, type: 'frame', id: 'voidRift' },
] as const;

/** 所有奖励（含 Lv.0） */
const ALL_REWARDS: readonly LevelReward[] = [...FREE_REWARDS, ...LEVEL_REWARDS];

const REWARD_BY_LEVEL = new Map<number, LevelReward>(LEVEL_REWARDS.map((r) => [r.level, r]));

/** 获取指定等级的解锁奖励（Lv.0 不在此表，用 FREE_REWARDS） */
export function getLevelReward(level: number): LevelReward | undefined {
  return REWARD_BY_LEVEL.get(level);
}

/** 获取当前等级已解锁的所有头像 key 列表 */
export function getUnlockedAvatars(userLevel: number): ReadonlySet<string> {
  const set = new Set<string>();
  for (const r of ALL_REWARDS) {
    if (r.type === 'avatar' && r.level <= userLevel) set.add(r.id);
  }
  return set;
}

/** 获取当前等级已解锁的所有头像框 id 列表 */
export function getUnlockedFrames(userLevel: number): ReadonlySet<string> {
  const set = new Set<string>();
  for (const r of ALL_REWARDS) {
    if (r.type === 'frame' && r.level <= userLevel) set.add(r.id);
  }
  return set;
}

/** 判断头像框是否已解锁（兼容旧 API） */
export function isFrameUnlocked(frameId: string, userLevel: number): boolean {
  return getUnlockedFrames(userLevel).has(frameId);
}
