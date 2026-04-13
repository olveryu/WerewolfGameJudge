/**
 * rewardCatalog — 可解锁物品 ID 注册表（唯一权威来源）
 *
 * 头像 ID 和头像框 ID 在此集中定义，客户端和服务端共用。
 * 客户端 `avatar.ts` 和 `avatarFrames/index.ts` 从此处 import ID 列表。
 * 新增头像/头像框时只需在此追加 + 客户端追加对应图片/组件。
 */

export type RewardType = 'avatar' | 'frame' | 'seatFlair';

export interface RewardItem {
  readonly type: RewardType;
  readonly id: string;
}

/**
 * 全部头像 ID（排序稳定，与资源文件名 1:1 对应）。
 * 包含免费头像 `villager`。
 */
// prettier-ignore
export const AVATAR_IDS = [
  'avenger',
  'awakenedGargoyle',
  'bloodMoon',
  'crow',
  'cursedFox',
  'cupid',
  'dancer',
  'darkWolfKing',
  'dreamcatcher',
  'drunkSeer',
  'gargoyle',
  'graveyardKeeper',
  'guard',
  'hunter',
  'idiot',
  'knight',
  'magician',
  'maskedMan',
  'masquerade',
  'mirrorSeer',
  'nightmare',
  'piper',
  'poisoner',
  'psychic',
  'pureWhite',
  'seer',
  'shadow',
  'silenceElder',
  'slacker',
  'spiritKnight',
  'thief',
  'treasureMaster',
  'villager',
  'votebanElder',
  'warden',
  'wildChild',
  'witch',
  'witcher',
  'wolf',
  'wolfKing',
  'wolfQueen',
  'wolfRobot',
  'wolfWitch',
] as const;

/** 全部头像框 ID（与 `avatarFrames/index.ts` Component 注册表 1:1 对应）。 */
// prettier-ignore
export const FRAME_IDS = [
  'ironForge',
  'moonSilver',
  'bloodThorn',
  'runicSeal',
  'boneGate',
  'hellFire',
  'darkVine',
  'frostCrystal',
  'pharaohGold',
  'voidRift',
] as const;

/** 全部座位装饰 ID（与 `seatFlairs/index.ts` Component 注册表 1:1 对应）。 */
// prettier-ignore
export const SEAT_FLAIR_IDS = [
  'emberGlow',
  'frostAura',
  'shadowMist',
  'goldenShine',
  'bloodMark',
  'starlight',
  'thunderBolt',
  'sakura',
  'runeCircle',
  'fireRing',
  'lunarHalo',
  'sonicWave',
  'cometTail',
  'iceCrystal',
  'phoenixFeather',
  'ghostWisp',
  'poisonBubble',
  'magmaFloat',
  'windGust',
  'snowfall',
  'goldSpark',
  'purpleMist',
  'butterfly',
  'lightPillar',
  'shadowClaw',
  'rainDrop',
  'flowerBloom',
  'firefly',
  'forestLeaf',
  'prismShard',
] as const;

/** 头像 ID literal union */
export type AvatarId = (typeof AVATAR_IDS)[number];

/** 头像框 ID literal union */
export type FrameId = (typeof FRAME_IDS)[number];

/** 座位装饰 ID literal union */
export type FlairId = (typeof SEAT_FLAIR_IDS)[number];

/** 注册即得的免费头像 ID */
export const FREE_AVATAR_IDS: ReadonlySet<string> = new Set(['villager']);

/** 注册即得的免费头像框 ID（无） */
export const FREE_FRAME_IDS: ReadonlySet<string> = new Set<string>();

/** 注册即得的免费座位装饰 ID（无） */
export const FREE_FLAIR_IDS: ReadonlySet<string> = new Set<string>();

/**
 * 可抽奖励池（全部可解锁物品 - 免费物品）。
 * 服务端升级时从此池中排除已解锁 → 随机抽取。
 */
export const REWARD_POOL: readonly RewardItem[] = [
  ...AVATAR_IDS.filter((id) => !FREE_AVATAR_IDS.has(id)).map(
    (id) => ({ type: 'avatar', id }) as const,
  ),
  ...FRAME_IDS.filter((id) => !FREE_FRAME_IDS.has(id)).map(
    (id) => ({ type: 'frame', id }) as const,
  ),
  ...SEAT_FLAIR_IDS.filter((id) => !FREE_FLAIR_IDS.has(id)).map(
    (id) => ({ type: 'seatFlair', id }) as const,
  ),
];

/** 免费物品总数 */
export const FREE_ITEM_COUNT = FREE_AVATAR_IDS.size + FREE_FRAME_IDS.size + FREE_FLAIR_IDS.size;

/** 全部可获得物品总数（含免费） */
export const TOTAL_UNLOCKABLE_COUNT = REWARD_POOL.length + FREE_ITEM_COUNT;
