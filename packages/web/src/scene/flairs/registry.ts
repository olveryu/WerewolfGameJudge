/**
 * Seat flair registry: one decoration spec per catalog flair id. Hand-crafted specs are listed
 * here (compiler-checked keys); the 150 generated common / rare specs come from the factory, and
 * building the registry fails fast when any catalog id has no spec.
 */
import { type FlairId, SEAT_FLAIR_IDS } from '@game-judge/game-engine/product/rewards';

import type { DecorationSpec } from '@/scene/decoration';

import { amberDropFlair } from './amberDrop';
import { arcticWindFlair } from './arcticWind';
import { ashCloudFlair } from './ashCloud';
import { auraBurstFlair } from './auraBurst';
import { blazeTrailFlair } from './blazeTrail';
import { bloodMarkFlair } from './bloodMark';
import { butterflyFlair } from './butterfly';
import { cometTailFlair } from './cometTail';
import { GENERATED_FLAIR_SPECS } from './common';
import { coralGlowFlair } from './coralGlow';
import { crystalShardFlair } from './crystalShard';
import { darkSmokeFlair } from './darkSmoke';
import { dawnLightFlair } from './dawnLight';
import { eclipseRingFlair } from './eclipseRing';
import { emberGlowFlair } from './emberGlow';
import { fireflyFlair } from './firefly';
import { fireRingFlair } from './fireRing';
import { flowerBloomFlair } from './flowerBloom';
import { forestLeafFlair } from './forestLeaf';
import { frostAuraFlair } from './frostAura';
import { ghostWispFlair } from './ghostWisp';
import { goldenShineFlair } from './goldenShine';
import { goldSparkFlair } from './goldSpark';
import { iceCrystalFlair } from './iceCrystal';
import { jadeMistFlair } from './jadeMist';
import { lavaBurstFlair } from './lavaBurst';
import { lightPillarFlair } from './lightPillar';
import { lunarFrostFlair } from './lunarFrost';
import { lunarHaloFlair } from './lunarHalo';
import { magmaFloatFlair } from './magmaFloat';
import { mirageHeatFlair } from './mirageHeat';
import { mistVeilFlair } from './mistVeil';
import { moonBeamFlair } from './moonBeam';
import { moonTidesFlair, paintedMountainsFlair, starWeaveFlair } from './mythicCollection';
import { nightGlowFlair } from './nightGlow';
import { nightSanctumFlair } from './nightSanctum';
import { obsidianPulseFlair } from './obsidianPulse';
import { oceanWaveFlair } from './oceanWave';
import { petalDanceFlair } from './petalDance';
import { phoenixFeatherFlair } from './phoenixFeather';
import { poisonBubbleFlair } from './poisonBubble';
import { prismShardFlair } from './prismShard';
import { purpleMistFlair } from './purpleMist';
import { rainDropFlair } from './rainDrop';
import { runeCircleFlair } from './runeCircle';
import { sakuraFlair } from './sakura';
import { sandStormFlair } from './sandStorm';
import { shadowClawFlair } from './shadowClaw';
import { shadowMistFlair } from './shadowMist';
import { silverStreamFlair } from './silverStream';
import { snowfallFlair } from './snowfall';
import { solarFlareFlair } from './solarFlare';
import { sonicWaveFlair } from './sonicWave';
import { starDustFlair } from './starDust';
import { starlightFlair } from './starlight';
import { stormSurgeFlair } from './stormSurge';
import { thornVineFlair } from './thornVine';
import { thunderBoltFlair } from './thunderBolt';
import { thunderClapFlair } from './thunderClap';
import { tidePoolFlair } from './tidePool';
import { venomDripFlair } from './venomDrip';
import { willowWispFlair } from './willowWisp';
import { windGustFlair } from './windGust';

const HAND_CRAFTED_FLAIRS = {
  nightSanctum: nightSanctumFlair,
  starWeave: starWeaveFlair,
  moonTides: moonTidesFlair,
  paintedMountains: paintedMountainsFlair,
  emberGlow: emberGlowFlair,
  frostAura: frostAuraFlair,
  shadowMist: shadowMistFlair,
  goldenShine: goldenShineFlair,
  bloodMark: bloodMarkFlair,
  starlight: starlightFlair,
  thunderBolt: thunderBoltFlair,
  sakura: sakuraFlair,
  runeCircle: runeCircleFlair,
  fireRing: fireRingFlair,
  lunarHalo: lunarHaloFlair,
  sonicWave: sonicWaveFlair,
  cometTail: cometTailFlair,
  iceCrystal: iceCrystalFlair,
  phoenixFeather: phoenixFeatherFlair,
  ghostWisp: ghostWispFlair,
  poisonBubble: poisonBubbleFlair,
  magmaFloat: magmaFloatFlair,
  windGust: windGustFlair,
  snowfall: snowfallFlair,
  goldSpark: goldSparkFlair,
  purpleMist: purpleMistFlair,
  butterfly: butterflyFlair,
  lightPillar: lightPillarFlair,
  shadowClaw: shadowClawFlair,
  rainDrop: rainDropFlair,
  flowerBloom: flowerBloomFlair,
  firefly: fireflyFlair,
  forestLeaf: forestLeafFlair,
  prismShard: prismShardFlair,
  crystalShard: crystalShardFlair,
  moonBeam: moonBeamFlair,
  darkSmoke: darkSmokeFlair,
  solarFlare: solarFlareFlair,
  nightGlow: nightGlowFlair,
  oceanWave: oceanWaveFlair,
  thornVine: thornVineFlair,
  mistVeil: mistVeilFlair,
  lavaBurst: lavaBurstFlair,
  starDust: starDustFlair,
  arcticWind: arcticWindFlair,
  thunderClap: thunderClapFlair,
  sandStormFlair: sandStormFlair,
  venomDrip: venomDripFlair,
  auraBurst: auraBurstFlair,
  dawnLight: dawnLightFlair,
  eclipseRing: eclipseRingFlair,
  blazeTrail: blazeTrailFlair,
  coralGlow: coralGlowFlair,
  willowWisp: willowWispFlair,
  jadeMist: jadeMistFlair,
  obsidianPulse: obsidianPulseFlair,
  amberDrop: amberDropFlair,
  silverStream: silverStreamFlair,
  tidePool: tidePoolFlair,
  mirageHeat: mirageHeatFlair,
  petalDance: petalDanceFlair,
  stormSurge: stormSurgeFlair,
  ashCloud: ashCloudFlair,
  lunarFrost: lunarFrostFlair,
} satisfies Partial<Record<FlairId, DecorationSpec>>;

function buildFlairRegistry(): ReadonlyMap<FlairId, DecorationSpec> {
  const handCrafted: Partial<Record<FlairId, DecorationSpec>> = HAND_CRAFTED_FLAIRS;
  return new Map(
    SEAT_FLAIR_IDS.map((id) => {
      const spec = handCrafted[id] ?? GENERATED_FLAIR_SPECS.get(id);
      if (spec === undefined) {
        throw new Error(`Missing seat flair spec for "${id}"`);
      }
      if (spec.id !== id) {
        throw new Error(`Seat flair spec "${spec.id}" is registered under "${id}"`);
      }
      return [id, spec] as const;
    }),
  );
}

/** Every catalog flair's decoration, keyed by flair id. */
export const FLAIR_SPECS: ReadonlyMap<FlairId, DecorationSpec> = buildFlairRegistry();
