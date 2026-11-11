/**
 * Avatar frame registry: statically imported code, with specs prepared and cached on demand.
 * Building the registry fails fast when a catalog id has no factory; preparation checks the id.
 */
import { FRAME_IDS, type FrameId } from '@game-judge/game-engine/product/rewards';

import type { DecorationSpec } from '@/scene/decoration';

import { ashWoodFrame } from './ashWood';
import { bloodThornFrame } from './bloodThorn';
import { boneGateFrame } from './boneGate';
import { celestialRingFrame } from './celestialRing';
import { generatedFrame } from './common';
import { coralReefFrame } from './coralReef';
import { crystalThornFrame } from './crystalThorn';
import { crystalVeinFrame } from './crystalVein';
import { darkVineFrame } from './darkVine';
import { dragonScaleFrame } from './dragonScale';
import { duskIronFrame } from './duskIron';
import { emberAshFrame } from './emberAsh';
import { eternalCrownFrame } from './eternalCrown';
import { flameThornFrame } from './flameThorn';
import { frostCrystalFrame } from './frostCrystal';
import { frostForgeFrame } from './frostForge';
import { goldLeafFrame } from './goldLeaf';
import { hellFireFrame } from './hellFire';
import { ironForgeFrame } from './ironForge';
import { jadeSealFrame } from './jadeSeal';
import { lionCrestFrame } from './lionCrest';
import { moonGateFrame } from './moonGate';
import { moonSilverFrame } from './moonSilver';
import { mysticRuneFrame } from './mysticRune';
import { celestialLoomFrame, coralTideFrame, inkLandscapeFrame } from './mythicCollection';
import { nightBloomFrame } from './nightBloom';
import { nightShadeFrame } from './nightShade';
import { obsidianEdgeFrame } from './obsidianEdge';
import { oceanDeepFrame } from './oceanDeep';
import { pharaohGoldFrame } from './pharaohGold';
import { ravenWingFrame } from './ravenWing';
import { runicSealFrame } from './runicSeal';
import { sakuraDriftFrame } from './sakuraDrift';
import { sandStoneFrame } from './sandStone';
import { serpentScaleFrame } from './serpentScale';
import { shadowWeaveFrame } from './shadowWeave';
import { sirenCallFrame } from './sirenCall';
import { spectralEdgeFrame } from './spectralEdge';
import { spiritBarkFrame } from './spiritBark';
import { starForgeFrame } from './starForge';
import { starNebulaFrame } from './starNebula';
import { stormBoltFrame } from './stormBolt';
import { stormWeaveFrame } from './stormWeave';
import { sunForgeFrame } from './sunForge';
import { thornCrownFrame } from './thornCrown';
import { thunderForgeFrame } from './thunderForge';
import { venomGlassFrame } from './venomGlass';
import { viperCoilFrame } from './viperCoil';
import { voidRiftFrame } from './voidRift';
import { wildBriarFrame } from './wildBriar';
import { witchMarkFrame } from './witchMark';
import { wolfFangFrame } from './wolfFang';
import { wraithBoneFrame } from './wraithBone';

type FrameLoader = () => Promise<DecorationSpec>;

const HAND_CRAFTED_FRAMES = {
  eternalCrown: async () => eternalCrownFrame,
  celestialLoom: async () => celestialLoomFrame,
  coralTide: async () => coralTideFrame,
  inkLandscape: async () => inkLandscapeFrame,
  ironForge: async () => ironForgeFrame,
  moonSilver: async () => moonSilverFrame,
  bloodThorn: async () => bloodThornFrame,
  runicSeal: async () => runicSealFrame,
  boneGate: async () => boneGateFrame,
  hellFire: async () => hellFireFrame,
  frostCrystal: async () => frostCrystalFrame,
  jadeSeal: async () => jadeSealFrame,
  emberAsh: async () => emberAshFrame,
  nightShade: async () => nightShadeFrame,
  sunForge: async () => sunForgeFrame,
  crystalVein: async () => crystalVeinFrame,
  wolfFang: async () => wolfFangFrame,
  serpentScale: async () => serpentScaleFrame,
  thornCrown: async () => thornCrownFrame,
  mysticRune: async () => mysticRuneFrame,
  wildBriar: async () => wildBriarFrame,
  venomGlass: async () => venomGlassFrame,
  starForge: async () => starForgeFrame,
  duskIron: async () => duskIronFrame,
  spectralEdge: async () => spectralEdgeFrame,
  wraithBone: async () => wraithBoneFrame,
  viperCoil: async () => viperCoilFrame,
  moonGate: async () => moonGateFrame,
  stormWeave: async () => stormWeaveFrame,
  sandStone: async () => sandStoneFrame,
  ravenWing: async () => ravenWingFrame,
  frostForge: async () => frostForgeFrame,
  goldLeaf: async () => goldLeafFrame,
  spiritBark: async () => spiritBarkFrame,
  nightBloom: async () => nightBloomFrame,
  flameThorn: async () => flameThornFrame,
  oceanDeep: async () => oceanDeepFrame,
  thunderForge: async () => thunderForgeFrame,
  witchMark: async () => witchMarkFrame,
  lionCrest: async () => lionCrestFrame,
  sirenCall: async () => sirenCallFrame,
  ashWood: async () => ashWoodFrame,
  crystalThorn: async () => crystalThornFrame,
  stormBolt: async () => stormBoltFrame,
  dragonScale: async () => dragonScaleFrame,
  starNebula: async () => starNebulaFrame,
  shadowWeave: async () => shadowWeaveFrame,
  celestialRing: async () => celestialRingFrame,
  obsidianEdge: async () => obsidianEdgeFrame,
  pharaohGold: async () => pharaohGoldFrame,
  voidRift: async () => voidRiftFrame,
  coralReef: async () => coralReefFrame,
  darkVine: async () => darkVineFrame,
  sakuraDrift: async () => sakuraDriftFrame,
} satisfies Partial<Record<FrameId, FrameLoader>>;

/** Catalog ids of the generated frames: a shape prefix plus a capitalised palette colour. */
const GENERATED_FRAME_ID =
  /^(round|square|octagon|dash|double|diamond|scallop|cross|notch|bevel|inlay|gem|filigree|chain|groove)(Red|Orange|Amber|Green|Teal|Blue|Indigo|Purple|Pink|Gray)$/;

function buildFrameLoaders(): ReadonlyMap<FrameId, FrameLoader> {
  const handCrafted: Partial<Record<FrameId, FrameLoader>> = HAND_CRAFTED_FRAMES;
  return new Map(
    FRAME_IDS.map((id) => {
      let loader = handCrafted[id];
      if (loader === undefined && GENERATED_FRAME_ID.test(id)) {
        loader = async () => generatedFrame(id);
      }
      if (loader === undefined) {
        throw new Error(`Missing avatar frame spec for "${id}"`);
      }
      return [id, loader] as const;
    }),
  );
}

/** Every catalog frame's spec loader, keyed by frame id. */
const FRAME_LOADERS: ReadonlyMap<FrameId, FrameLoader> = buildFrameLoaders();

const loadedFrames = new Map<FrameId, Promise<DecorationSpec>>();

/**
 * The decoration of catalog frame `id`, loaded once and shared (a stable promise for `use()`).
 * Rejects when preparation fails or the spec is registered under another id.
 */
export function loadFrameSpec(id: FrameId): Promise<DecorationSpec> {
  let spec = loadedFrames.get(id);
  if (!spec) {
    const loader = FRAME_LOADERS.get(id);
    if (!loader) {
      throw new Error(`Missing avatar frame spec for "${id}"`);
    }
    spec = loader().then((loaded) => {
      if (loaded.id !== id) {
        throw new Error(`Avatar frame spec "${loaded.id}" is registered under "${id}"`);
      }
      return loaded;
    });
    loadedFrames.set(id, spec);
  }
  return spec;
}
