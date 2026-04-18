/**
 * rewardCatalog — 可解锁物品 ID 注册表（唯一权威来源）
 *
 * 头像 ID 和头像框 ID 在此集中定义，客户端和服务端共用。
 * 客户端 `avatar.ts` 和 `avatarFrames/index.ts` 从此处 import ID 列表。
 * 新增头像/头像框时只需在此追加 + 客户端追加对应图片/组件。
 */

export type RewardType = 'avatar' | 'frame' | 'seatFlair' | 'nameStyle';

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface RewardItem {
  readonly type: RewardType;
  readonly id: string;
  readonly rarity: Rarity;
}

/**
 * 全部头像 ID（排序稳定，与资源文件名 1:1 对应）。
 * 无头像时显示 wolf-paw 默认图标（不在此列表中）。
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
  'stormBolt',
  'sakuraDrift',
  'dragonScale',
  'jadeSeal',
  'starNebula',
  'shadowWeave',
  'coralReef',
  'emberAsh',
  'celestialRing',
  'obsidianEdge',
  // Common — simple colored frames (5 shapes × 10 colors = 50)
  'roundRed', 'roundOrange', 'roundAmber', 'roundGreen', 'roundTeal',
  'roundBlue', 'roundIndigo', 'roundPurple', 'roundPink', 'roundGray',
  'squareRed', 'squareOrange', 'squareAmber', 'squareGreen', 'squareTeal',
  'squareBlue', 'squareIndigo', 'squarePurple', 'squarePink', 'squareGray',
  'octagonRed', 'octagonOrange', 'octagonAmber', 'octagonGreen', 'octagonTeal',
  'octagonBlue', 'octagonIndigo', 'octagonPurple', 'octagonPink', 'octagonGray',
  'dashRed', 'dashOrange', 'dashAmber', 'dashGreen', 'dashTeal',
  'dashBlue', 'dashIndigo', 'dashPurple', 'dashPink', 'dashGray',
  'doubleRed', 'doubleOrange', 'doubleAmber', 'doubleGreen', 'doubleTeal',
  'doubleBlue', 'doubleIndigo', 'doublePurple', 'doublePink', 'doubleGray',
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
  // Common — simple colored effects (5 patterns × 10 colors = 50)
  'pulseRed', 'pulseOrange', 'pulseAmber', 'pulseGreen', 'pulseTeal',
  'pulseBlue', 'pulseIndigo', 'pulsePurple', 'pulsePink', 'pulseGray',
  'glowRed', 'glowOrange', 'glowAmber', 'glowGreen', 'glowTeal',
  'glowBlue', 'glowIndigo', 'glowPurple', 'glowPink', 'glowGray',
  'sparkleRed', 'sparkleOrange', 'sparkleAmber', 'sparkleGreen', 'sparkleTeal',
  'sparkleBlue', 'sparkleIndigo', 'sparklePurple', 'sparklePink', 'sparkleGray',
  'breatheRed', 'breatheOrange', 'breatheAmber', 'breatheGreen', 'breatheTeal',
  'breatheBlue', 'breatheIndigo', 'breathePurple', 'breathePink', 'breatheGray',
  'floatRed', 'floatOrange', 'floatAmber', 'floatGreen', 'floatTeal',
  'floatBlue', 'floatIndigo', 'floatPurple', 'floatPink', 'floatGray',
] as const;

/** 全部名字特效 ID（与 `nameStyles/index.ts` 配置注册表 1:1 对应）。 */
// prettier-ignore
export const NAME_STYLE_IDS = [
  'silverGleam',
  'copperEmber',
  'bloodMoonGlow',
  'jadeShimmer',
  'amethystGlow',
  'indigoRadiance',
  'twilightGradient',
  'roseGold',
  'frostVeil',
  'amberFlare',
  'moltenGoldPulse',
  'frostBreath',
  'venomShift',
  'shadowPulse',
  'crimsonTide',
  'stormElectric',
  'phoenixRebirth',
  'voidStar',
  'dragonBreath',
  'celestialDawn',
  // Common — simple single-color text styling (50)
  'plainCrimson', 'plainCoral', 'plainSalmon', 'plainRose', 'plainBlush',
  'plainTangerine', 'plainApricot', 'plainPeach', 'plainAmber', 'plainHoney',
  'plainSunbeam', 'plainMarigold', 'plainLemon', 'plainCanary', 'plainButtercup',
  'plainMint', 'plainSage', 'plainOlive', 'plainFern', 'plainMoss',
  'plainSky', 'plainAzure', 'plainCobalt', 'plainNavy', 'plainSteel',
  'plainLavender', 'plainOrchid', 'plainPlum', 'plainViolet', 'plainIris',
  'plainMagenta', 'plainFuchsia', 'plainBerry', 'plainWine', 'plainRuby',
  'plainIvory', 'plainPearl', 'plainCream', 'plainSnow', 'plainCloud',
  'plainSlate', 'plainGraphite', 'plainAsh', 'plainSmoke', 'plainCharcoal',
  'plainCopper', 'plainBronze', 'plainRust', 'plainCinnamon', 'plainChestnut',
] as const;

/** 头像 ID literal union */
export type AvatarId = (typeof AVATAR_IDS)[number];

/** 头像框 ID literal union */
export type FrameId = (typeof FRAME_IDS)[number];

/** 座位装饰 ID literal union */
export type FlairId = (typeof SEAT_FLAIR_IDS)[number];

/** 名字特效 ID literal union */
export type NameStyleId = (typeof NAME_STYLE_IDS)[number];

/** 注册即得的免费头像 ID */
export const FREE_AVATAR_IDS: ReadonlySet<string> = new Set<string>();

/** 注册即得的免费头像框 ID（无） */
export const FREE_FRAME_IDS: ReadonlySet<string> = new Set<string>();

/** 注册即得的免费座位装饰 ID（无） */
export const FREE_FLAIR_IDS: ReadonlySet<string> = new Set<string>();

/** 注册即得的免费名字特效 ID（无） */
export const FREE_NAME_STYLE_IDS: ReadonlySet<string> = new Set<string>();

/** 头像稀有度映射 */
const AVATAR_RARITY: Record<string, Rarity> = {
  // Legendary (3)
  darkWolfKing: 'legendary',
  nightmare: 'legendary',
  masquerade: 'legendary',
  // Epic (7)
  wolfKing: 'epic',
  wolfQueen: 'epic',
  bloodMoon: 'epic',
  spiritKnight: 'epic',
  awakenedGargoyle: 'epic',
  witch: 'epic',
  seer: 'epic',
  // Rare (14)
  hunter: 'rare',
  guard: 'rare',
  knight: 'rare',
  magician: 'rare',
  piper: 'rare',
  poisoner: 'rare',
  gargoyle: 'rare',
  dreamcatcher: 'rare',
  avenger: 'rare',
  mirrorSeer: 'rare',
  psychic: 'rare',
  cursedFox: 'rare',
  witcher: 'rare',
  wolfWitch: 'rare',
  // Common (18) — everything else
};

/** 头像框稀有度映射 */
const FRAME_RARITY: Record<string, Rarity> = {
  // Legendary (5)
  starNebula: 'legendary',
  celestialRing: 'legendary',
  dragonScale: 'legendary',
  stormBolt: 'legendary',
  shadowWeave: 'legendary',
  // Epic (3)
  voidRift: 'epic',
  jadeSeal: 'epic',
  hellFire: 'epic',
  // Rare (12)
  ironForge: 'rare',
  moonSilver: 'rare',
  bloodThorn: 'rare',
  runicSeal: 'rare',
  pharaohGold: 'rare',
  sakuraDrift: 'rare',
  boneGate: 'rare',
  darkVine: 'rare',
  frostCrystal: 'rare',
  coralReef: 'rare',
  emberAsh: 'rare',
  obsidianEdge: 'rare',
  // Common (50) — simple colored frames
};

/** 座位装饰稀有度映射 */
const FLAIR_RARITY: Record<string, Rarity> = {
  // Legendary (2)
  runeCircle: 'legendary',
  prismShard: 'legendary',
  // Epic (7)
  lightPillar: 'epic',
  thunderBolt: 'epic',
  cometTail: 'epic',
  starlight: 'epic',
  fireRing: 'epic',
  magmaFloat: 'epic',
  sonicWave: 'epic',
  // Rare (21)
  emberGlow: 'rare',
  frostAura: 'rare',
  shadowMist: 'rare',
  goldenShine: 'rare',
  bloodMark: 'rare',
  sakura: 'rare',
  iceCrystal: 'rare',
  ghostWisp: 'rare',
  poisonBubble: 'rare',
  windGust: 'rare',
  snowfall: 'rare',
  goldSpark: 'rare',
  butterfly: 'rare',
  shadowClaw: 'rare',
  rainDrop: 'rare',
  flowerBloom: 'rare',
  firefly: 'rare',
  forestLeaf: 'rare',
  phoenixFeather: 'rare',
  lunarHalo: 'rare',
  purpleMist: 'rare',
  // Common (50) — simple colored effects
};

/** 名字样式稀有度映射 */
const NAME_STYLE_RARITY: Record<string, Rarity> = {
  // Legendary (4)
  celestialDawn: 'legendary',
  voidStar: 'legendary',
  phoenixRebirth: 'legendary',
  dragonBreath: 'legendary',
  // Epic (6)
  stormElectric: 'epic',
  moltenGoldPulse: 'epic',
  frostBreath: 'epic',
  venomShift: 'epic',
  shadowPulse: 'epic',
  crimsonTide: 'epic',
  // Rare (10)
  silverGleam: 'rare',
  copperEmber: 'rare',
  bloodMoonGlow: 'rare',
  jadeShimmer: 'rare',
  amethystGlow: 'rare',
  indigoRadiance: 'rare',
  twilightGradient: 'rare',
  roseGold: 'rare',
  frostVeil: 'rare',
  amberFlare: 'rare',
  // Common (50) — simple single-color text styling
};

/** 按 ID 查稀有度（avatar/frame/flair/nameStyle 统一查询） */
export function getItemRarity(id: string): Rarity {
  return (
    AVATAR_RARITY[id] ?? FRAME_RARITY[id] ?? FLAIR_RARITY[id] ?? NAME_STYLE_RARITY[id] ?? 'common'
  );
}

/**
 * 可抽奖励池（全部可解锁物品 - 免费物品）。
 * 服务端升级时从此池中排除已解锁 → 随机抽取。
 */
export const REWARD_POOL: readonly RewardItem[] = [
  ...AVATAR_IDS.filter((id) => !FREE_AVATAR_IDS.has(id)).map(
    (id) => ({ type: 'avatar', id, rarity: AVATAR_RARITY[id] ?? 'common' }) as const,
  ),
  ...FRAME_IDS.filter((id) => !FREE_FRAME_IDS.has(id)).map(
    (id) => ({ type: 'frame', id, rarity: FRAME_RARITY[id] ?? 'common' }) as const,
  ),
  ...SEAT_FLAIR_IDS.filter((id) => !FREE_FLAIR_IDS.has(id)).map(
    (id) => ({ type: 'seatFlair', id, rarity: FLAIR_RARITY[id] ?? 'common' }) as const,
  ),
  ...NAME_STYLE_IDS.filter((id) => !FREE_NAME_STYLE_IDS.has(id)).map(
    (id) => ({ type: 'nameStyle', id, rarity: NAME_STYLE_RARITY[id] ?? 'common' }) as const,
  ),
];

/** 免费物品总数 */
export const FREE_ITEM_COUNT =
  FREE_AVATAR_IDS.size + FREE_FRAME_IDS.size + FREE_FLAIR_IDS.size + FREE_NAME_STYLE_IDS.size;

/** 全部可获得物品总数（含免费） */
export const TOTAL_UNLOCKABLE_COUNT = REWARD_POOL.length + FREE_ITEM_COUNT;
