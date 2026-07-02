/**
 * rewardCatalog — unlockable item ID registry (single source of truth)
 *
 * Avatar IDs and avatar frame IDs are defined centrally here, shared by client and server.
 * Client `avatar.ts` and `avatarFrames/index.ts` import the ID lists from here.
 * Adding a new avatar/frame requires only appending here + adding the corresponding image/component on the client.
 */

import {
  FREE_ROLE_REVEAL_EFFECT_IDS,
  ROLE_REVEAL_EFFECT_IDS,
} from '../cosmetics/roleRevealEffects';

/** Unlockable item type. */
export type RewardType =
  | 'avatar'
  | 'frame'
  | 'seatFlair'
  | 'nameStyle'
  | 'roleRevealEffect'
  | 'seatAnimation';

/** Rarity tier. */
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

/** Single unlockable item entry. */
export interface RewardItem {
  readonly type: RewardType;
  readonly id: string;
  readonly rarity: Rarity;
}

/**
 * All avatar IDs (stable order, 1:1 with asset filenames).
 * When no avatar is set, the default wolf-paw icon is shown (not in this list).
 */
// prettier-ignore
/** Hand-drawn avatar IDs (43, Rare+ tier) */
const HAND_DRAWN_AVATAR_IDS = [
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
  'eclipseWolfQueen',
  'gargoyle',
  'graveyardKeeper',
  'guard',
  'hiddenWolf',
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
  'sequencePrince',
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

/** Procedurally generated avatar IDs — Common (ring variant, 100) */
// prettier-ignore
const GENERATED_COMMON_IDS = [
  'genC001', 'genC002', 'genC003', 'genC004', 'genC005', 'genC006', 'genC007', 'genC008', 'genC009', 'genC010',
  'genC011', 'genC012', 'genC013', 'genC014', 'genC015', 'genC016', 'genC017', 'genC018', 'genC019', 'genC020',
  'genC021', 'genC022', 'genC023', 'genC024', 'genC025', 'genC026', 'genC027', 'genC028', 'genC029', 'genC030',
  'genC031', 'genC032', 'genC033', 'genC034', 'genC035', 'genC036', 'genC037', 'genC038', 'genC039', 'genC040',
  'genC041', 'genC042', 'genC043', 'genC044', 'genC045', 'genC046', 'genC047', 'genC048', 'genC049', 'genC050',
  'genC051', 'genC052', 'genC053', 'genC054', 'genC055', 'genC056', 'genC057', 'genC058', 'genC059', 'genC060',
  'genC061', 'genC062', 'genC063', 'genC064', 'genC065', 'genC066', 'genC067', 'genC068', 'genC069', 'genC070',
  'genC071', 'genC072', 'genC073', 'genC074', 'genC075', 'genC076', 'genC077', 'genC078', 'genC079', 'genC080',
  'genC081', 'genC082', 'genC083', 'genC084', 'genC085', 'genC086', 'genC087', 'genC088', 'genC089', 'genC090',
  'genC091', 'genC092', 'genC093', 'genC094', 'genC095', 'genC096', 'genC097', 'genC098', 'genC099', 'genC100',
] as const;

/** Procedurally generated avatar IDs — Rare (beam variant, 50) */
// prettier-ignore
const GENERATED_RARE_IDS = [
  'genR001', 'genR002', 'genR003', 'genR004', 'genR005', 'genR006', 'genR007', 'genR008', 'genR009', 'genR010',
  'genR011', 'genR012', 'genR013', 'genR014', 'genR015', 'genR016', 'genR017', 'genR018', 'genR019', 'genR020',
  'genR021', 'genR022', 'genR023', 'genR024', 'genR025', 'genR026', 'genR027', 'genR028', 'genR029', 'genR030',
  'genR031', 'genR032', 'genR033', 'genR034', 'genR035', 'genR036', 'genR037', 'genR038', 'genR039', 'genR040',
  'genR041', 'genR042', 'genR043', 'genR044', 'genR045', 'genR046', 'genR047', 'genR048', 'genR049', 'genR050',
] as const;

/** All avatar IDs (hand-drawn + generated), stable order. */
export const AVATAR_IDS = [
  ...HAND_DRAWN_AVATAR_IDS,
  ...GENERATED_COMMON_IDS,
  ...GENERATED_RARE_IDS,
] as const;

/** Legendary frame ID set — used by client to gate legendary rendering effects */
// prettier-ignore
export const LEGENDARY_FRAME_IDS: ReadonlySet<string> = new Set([
  'stormBolt', 'dragonScale', 'starNebula', 'shadowWeave', 'celestialRing',
  'obsidianEdge', 'pharaohGold', 'voidRift', 'coralReef', 'darkVine', 'sakuraDrift',
]);

/** All frame IDs (1:1 with `avatarFrames/index.ts` component registry). */
// prettier-ignore
export const FRAME_IDS = [
  // Epic (39) — hand-crafted themed SVG frames
  'ironForge',
  'moonSilver',
  'bloodThorn',
  'runicSeal',
  'boneGate',
  'hellFire',
  'frostCrystal',
  'jadeSeal',
  'emberAsh',
  'nightShade',
  'sunForge',
  'crystalVein',
  'wolfFang',
  'serpentScale',
  'thornCrown',
  'mysticRune',
  'wildBriar',
  'venomGlass',
  'starForge',
  'duskIron',
  'spectralEdge',
  'wraithBone',
  'viperCoil',
  'moonGate',
  'stormWeave',
  'sandStone',
  'ravenWing',
  'frostForge',
  'goldLeaf',
  'spiritBark',
  'nightBloom',
  'flameThorn',
  'oceanDeep',
  'thunderForge',
  'witchMark',
  'lionCrest',
  'sirenCall',
  'ashWood',
  'crystalThorn',
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

/** All seat flair IDs (1:1 with `seatFlairs/index.ts` component registry). */
// prettier-ignore
export const SEAT_FLAIR_IDS = [
  // Epic (53) — hand-crafted themed SVG flair
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
  'crystalShard',
  'moonBeam',
  'darkSmoke',
  'solarFlare',
  'nightGlow',
  'oceanWave',
  'thornVine',
  'mistVeil',
  'lavaBurst',
  'starDust',
  'arcticWind',
  'thunderClap',
  'sandStormFlair',
  'venomDrip',
  'auraBurst',
  'dawnLight',
  'eclipseRing',
  'blazeTrail',
  'coralGlow',
  'willowWisp',
  'jadeMist',
  'obsidianPulse',
  'amberDrop',
  'silverStream',
  'tidePool',
  'mirageHeat',
  'petalDance',
  'stormSurge',
  'ashCloud',
  'lunarFrost',
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

/** All name style IDs (1:1 with `nameStyles/index.ts` config registry). */
// prettier-ignore
export const NAME_STYLE_IDS = [
  // Epic (46) — hand-crafted gradient text
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
  'obsidianFlame',
  'sapphireGlow',
  'emeraldMist',
  'rubyShimmer',
  'topazRadiance',
  'onyxPulse',
  'opalBreeze',
  'garnetFlare',
  'turquoiseTide',
  'pearlLuster',
  'bronzeBlaze',
  'ivoryFrost',
  'platinumSheen',
  'coralSunrise',
  'lavenderDusk',
  'cinnabarGlow',
  'cobaltStorm',
  'malachiteShift',
  'tanzaniteDream',
  'citrineWarm',
  'moonlitSilver',
  'sunsetEmber',
  'auroraBoreal',
  'midnightVelvet',
  'desertGold',
  'arcticCrystal',
  'volcanicAsh',
  'oceanBreeze',
  'thunderGold',
  'forestDew',
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

/** All seat-animation IDs (1:1 with `seatAnimations/index.ts` component registry). */
// prettier-ignore
export const SEAT_ANIMATION_IDS = [
  // Epic (40) — hand-crafted themed entrance animations
  'wolfClawEnter',
  'moonriseEnter',
  'bloodMistEnter',
  'fireRebirthEnter',
  'frostShatterEnter',
  'shadowVortexEnter',
  'runeActivateEnter',
  'chainBreakEnter',
  'poisonDripEnter',
  'mirageFadeEnter',
  'thunderStrikeEnter',
  'crystalFormEnter',
  'darkPortalEnter',
  'phoenixAshEnter',
  'ghostPhaseEnter',
  'vineGrowEnter',
  'starfallEnter',
  'sandstormEnter',
  'oceanSurgeEnter',
  'lavaCrackEnter',
  'prismRefractEnter',
  'batSwarmEnter',
  'clockworkEnter',
  'inkSplashEnter',
  'mirrorCrackEnter',
  'gravityWellEnter',
  'sonicBoomEnter',
  'petalStormEnter',
  'shadowStepEnter',
  'emberTrailEnter',
  'auroraWaveEnter',
  'voidTearEnter',
  'serpentCoilEnter',
  'stormEyeEnter',
  'duskFadeEnter',
  'mysticSealEnter',
  'witchFireEnter',
  'crowFlockEnter',
  'tombRiseEnter',
  'spiritChainEnter',
  // Legendary (10) — multi-phase elaborate entrance animations
  'wolfKingEntry',
  'witchBrew',
  'seerVision',
  'hunterShot',
  'guardShield',
  'nightFall',
  'dawnBreak',
  'bloodMoonRise',
  'spiritSummon',
  'cardReveal',
  // Common (100) — 10 patterns × 10 colors, simple avatar entrance
  'fadeRedEnter', 'fadeOrangeEnter', 'fadeAmberEnter', 'fadeGreenEnter', 'fadeTealEnter',
  'fadeBlueEnter', 'fadeIndigoEnter', 'fadePurpleEnter', 'fadePinkEnter', 'fadeGrayEnter',
  'slideUpRedEnter', 'slideUpOrangeEnter', 'slideUpAmberEnter', 'slideUpGreenEnter', 'slideUpTealEnter',
  'slideUpBlueEnter', 'slideUpIndigoEnter', 'slideUpPurpleEnter', 'slideUpPinkEnter', 'slideUpGrayEnter',
  'slideDownRedEnter', 'slideDownOrangeEnter', 'slideDownAmberEnter', 'slideDownGreenEnter', 'slideDownTealEnter',
  'slideDownBlueEnter', 'slideDownIndigoEnter', 'slideDownPurpleEnter', 'slideDownPinkEnter', 'slideDownGrayEnter',
  'zoomInRedEnter', 'zoomInOrangeEnter', 'zoomInAmberEnter', 'zoomInGreenEnter', 'zoomInTealEnter',
  'zoomInBlueEnter', 'zoomInIndigoEnter', 'zoomInPurpleEnter', 'zoomInPinkEnter', 'zoomInGrayEnter',
  'zoomOutRedEnter', 'zoomOutOrangeEnter', 'zoomOutAmberEnter', 'zoomOutGreenEnter', 'zoomOutTealEnter',
  'zoomOutBlueEnter', 'zoomOutIndigoEnter', 'zoomOutPurpleEnter', 'zoomOutPinkEnter', 'zoomOutGrayEnter',
  'spinRedEnter', 'spinOrangeEnter', 'spinAmberEnter', 'spinGreenEnter', 'spinTealEnter',
  'spinBlueEnter', 'spinIndigoEnter', 'spinPurpleEnter', 'spinPinkEnter', 'spinGrayEnter',
  'bounceRedEnter', 'bounceOrangeEnter', 'bounceAmberEnter', 'bounceGreenEnter', 'bounceTealEnter',
  'bounceBlueEnter', 'bounceIndigoEnter', 'bouncePurpleEnter', 'bouncePinkEnter', 'bounceGrayEnter',
  'flipRedEnter', 'flipOrangeEnter', 'flipAmberEnter', 'flipGreenEnter', 'flipTealEnter',
  'flipBlueEnter', 'flipIndigoEnter', 'flipPurpleEnter', 'flipPinkEnter', 'flipGrayEnter',
  'blurRedEnter', 'blurOrangeEnter', 'blurAmberEnter', 'blurGreenEnter', 'blurTealEnter',
  'blurBlueEnter', 'blurIndigoEnter', 'blurPurpleEnter', 'blurPinkEnter', 'blurGrayEnter',
  'popRedEnter', 'popOrangeEnter', 'popAmberEnter', 'popGreenEnter', 'popTealEnter',
  'popBlueEnter', 'popIndigoEnter', 'popPurpleEnter', 'popPinkEnter', 'popGrayEnter',
  // Rare (50) — 5 patterns × 10 colors, SVG particle entrance
  'spiralRedEnter', 'spiralOrangeEnter', 'spiralAmberEnter', 'spiralGreenEnter', 'spiralTealEnter',
  'spiralBlueEnter', 'spiralIndigoEnter', 'spiralPurpleEnter', 'spiralPinkEnter', 'spiralGrayEnter',
  'shatterRedEnter', 'shatterOrangeEnter', 'shatterAmberEnter', 'shatterGreenEnter', 'shatterTealEnter',
  'shatterBlueEnter', 'shatterIndigoEnter', 'shatterPurpleEnter', 'shatterPinkEnter', 'shatterGrayEnter',
  'portalRedEnter', 'portalOrangeEnter', 'portalAmberEnter', 'portalGreenEnter', 'portalTealEnter',
  'portalBlueEnter', 'portalIndigoEnter', 'portalPurpleEnter', 'portalPinkEnter', 'portalGrayEnter',
  'lightningRedEnter', 'lightningOrangeEnter', 'lightningAmberEnter', 'lightningGreenEnter', 'lightningTealEnter',
  'lightningBlueEnter', 'lightningIndigoEnter', 'lightningPurpleEnter', 'lightningPinkEnter', 'lightningGrayEnter',
  'bloomRedEnter', 'bloomOrangeEnter', 'bloomAmberEnter', 'bloomGreenEnter', 'bloomTealEnter',
  'bloomBlueEnter', 'bloomIndigoEnter', 'bloomPurpleEnter', 'bloomPinkEnter', 'bloomGrayEnter',
] as const;

/** Avatar ID literal union (hand-drawn + generated) */
export type AvatarId = (typeof AVATAR_IDS)[number];

/** Hand-drawn avatar ID literal union (43 with image assets) */
export type HandDrawnAvatarId = (typeof HAND_DRAWN_AVATAR_IDS)[number];

/** Hand-drawn avatar ID list (exported for client image registry) */
export { HAND_DRAWN_AVATAR_IDS };

/** Frame ID literal union */
export type FrameId = (typeof FRAME_IDS)[number];

/** Seat flair ID literal union */
export type FlairId = (typeof SEAT_FLAIR_IDS)[number];

/** Name style ID literal union */
export type NameStyleId = (typeof NAME_STYLE_IDS)[number];

/** Seat-animation ID literal union */
export type SeatAnimationId = (typeof SEAT_ANIMATION_IDS)[number];

/** Free avatar IDs granted on registration */
export const FREE_AVATAR_IDS: ReadonlySet<string> = new Set<string>();

/** Free frame IDs granted on registration (none) */
export const FREE_FRAME_IDS: ReadonlySet<string> = new Set<string>();

/** Free seat flair IDs granted on registration (none) */
export const FREE_FLAIR_IDS: ReadonlySet<string> = new Set<string>();

/** Free name style IDs granted on registration (none) */
export const FREE_NAME_STYLE_IDS: ReadonlySet<string> = new Set<string>();

/** Free seat-animation IDs granted on registration (none) */
export const FREE_SEAT_ANIMATION_IDS: ReadonlySet<string> = new Set<string>();

/** Avatar rarity mapping */
const AVATAR_RARITY: Record<string, Rarity> = {
  // Legendary (10) — original 3 legendary + 7 promoted from epic
  darkWolfKing: 'legendary',
  nightmare: 'legendary',
  masquerade: 'legendary',
  wolfKing: 'legendary',
  wolfQueen: 'legendary',
  bloodMoon: 'legendary',
  spiritKnight: 'legendary',
  awakenedGargoyle: 'legendary',
  eclipseWolfQueen: 'legendary',
  witch: 'legendary',
  seer: 'legendary',
  // Epic (33) — 14 promoted from rare + 19 promoted from common
  hunter: 'epic',
  guard: 'epic',
  knight: 'epic',
  magician: 'epic',
  piper: 'epic',
  poisoner: 'epic',
  gargoyle: 'epic',
  dreamcatcher: 'epic',
  avenger: 'epic',
  mirrorSeer: 'epic',
  psychic: 'epic',
  cursedFox: 'epic',
  sequencePrince: 'epic',
  witcher: 'epic',
  wolfWitch: 'epic',
  crow: 'epic',
  cupid: 'epic',
  dancer: 'epic',
  drunkSeer: 'epic',
  graveyardKeeper: 'epic',
  idiot: 'epic',
  maskedMan: 'epic',
  pureWhite: 'epic',
  shadow: 'epic',
  silenceElder: 'epic',
  slacker: 'epic',
  thief: 'epic',
  treasureMaster: 'epic',
  villager: 'epic',
  votebanElder: 'epic',
  warden: 'epic',
  wildChild: 'epic',
  wolf: 'epic',
  wolfRobot: 'epic',
  hiddenWolf: 'epic',
  // Rare (50) — generated beam variant
  ...Object.fromEntries(GENERATED_RARE_IDS.map((id) => [id, 'rare'])),
  // Common (100) — generated pixel variant (fallback default)
};

/** Frame rarity mapping */
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
  // Epic (39) — hand-crafted themed SVG
  ironForge: 'epic',
  moonSilver: 'epic',
  bloodThorn: 'epic',
  runicSeal: 'epic',
  boneGate: 'epic',
  frostCrystal: 'epic',
  emberAsh: 'epic',
  jadeSeal: 'epic',
  hellFire: 'epic',
  nightShade: 'epic',
  sunForge: 'epic',
  crystalVein: 'epic',
  wolfFang: 'epic',
  serpentScale: 'epic',
  thornCrown: 'epic',
  mysticRune: 'epic',
  wildBriar: 'epic',
  venomGlass: 'epic',
  starForge: 'epic',
  duskIron: 'epic',
  spectralEdge: 'epic',
  wraithBone: 'epic',
  viperCoil: 'epic',
  moonGate: 'epic',
  stormWeave: 'epic',
  sandStone: 'epic',
  ravenWing: 'epic',
  frostForge: 'epic',
  goldLeaf: 'epic',
  spiritBark: 'epic',
  nightBloom: 'epic',
  flameThorn: 'epic',
  oceanDeep: 'epic',
  thunderForge: 'epic',
  witchMark: 'epic',
  lionCrest: 'epic',
  sirenCall: 'epic',
  ashWood: 'epic',
  crystalThorn: 'epic',
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

/** Seat flair rarity mapping */
const FLAIR_RARITY: Record<string, Rarity> = {
  // Legendary (7)
  runeCircle: 'legendary',
  prismShard: 'legendary',
  fireRing: 'legendary',
  cometTail: 'legendary',
  magmaFloat: 'legendary',
  butterfly: 'legendary',
  shadowClaw: 'legendary',
  // Epic (53) — hand-crafted themed SVG flair
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
  crystalShard: 'epic',
  moonBeam: 'epic',
  darkSmoke: 'epic',
  solarFlare: 'epic',
  nightGlow: 'epic',
  oceanWave: 'epic',
  thornVine: 'epic',
  mistVeil: 'epic',
  lavaBurst: 'epic',
  starDust: 'epic',
  arcticWind: 'epic',
  thunderClap: 'epic',
  sandStormFlair: 'epic',
  venomDrip: 'epic',
  auraBurst: 'epic',
  dawnLight: 'epic',
  eclipseRing: 'epic',
  blazeTrail: 'epic',
  coralGlow: 'epic',
  willowWisp: 'epic',
  jadeMist: 'epic',
  obsidianPulse: 'epic',
  amberDrop: 'epic',
  silverStream: 'epic',
  tidePool: 'epic',
  mirageHeat: 'epic',
  petalDance: 'epic',
  stormSurge: 'epic',
  ashCloud: 'epic',
  lunarFrost: 'epic',
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

/** Role-reveal effect rarity mapping — 6 legendary + 6 epic (tiered by implementation complexity) */
const ROLE_REVEAL_EFFECT_RARITY: Record<string, Rarity> = {
  // Legendary (6) — complex interactions / multi-stage sequences
  roleHunt: 'legendary',
  sealBreak: 'legendary',
  chainShatter: 'legendary',
  tarot: 'legendary',
  fortuneWheel: 'legendary',
  scratch: 'legendary',
  // Epic (6) — simpler animations
  roulette: 'epic',
  vortexCollapse: 'epic',
  gachaMachine: 'epic',
  meteorStrike: 'epic',
  filmRewind: 'epic',
  cardPick: 'epic',
};

/** Name style rarity mapping */
const NAME_STYLE_RARITY: Record<string, Rarity> = {
  // Legendary (4)
  celestialDawn: 'legendary',
  voidStar: 'legendary',
  phoenixRebirth: 'legendary',
  dragonBreath: 'legendary',
  // Epic (46) — merged former rare + epic, all gradient text (no animation)
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
  obsidianFlame: 'epic',
  sapphireGlow: 'epic',
  emeraldMist: 'epic',
  rubyShimmer: 'epic',
  topazRadiance: 'epic',
  onyxPulse: 'epic',
  opalBreeze: 'epic',
  garnetFlare: 'epic',
  turquoiseTide: 'epic',
  pearlLuster: 'epic',
  bronzeBlaze: 'epic',
  ivoryFrost: 'epic',
  platinumSheen: 'epic',
  coralSunrise: 'epic',
  lavenderDusk: 'epic',
  cinnabarGlow: 'epic',
  cobaltStorm: 'epic',
  malachiteShift: 'epic',
  tanzaniteDream: 'epic',
  citrineWarm: 'epic',
  moonlitSilver: 'epic',
  sunsetEmber: 'epic',
  auroraBoreal: 'epic',
  midnightVelvet: 'epic',
  desertGold: 'epic',
  arcticCrystal: 'epic',
  volcanicAsh: 'epic',
  oceanBreeze: 'epic',
  thunderGold: 'epic',
  forestDew: 'epic',
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

// prettier-ignore
/** Seat-animation rarity mapping */
const SEAT_ANIMATION_RARITY: Record<string, Rarity> = {
  // Legendary (10)
  wolfKingEntry: 'legendary', witchBrew: 'legendary', seerVision: 'legendary',
  hunterShot: 'legendary', guardShield: 'legendary', nightFall: 'legendary',
  dawnBreak: 'legendary', bloodMoonRise: 'legendary', spiritSummon: 'legendary',
  cardReveal: 'legendary',
  // Epic (40)
  wolfClawEnter: 'epic', moonriseEnter: 'epic', bloodMistEnter: 'epic',
  fireRebirthEnter: 'epic', frostShatterEnter: 'epic', shadowVortexEnter: 'epic',
  runeActivateEnter: 'epic', chainBreakEnter: 'epic', poisonDripEnter: 'epic',
  mirageFadeEnter: 'epic', thunderStrikeEnter: 'epic', crystalFormEnter: 'epic',
  darkPortalEnter: 'epic', phoenixAshEnter: 'epic', ghostPhaseEnter: 'epic',
  vineGrowEnter: 'epic', starfallEnter: 'epic', sandstormEnter: 'epic',
  oceanSurgeEnter: 'epic', lavaCrackEnter: 'epic', prismRefractEnter: 'epic',
  batSwarmEnter: 'epic', clockworkEnter: 'epic', inkSplashEnter: 'epic',
  mirrorCrackEnter: 'epic', gravityWellEnter: 'epic', sonicBoomEnter: 'epic',
  petalStormEnter: 'epic', shadowStepEnter: 'epic', emberTrailEnter: 'epic',
  auroraWaveEnter: 'epic', voidTearEnter: 'epic', serpentCoilEnter: 'epic',
  stormEyeEnter: 'epic', duskFadeEnter: 'epic', mysticSealEnter: 'epic',
  witchFireEnter: 'epic', crowFlockEnter: 'epic', tombRiseEnter: 'epic',
  spiritChainEnter: 'epic',
  // Rare (50) — 5 patterns × 10 colors
  spiralRedEnter: 'rare', spiralOrangeEnter: 'rare', spiralAmberEnter: 'rare',
  spiralGreenEnter: 'rare', spiralTealEnter: 'rare', spiralBlueEnter: 'rare',
  spiralIndigoEnter: 'rare', spiralPurpleEnter: 'rare', spiralPinkEnter: 'rare',
  spiralGrayEnter: 'rare',
  shatterRedEnter: 'rare', shatterOrangeEnter: 'rare', shatterAmberEnter: 'rare',
  shatterGreenEnter: 'rare', shatterTealEnter: 'rare', shatterBlueEnter: 'rare',
  shatterIndigoEnter: 'rare', shatterPurpleEnter: 'rare', shatterPinkEnter: 'rare',
  shatterGrayEnter: 'rare',
  portalRedEnter: 'rare', portalOrangeEnter: 'rare', portalAmberEnter: 'rare',
  portalGreenEnter: 'rare', portalTealEnter: 'rare', portalBlueEnter: 'rare',
  portalIndigoEnter: 'rare', portalPurpleEnter: 'rare', portalPinkEnter: 'rare',
  portalGrayEnter: 'rare',
  lightningRedEnter: 'rare', lightningOrangeEnter: 'rare', lightningAmberEnter: 'rare',
  lightningGreenEnter: 'rare', lightningTealEnter: 'rare', lightningBlueEnter: 'rare',
  lightningIndigoEnter: 'rare', lightningPurpleEnter: 'rare', lightningPinkEnter: 'rare',
  lightningGrayEnter: 'rare',
  bloomRedEnter: 'rare', bloomOrangeEnter: 'rare', bloomAmberEnter: 'rare',
  bloomGreenEnter: 'rare', bloomTealEnter: 'rare', bloomBlueEnter: 'rare',
  bloomIndigoEnter: 'rare', bloomPurpleEnter: 'rare', bloomPinkEnter: 'rare',
  bloomGrayEnter: 'rare',
  // Common (100) — 10 patterns × 10 colors (not listed → falls through to 'common')
};

/** Look up rarity by ID (unified across avatar/frame/flair/nameStyle/roleRevealEffect/seatAnimation) */
export function getItemRarity(id: string): Rarity {
  return (
    AVATAR_RARITY[id] ??
    FRAME_RARITY[id] ??
    FLAIR_RARITY[id] ??
    NAME_STYLE_RARITY[id] ??
    ROLE_REVEAL_EFFECT_RARITY[id] ??
    SEAT_ANIMATION_RARITY[id] ??
    'common'
  );
}

/**
 * Drawable reward pool (all unlockable items - free items).
 * On server-side level-up, already-unlocked items are excluded from this pool, then a random draw is performed.
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
  ...SEAT_ANIMATION_IDS.filter((id) => !FREE_SEAT_ANIMATION_IDS.has(id)).map(
    (id) => ({ type: 'seatAnimation', id, rarity: SEAT_ANIMATION_RARITY[id] ?? 'common' }) as const,
  ),
];

/** Total free item count */
export const FREE_ITEM_COUNT =
  FREE_AVATAR_IDS.size +
  FREE_FRAME_IDS.size +
  FREE_FLAIR_IDS.size +
  FREE_NAME_STYLE_IDS.size +
  FREE_ROLE_REVEAL_EFFECT_IDS.size +
  FREE_SEAT_ANIMATION_IDS.size;

/** Total obtainable item count (including free) */
export const TOTAL_UNLOCKABLE_COUNT = REWARD_POOL.length + FREE_ITEM_COUNT;

/** id → RewardItem fast lookup index (O(1) replacement for REWARD_POOL.find()) */
export const REWARD_POOL_BY_ID: ReadonlyMap<string, RewardItem> = new Map(
  REWARD_POOL.map((item) => [item.id, item]),
);

// ── Shard System ────────────────────────────────────────────────────────

/** Shard count awarded when drawing a duplicate item */
export const SHARD_VALUES: Readonly<Record<Rarity, number>> = {
  common: 5,
  rare: 15,
  epic: 50,
  legendary: 200,
};

/** Shard cost to redeem a specific item */
export const SHARD_COSTS: Readonly<Record<Rarity, number>> = {
  common: 30,
  rare: 90,
  epic: 300,
  legendary: 1200,
};
