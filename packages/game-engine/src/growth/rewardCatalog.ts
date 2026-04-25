/**
 * rewardCatalog — 可解锁物品 ID 注册表（唯一权威来源）
 *
 * 头像 ID 和头像框 ID 在此集中定义，客户端和服务端共用。
 * 客户端 `avatar.ts` 和 `avatarFrames/index.ts` 从此处 import ID 列表。
 * 新增头像/头像框时只需在此追加 + 客户端追加对应图片/组件。
 */

export type RewardType = 'avatar' | 'frame' | 'seatFlair' | 'nameStyle' | 'roleRevealEffect';

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

/** 传说头像框 ID 集合 — 用于客户端渲染传说动效判定 */
// prettier-ignore
export const LEGENDARY_FRAME_IDS: ReadonlySet<string> = new Set([
  'stormBolt', 'dragonScale', 'starNebula', 'shadowWeave', 'celestialRing',
  'obsidianEdge', 'pharaohGold', 'voidRift', 'coralReef', 'darkVine', 'sakuraDrift',
]);

/** 全部头像框 ID（与 `avatarFrames/index.ts` Component 注册表 1:1 对应）。 */
// prettier-ignore
export const FRAME_IDS = [
  // Epic (9) — hand-crafted themed SVG frames
  'ironForge',
  'moonSilver',
  'bloodThorn',
  'runicSeal',
  'boneGate',
  'hellFire',
  'frostCrystal',
  'jadeSeal',
  'emberAsh',
  // Legendary (11) — most elaborate hand-crafted frames
  'stormBolt',
  'dragonScale',
  'starNebula',
  'shadowWeave',
  'celestialRing',
  'obsidianEdge',
  'pharaohGold',
  'voidRift',
  'coralReef',
  'darkVine',
  'sakuraDrift',
  // Common (100) — 10 shapes × 10 colors, simple single-border geometry
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
  'diamondRed', 'diamondOrange', 'diamondAmber', 'diamondGreen', 'diamondTeal',
  'diamondBlue', 'diamondIndigo', 'diamondPurple', 'diamondPink', 'diamondGray',
  'scallopRed', 'scallopOrange', 'scallopAmber', 'scallopGreen', 'scallopTeal',
  'scallopBlue', 'scallopIndigo', 'scallopPurple', 'scallopPink', 'scallopGray',
  'crossRed', 'crossOrange', 'crossAmber', 'crossGreen', 'crossTeal',
  'crossBlue', 'crossIndigo', 'crossPurple', 'crossPink', 'crossGray',
  'notchRed', 'notchOrange', 'notchAmber', 'notchGreen', 'notchTeal',
  'notchBlue', 'notchIndigo', 'notchPurple', 'notchPink', 'notchGray',
  'bevelRed', 'bevelOrange', 'bevelAmber', 'bevelGreen', 'bevelTeal',
  'bevelBlue', 'bevelIndigo', 'bevelPurple', 'bevelPink', 'bevelGray',
  // Rare (50) — 5 shapes × 10 colors, multi-layer decorative borders
  'inlayRed', 'inlayOrange', 'inlayAmber', 'inlayGreen', 'inlayTeal',
  'inlayBlue', 'inlayIndigo', 'inlayPurple', 'inlayPink', 'inlayGray',
  'gemRed', 'gemOrange', 'gemAmber', 'gemGreen', 'gemTeal',
  'gemBlue', 'gemIndigo', 'gemPurple', 'gemPink', 'gemGray',
  'filigreeRed', 'filigreeOrange', 'filigreeAmber', 'filigreeGreen', 'filigreeTeal',
  'filigreeBlue', 'filigreeIndigo', 'filigreePurple', 'filigreePink', 'filigreeGray',
  'chainRed', 'chainOrange', 'chainAmber', 'chainGreen', 'chainTeal',
  'chainBlue', 'chainIndigo', 'chainPurple', 'chainPink', 'chainGray',
  'grooveRed', 'grooveOrange', 'grooveAmber', 'grooveGreen', 'grooveTeal',
  'grooveBlue', 'grooveIndigo', 'groovePurple', 'groovePink', 'grooveGray',
] as const;

/** 全部座位装饰 ID（与 `seatFlairs/index.ts` Component 注册表 1:1 对应）。 */
// prettier-ignore
export const SEAT_FLAIR_IDS = [
  // Epic (23) — hand-crafted themed SVG flair
  'emberGlow',
  'frostAura',
  'shadowMist',
  'goldenShine',
  'bloodMark',
  'starlight',
  'thunderBolt',
  'sakura',
  'lunarHalo',
  'sonicWave',
  'iceCrystal',
  'phoenixFeather',
  'ghostWisp',
  'poisonBubble',
  'windGust',
  'snowfall',
  'goldSpark',
  'purpleMist',
  'lightPillar',
  'rainDrop',
  'flowerBloom',
  'firefly',
  'forestLeaf',
  // Legendary (7) — most elaborate hand-crafted flair
  'runeCircle',
  'prismShard',
  'fireRing',
  'cometTail',
  'magmaFloat',
  'butterfly',
  'shadowClaw',
  // Common (100) — 10 patterns × 10 colors, simple single-animation
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
  'rippleRed', 'rippleOrange', 'rippleAmber', 'rippleGreen', 'rippleTeal',
  'rippleBlue', 'rippleIndigo', 'ripplePurple', 'ripplePink', 'rippleGray',
  'orbitRed', 'orbitOrange', 'orbitAmber', 'orbitGreen', 'orbitTeal',
  'orbitBlue', 'orbitIndigo', 'orbitPurple', 'orbitPink', 'orbitGray',
  'flickerRed', 'flickerOrange', 'flickerAmber', 'flickerGreen', 'flickerTeal',
  'flickerBlue', 'flickerIndigo', 'flickerPurple', 'flickerPink', 'flickerGray',
  'driftRed', 'driftOrange', 'driftAmber', 'driftGreen', 'driftTeal',
  'driftBlue', 'driftIndigo', 'driftPurple', 'driftPink', 'driftGray',
  'waveRed', 'waveOrange', 'waveAmber', 'waveGreen', 'waveTeal',
  'waveBlue', 'waveIndigo', 'wavePurple', 'wavePink', 'waveGray',
  // Rare (50) — 5 patterns × 10 colors, multi-element decorative animation
  'cascadeRed', 'cascadeOrange', 'cascadeAmber', 'cascadeGreen', 'cascadeTeal',
  'cascadeBlue', 'cascadeIndigo', 'cascadePurple', 'cascadePink', 'cascadeGray',
  'vortexRed', 'vortexOrange', 'vortexAmber', 'vortexGreen', 'vortexTeal',
  'vortexBlue', 'vortexIndigo', 'vortexPurple', 'vortexPink', 'vortexGray',
  'constellationRed', 'constellationOrange', 'constellationAmber', 'constellationGreen', 'constellationTeal',
  'constellationBlue', 'constellationIndigo', 'constellationPurple', 'constellationPink', 'constellationGray',
  'auroraRed', 'auroraOrange', 'auroraAmber', 'auroraGreen', 'auroraTeal',
  'auroraBlue', 'auroraIndigo', 'auroraPurple', 'auroraPink', 'auroraGray',
  'fireflyRed', 'fireflyOrange', 'fireflyAmber', 'fireflyGreen', 'fireflyTeal',
  'fireflyBlue', 'fireflyIndigo', 'fireflyPurple', 'fireflyPink', 'fireflyGray',
] as const;

/** 全部名字特效 ID（与 `nameStyles/index.ts` 配置注册表 1:1 对应）。 */
// prettier-ignore
export const NAME_STYLE_IDS = [
  // Epic (16) — hand-crafted gradient text
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
  // Legendary (4) — gradient + multi-animation
  'phoenixRebirth',
  'voidStar',
  'dragonBreath',
  'celestialDawn',
  // Common (100) — 10 prefixes × 10 colors, single-color + subtle shadow
  'plainCrimson', 'plainCoral', 'plainAmber', 'plainEmerald', 'plainTeal',
  'plainAzure', 'plainIndigo', 'plainViolet', 'plainRose', 'plainSlate',
  'softCrimson', 'softCoral', 'softAmber', 'softEmerald', 'softTeal',
  'softAzure', 'softIndigo', 'softViolet', 'softRose', 'softSlate',
  'mutedCrimson', 'mutedCoral', 'mutedAmber', 'mutedEmerald', 'mutedTeal',
  'mutedAzure', 'mutedIndigo', 'mutedViolet', 'mutedRose', 'mutedSlate',
  'warmCrimson', 'warmCoral', 'warmAmber', 'warmEmerald', 'warmTeal',
  'warmAzure', 'warmIndigo', 'warmViolet', 'warmRose', 'warmSlate',
  'coolCrimson', 'coolCoral', 'coolAmber', 'coolEmerald', 'coolTeal',
  'coolAzure', 'coolIndigo', 'coolViolet', 'coolRose', 'coolSlate',
  'lightCrimson', 'lightCoral', 'lightAmber', 'lightEmerald', 'lightTeal',
  'lightAzure', 'lightIndigo', 'lightViolet', 'lightRose', 'lightSlate',
  'dustyCrimson', 'dustyCoral', 'dustyAmber', 'dustyEmerald', 'dustyTeal',
  'dustyAzure', 'dustyIndigo', 'dustyViolet', 'dustyRose', 'dustySlate',
  'fadedCrimson', 'fadedCoral', 'fadedAmber', 'fadedEmerald', 'fadedTeal',
  'fadedAzure', 'fadedIndigo', 'fadedViolet', 'fadedRose', 'fadedSlate',
  'paleCrimson', 'paleCoral', 'paleAmber', 'paleEmerald', 'paleTeal',
  'paleAzure', 'paleIndigo', 'paleViolet', 'paleRose', 'paleSlate',
  'hazyCrimson', 'hazyCoral', 'hazyAmber', 'hazyEmerald', 'hazyTeal',
  'hazyAzure', 'hazyIndigo', 'hazyViolet', 'hazyRose', 'hazySlate',
  // Rare (50) — 5 prefixes × 10 colors, multi-layer glow
  'shimmerCrimson', 'shimmerCoral', 'shimmerAmber', 'shimmerEmerald', 'shimmerTeal',
  'shimmerAzure', 'shimmerIndigo', 'shimmerViolet', 'shimmerRose', 'shimmerSlate',
  'radiantCrimson', 'radiantCoral', 'radiantAmber', 'radiantEmerald', 'radiantTeal',
  'radiantAzure', 'radiantIndigo', 'radiantViolet', 'radiantRose', 'radiantSlate',
  'brightCrimson', 'brightCoral', 'brightAmber', 'brightEmerald', 'brightTeal',
  'brightAzure', 'brightIndigo', 'brightViolet', 'brightRose', 'brightSlate',
  'vividCrimson', 'vividCoral', 'vividAmber', 'vividEmerald', 'vividTeal',
  'vividAzure', 'vividIndigo', 'vividViolet', 'vividRose', 'vividSlate',
  'lustrousCrimson', 'lustrousCoral', 'lustrousAmber', 'lustrousEmerald', 'lustrousTeal',
  'lustrousAzure', 'lustrousIndigo', 'lustrousViolet', 'lustrousRose', 'lustrousSlate',
] as const;

/** 全部开牌特效 ID（与 RoleRevealAnimation 中的 RandomizableAnimation 1:1 对应）。 */
// prettier-ignore
export const ROLE_REVEAL_EFFECT_IDS = [
  'roulette',
  'roleHunt',
  'scratch',
  'tarot',
  'gachaMachine',
  'cardPick',
  'sealBreak',
  'chainShatter',
  'fortuneWheel',
  'meteorStrike',
  'filmRewind',
  'vortexCollapse',
] as const;

/** 头像 ID literal union */
export type AvatarId = (typeof AVATAR_IDS)[number];

/** 头像框 ID literal union */
export type FrameId = (typeof FRAME_IDS)[number];

/** 座位装饰 ID literal union */
export type FlairId = (typeof SEAT_FLAIR_IDS)[number];

/** 名字特效 ID literal union */
export type NameStyleId = (typeof NAME_STYLE_IDS)[number];

/** 开牌特效 ID literal union */
export type RoleRevealEffectId = (typeof ROLE_REVEAL_EFFECT_IDS)[number];

/** 注册即得的免费头像 ID */
export const FREE_AVATAR_IDS: ReadonlySet<string> = new Set<string>();

/** 注册即得的免费头像框 ID（无） */
export const FREE_FRAME_IDS: ReadonlySet<string> = new Set<string>();

/** 注册即得的免费座位装饰 ID（无） */
export const FREE_FLAIR_IDS: ReadonlySet<string> = new Set<string>();

/** 注册即得的免费名字特效 ID（无） */
export const FREE_NAME_STYLE_IDS: ReadonlySet<string> = new Set<string>();

/** 注册即得的免费开牌特效 ID（无） */
export const FREE_ROLE_REVEAL_EFFECT_IDS: ReadonlySet<string> = new Set<string>();

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
  // Legendary (11)
  starNebula: 'legendary',
  celestialRing: 'legendary',
  dragonScale: 'legendary',
  stormBolt: 'legendary',
  shadowWeave: 'legendary',
  obsidianEdge: 'legendary',
  pharaohGold: 'legendary',
  voidRift: 'legendary',
  coralReef: 'legendary',
  darkVine: 'legendary',
  sakuraDrift: 'legendary',
  // Epic (9) — hand-crafted themed SVG
  ironForge: 'epic',
  moonSilver: 'epic',
  bloodThorn: 'epic',
  runicSeal: 'epic',
  boneGate: 'epic',
  frostCrystal: 'epic',
  emberAsh: 'epic',
  jadeSeal: 'epic',
  hellFire: 'epic',
  // Rare (50) — 5 shapes × 10 colors, multi-layer decorative borders
  inlayRed: 'rare',
  inlayOrange: 'rare',
  inlayAmber: 'rare',
  inlayGreen: 'rare',
  inlayTeal: 'rare',
  inlayBlue: 'rare',
  inlayIndigo: 'rare',
  inlayPurple: 'rare',
  inlayPink: 'rare',
  inlayGray: 'rare',
  gemRed: 'rare',
  gemOrange: 'rare',
  gemAmber: 'rare',
  gemGreen: 'rare',
  gemTeal: 'rare',
  gemBlue: 'rare',
  gemIndigo: 'rare',
  gemPurple: 'rare',
  gemPink: 'rare',
  gemGray: 'rare',
  filigreeRed: 'rare',
  filigreeOrange: 'rare',
  filigreeAmber: 'rare',
  filigreeGreen: 'rare',
  filigreeTeal: 'rare',
  filigreeBlue: 'rare',
  filigreeIndigo: 'rare',
  filigreePurple: 'rare',
  filigreePink: 'rare',
  filigreeGray: 'rare',
  chainRed: 'rare',
  chainOrange: 'rare',
  chainAmber: 'rare',
  chainGreen: 'rare',
  chainTeal: 'rare',
  chainBlue: 'rare',
  chainIndigo: 'rare',
  chainPurple: 'rare',
  chainPink: 'rare',
  chainGray: 'rare',
  grooveRed: 'rare',
  grooveOrange: 'rare',
  grooveAmber: 'rare',
  grooveGreen: 'rare',
  grooveTeal: 'rare',
  grooveBlue: 'rare',
  grooveIndigo: 'rare',
  groovePurple: 'rare',
  groovePink: 'rare',
  grooveGray: 'rare',
  // Common (100) — simple colored frames
};

/** 座位装饰稀有度映射 */
const FLAIR_RARITY: Record<string, Rarity> = {
  // Legendary (7)
  runeCircle: 'legendary',
  prismShard: 'legendary',
  fireRing: 'legendary',
  cometTail: 'legendary',
  magmaFloat: 'legendary',
  butterfly: 'legendary',
  shadowClaw: 'legendary',
  // Epic (23) — hand-crafted themed SVG flair
  emberGlow: 'epic',
  frostAura: 'epic',
  shadowMist: 'epic',
  goldenShine: 'epic',
  bloodMark: 'epic',
  starlight: 'epic',
  thunderBolt: 'epic',
  sakura: 'epic',
  lunarHalo: 'epic',
  sonicWave: 'epic',
  iceCrystal: 'epic',
  phoenixFeather: 'epic',
  ghostWisp: 'epic',
  poisonBubble: 'epic',
  windGust: 'epic',
  snowfall: 'epic',
  goldSpark: 'epic',
  purpleMist: 'epic',
  lightPillar: 'epic',
  rainDrop: 'epic',
  flowerBloom: 'epic',
  firefly: 'epic',
  forestLeaf: 'epic',
  // Rare (50) — 5 patterns × 10 colors, multi-element decorative animation
  cascadeRed: 'rare',
  cascadeOrange: 'rare',
  cascadeAmber: 'rare',
  cascadeGreen: 'rare',
  cascadeTeal: 'rare',
  cascadeBlue: 'rare',
  cascadeIndigo: 'rare',
  cascadePurple: 'rare',
  cascadePink: 'rare',
  cascadeGray: 'rare',
  vortexRed: 'rare',
  vortexOrange: 'rare',
  vortexAmber: 'rare',
  vortexGreen: 'rare',
  vortexTeal: 'rare',
  vortexBlue: 'rare',
  vortexIndigo: 'rare',
  vortexPurple: 'rare',
  vortexPink: 'rare',
  vortexGray: 'rare',
  constellationRed: 'rare',
  constellationOrange: 'rare',
  constellationAmber: 'rare',
  constellationGreen: 'rare',
  constellationTeal: 'rare',
  constellationBlue: 'rare',
  constellationIndigo: 'rare',
  constellationPurple: 'rare',
  constellationPink: 'rare',
  constellationGray: 'rare',
  auroraRed: 'rare',
  auroraOrange: 'rare',
  auroraAmber: 'rare',
  auroraGreen: 'rare',
  auroraTeal: 'rare',
  auroraBlue: 'rare',
  auroraIndigo: 'rare',
  auroraPurple: 'rare',
  auroraPink: 'rare',
  auroraGray: 'rare',
  fireflyRed: 'rare',
  fireflyOrange: 'rare',
  fireflyAmber: 'rare',
  fireflyGreen: 'rare',
  fireflyTeal: 'rare',
  fireflyBlue: 'rare',
  fireflyIndigo: 'rare',
  fireflyPurple: 'rare',
  fireflyPink: 'rare',
  fireflyGray: 'rare',
  // Common (100) — simple colored effects
};

/** 开牌特效稀有度映射 — 全部传说 */
const ROLE_REVEAL_EFFECT_RARITY: Record<string, Rarity> = {
  roulette: 'legendary',
  roleHunt: 'legendary',
  scratch: 'legendary',
  tarot: 'legendary',
  gachaMachine: 'legendary',
  cardPick: 'legendary',
  sealBreak: 'legendary',
  chainShatter: 'legendary',
  fortuneWheel: 'legendary',
  meteorStrike: 'legendary',
  filmRewind: 'legendary',
  vortexCollapse: 'legendary',
};

/** 名字样式稀有度映射 */
const NAME_STYLE_RARITY: Record<string, Rarity> = {
  // Legendary (4)
  celestialDawn: 'legendary',
  voidStar: 'legendary',
  phoenixRebirth: 'legendary',
  dragonBreath: 'legendary',
  // Epic (16) — merged former rare + epic, all gradient text (no animation)
  silverGleam: 'epic',
  copperEmber: 'epic',
  bloodMoonGlow: 'epic',
  jadeShimmer: 'epic',
  amethystGlow: 'epic',
  indigoRadiance: 'epic',
  twilightGradient: 'epic',
  roseGold: 'epic',
  frostVeil: 'epic',
  amberFlare: 'epic',
  stormElectric: 'epic',
  moltenGoldPulse: 'epic',
  frostBreath: 'epic',
  venomShift: 'epic',
  shadowPulse: 'epic',
  crimsonTide: 'epic',
  // Rare (50) — glow/radiant/bright/vivid/lustrous × 10 colors
  shimmerCrimson: 'rare',
  shimmerCoral: 'rare',
  shimmerAmber: 'rare',
  shimmerEmerald: 'rare',
  shimmerTeal: 'rare',
  shimmerAzure: 'rare',
  shimmerIndigo: 'rare',
  shimmerViolet: 'rare',
  shimmerRose: 'rare',
  shimmerSlate: 'rare',
  radiantCrimson: 'rare',
  radiantCoral: 'rare',
  radiantAmber: 'rare',
  radiantEmerald: 'rare',
  radiantTeal: 'rare',
  radiantAzure: 'rare',
  radiantIndigo: 'rare',
  radiantViolet: 'rare',
  radiantRose: 'rare',
  radiantSlate: 'rare',
  brightCrimson: 'rare',
  brightCoral: 'rare',
  brightAmber: 'rare',
  brightEmerald: 'rare',
  brightTeal: 'rare',
  brightAzure: 'rare',
  brightIndigo: 'rare',
  brightViolet: 'rare',
  brightRose: 'rare',
  brightSlate: 'rare',
  vividCrimson: 'rare',
  vividCoral: 'rare',
  vividAmber: 'rare',
  vividEmerald: 'rare',
  vividTeal: 'rare',
  vividAzure: 'rare',
  vividIndigo: 'rare',
  vividViolet: 'rare',
  vividRose: 'rare',
  vividSlate: 'rare',
  lustrousCrimson: 'rare',
  lustrousCoral: 'rare',
  lustrousAmber: 'rare',
  lustrousEmerald: 'rare',
  lustrousTeal: 'rare',
  lustrousAzure: 'rare',
  lustrousIndigo: 'rare',
  lustrousViolet: 'rare',
  lustrousRose: 'rare',
  lustrousSlate: 'rare',
  // Common (100) — factory plain/soft/muted/warm/cool/light/dusty/faded/pale/hazy × 10 colors
};

/** 按 ID 查稀有度（avatar/frame/flair/nameStyle/roleRevealEffect 统一查询） */
export function getItemRarity(id: string): Rarity {
  return (
    AVATAR_RARITY[id] ??
    FRAME_RARITY[id] ??
    FLAIR_RARITY[id] ??
    NAME_STYLE_RARITY[id] ??
    ROLE_REVEAL_EFFECT_RARITY[id] ??
    'common'
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
  ...ROLE_REVEAL_EFFECT_IDS.filter((id) => !FREE_ROLE_REVEAL_EFFECT_IDS.has(id)).map(
    (id) =>
      ({
        type: 'roleRevealEffect',
        id,
        rarity: ROLE_REVEAL_EFFECT_RARITY[id] ?? 'legendary',
      }) as const,
  ),
];

/** 免费物品总数 */
export const FREE_ITEM_COUNT =
  FREE_AVATAR_IDS.size +
  FREE_FRAME_IDS.size +
  FREE_FLAIR_IDS.size +
  FREE_NAME_STYLE_IDS.size +
  FREE_ROLE_REVEAL_EFFECT_IDS.size;

/** 全部可获得物品总数（含免费） */
export const TOTAL_UNLOCKABLE_COUNT = REWARD_POOL.length + FREE_ITEM_COUNT;

/** id → RewardItem 快速查找索引（O(1) 替代 REWARD_POOL.find()） */
export const REWARD_POOL_BY_ID: ReadonlyMap<string, RewardItem> = new Map(
  REWARD_POOL.map((item) => [item.id, item]),
);
