/**
 * FLAIR_DRAW_MAP — exhaustive map of FlairId → FlairDrawConfig.
 *
 * Common/Rare: 15 templates × 10 colors = 150 entries (share draw fn, differ by colors)
 * Root (Epic/Legendary): 60 unique entries
 * Total: 210 entries matching SEAT_FLAIR_IDS
 */
import {
  drawAurora,
  drawBreathe,
  drawCascade,
  drawConstellation,
  drawDrift,
  drawFirefly,
  drawFlicker,
  drawFloat,
  drawGlow,
  drawOrbit,
  drawPulse,
  drawRipple,
  drawSparkle,
  drawVortex,
  drawWave,
} from './commonTemplates';
import {
  drawAmberDrop,
  drawArcticWind,
  drawAshCloud,
  drawAuraBurst,
  drawBlazeTrail,
  drawBloodMark,
  drawButterfly,
  drawCometTail,
  drawCoralGlow,
  drawCrystalShard,
  drawDarkSmoke,
  drawDawnLight,
  drawEclipseRing,
  drawEmberGlow,
  drawFireflyRoot,
  drawFireRing,
  drawFlowerBloom,
  drawForestLeaf,
  drawFrostAura,
  drawGhostWisp,
  drawGoldenShine,
  drawGoldSpark,
  drawIceCrystal,
  drawJadeMist,
  drawLavaBurst,
  drawLightPillar,
  drawLunarFrost,
  drawLunarHalo,
  drawMagmaFloat,
  drawMirageHeat,
  drawMistVeil,
  drawMoonBeam,
  drawNightGlow,
  drawObsidianPulse,
  drawOceanWave,
  drawPetalDance,
  drawPhoenixFeather,
  drawPoisonBubble,
  drawPrismShard,
  drawPurpleMist,
  drawRainDrop,
  drawRuneCircle,
  drawSakura,
  drawSandStormFlair,
  drawShadowClaw,
  drawShadowMist,
  drawSilverStream,
  drawSnowfall,
  drawSolarFlare,
  drawSonicWave,
  drawStarDust,
  drawStarlight,
  drawStormSurge,
  drawThornVine,
  drawThunderBolt,
  drawThunderClap,
  drawTidePool,
  drawVenomDrip,
  drawWillowWisp,
  drawWindGust,
} from './rootFlairs';
import type { FlairDrawConfig } from './types';

// ── Common/Rare parametric entries ──────────────────────────────────────────

const COMMON_TEMPLATES = {
  pulse: drawPulse,
  glow: drawGlow,
  sparkle: drawSparkle,
  breathe: drawBreathe,
  float: drawFloat,
  ripple: drawRipple,
  orbit: drawOrbit,
  flicker: drawFlicker,
  drift: drawDrift,
  wave: drawWave,
} as const;

const RARE_TEMPLATES = {
  cascade: drawCascade,
  vortex: drawVortex,
  constellation: drawConstellation,
  aurora: drawAurora,
  firefly: drawFirefly,
} as const;

const COLOR_KEYS = [
  'red',
  'orange',
  'amber',
  'green',
  'teal',
  'blue',
  'indigo',
  'purple',
  'pink',
  'gray',
] as const;

function buildParametricEntries(): Record<string, FlairDrawConfig> {
  const map: Record<string, FlairDrawConfig> = {};
  for (const [prefix, config] of Object.entries(COMMON_TEMPLATES)) {
    for (const color of COLOR_KEYS) {
      const id = `${prefix}${color.charAt(0).toUpperCase()}${color.slice(1)}`;
      map[id] = config;
    }
  }
  for (const [prefix, config] of Object.entries(RARE_TEMPLATES)) {
    for (const color of COLOR_KEYS) {
      const id = `${prefix}${color.charAt(0).toUpperCase()}${color.slice(1)}`;
      map[id] = config;
    }
  }
  return map;
}

// ── Root (Epic/Legendary) entries ───────────────────────────────────────────

const ROOT_ENTRIES: Record<string, FlairDrawConfig> = {
  amberDrop: drawAmberDrop,
  arcticWind: drawArcticWind,
  ashCloud: drawAshCloud,
  auraBurst: drawAuraBurst,
  blazeTrail: drawBlazeTrail,
  bloodMark: drawBloodMark,
  butterfly: drawButterfly,
  cometTail: drawCometTail,
  coralGlow: drawCoralGlow,
  crystalShard: drawCrystalShard,
  darkSmoke: drawDarkSmoke,
  dawnLight: drawDawnLight,
  eclipseRing: drawEclipseRing,
  emberGlow: drawEmberGlow,
  firefly: drawFireflyRoot,
  fireRing: drawFireRing,
  flowerBloom: drawFlowerBloom,
  forestLeaf: drawForestLeaf,
  frostAura: drawFrostAura,
  ghostWisp: drawGhostWisp,
  goldSpark: drawGoldSpark,
  goldenShine: drawGoldenShine,
  iceCrystal: drawIceCrystal,
  jadeMist: drawJadeMist,
  lavaBurst: drawLavaBurst,
  lightPillar: drawLightPillar,
  lunarFrost: drawLunarFrost,
  lunarHalo: drawLunarHalo,
  magmaFloat: drawMagmaFloat,
  mirageHeat: drawMirageHeat,
  mistVeil: drawMistVeil,
  moonBeam: drawMoonBeam,
  nightGlow: drawNightGlow,
  obsidianPulse: drawObsidianPulse,
  oceanWave: drawOceanWave,
  petalDance: drawPetalDance,
  phoenixFeather: drawPhoenixFeather,
  poisonBubble: drawPoisonBubble,
  prismShard: drawPrismShard,
  purpleMist: drawPurpleMist,
  rainDrop: drawRainDrop,
  runeCircle: drawRuneCircle,
  sakura: drawSakura,
  sandStormFlair: drawSandStormFlair,
  shadowClaw: drawShadowClaw,
  shadowMist: drawShadowMist,
  silverStream: drawSilverStream,
  snowfall: drawSnowfall,
  solarFlare: drawSolarFlare,
  sonicWave: drawSonicWave,
  starDust: drawStarDust,
  starlight: drawStarlight,
  stormSurge: drawStormSurge,
  thornVine: drawThornVine,
  thunderBolt: drawThunderBolt,
  thunderClap: drawThunderClap,
  tidePool: drawTidePool,
  venomDrip: drawVenomDrip,
  willowWisp: drawWillowWisp,
  windGust: drawWindGust,
};

// ── Combined map ────────────────────────────────────────────────────────────

/**
 * Exhaustive FlairId → FlairDrawConfig lookup.
 * Used by FlairCanvas to render any flair by ID.
 */
export const FLAIR_DRAW_MAP: Record<string, FlairDrawConfig> = {
  ...buildParametricEntries(),
  ...ROOT_ENTRIES,
};
