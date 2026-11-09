/**
 * Avatar frame registry: one decoration spec loader per catalog frame id. Every frame is its own
 * lazy chunk (the 150 generated common / rare frames share one), loaded the first time a seat
 * shows it, so neither the start-up closure nor the scene chunk carries frame artwork. Building
 * the registry fails fast when a catalog id has no loader, and loading checks the spec's id.
 */
import { FRAME_IDS, type FrameId } from '@game-judge/game-engine/product/rewards';

import type { DecorationSpec } from '@/scene/decoration';

type FrameLoader = () => Promise<DecorationSpec>;

const HAND_CRAFTED_FRAMES = {
  eternalCrown: () => import('./eternalCrown').then((module) => module.eternalCrownFrame),
  celestialLoom: () => import('./mythicCollection').then((module) => module.celestialLoomFrame),
  coralTide: () => import('./mythicCollection').then((module) => module.coralTideFrame),
  inkLandscape: () => import('./mythicCollection').then((module) => module.inkLandscapeFrame),
  ironForge: () => import('./ironForge').then((module) => module.ironForgeFrame),
  moonSilver: () => import('./moonSilver').then((module) => module.moonSilverFrame),
  bloodThorn: () => import('./bloodThorn').then((module) => module.bloodThornFrame),
  runicSeal: () => import('./runicSeal').then((module) => module.runicSealFrame),
  boneGate: () => import('./boneGate').then((module) => module.boneGateFrame),
  hellFire: () => import('./hellFire').then((module) => module.hellFireFrame),
  frostCrystal: () => import('./frostCrystal').then((module) => module.frostCrystalFrame),
  jadeSeal: () => import('./jadeSeal').then((module) => module.jadeSealFrame),
  emberAsh: () => import('./emberAsh').then((module) => module.emberAshFrame),
  nightShade: () => import('./nightShade').then((module) => module.nightShadeFrame),
  sunForge: () => import('./sunForge').then((module) => module.sunForgeFrame),
  crystalVein: () => import('./crystalVein').then((module) => module.crystalVeinFrame),
  wolfFang: () => import('./wolfFang').then((module) => module.wolfFangFrame),
  serpentScale: () => import('./serpentScale').then((module) => module.serpentScaleFrame),
  thornCrown: () => import('./thornCrown').then((module) => module.thornCrownFrame),
  mysticRune: () => import('./mysticRune').then((module) => module.mysticRuneFrame),
  wildBriar: () => import('./wildBriar').then((module) => module.wildBriarFrame),
  venomGlass: () => import('./venomGlass').then((module) => module.venomGlassFrame),
  starForge: () => import('./starForge').then((module) => module.starForgeFrame),
  duskIron: () => import('./duskIron').then((module) => module.duskIronFrame),
  spectralEdge: () => import('./spectralEdge').then((module) => module.spectralEdgeFrame),
  wraithBone: () => import('./wraithBone').then((module) => module.wraithBoneFrame),
  viperCoil: () => import('./viperCoil').then((module) => module.viperCoilFrame),
  moonGate: () => import('./moonGate').then((module) => module.moonGateFrame),
  stormWeave: () => import('./stormWeave').then((module) => module.stormWeaveFrame),
  sandStone: () => import('./sandStone').then((module) => module.sandStoneFrame),
  ravenWing: () => import('./ravenWing').then((module) => module.ravenWingFrame),
  frostForge: () => import('./frostForge').then((module) => module.frostForgeFrame),
  goldLeaf: () => import('./goldLeaf').then((module) => module.goldLeafFrame),
  spiritBark: () => import('./spiritBark').then((module) => module.spiritBarkFrame),
  nightBloom: () => import('./nightBloom').then((module) => module.nightBloomFrame),
  flameThorn: () => import('./flameThorn').then((module) => module.flameThornFrame),
  oceanDeep: () => import('./oceanDeep').then((module) => module.oceanDeepFrame),
  thunderForge: () => import('./thunderForge').then((module) => module.thunderForgeFrame),
  witchMark: () => import('./witchMark').then((module) => module.witchMarkFrame),
  lionCrest: () => import('./lionCrest').then((module) => module.lionCrestFrame),
  sirenCall: () => import('./sirenCall').then((module) => module.sirenCallFrame),
  ashWood: () => import('./ashWood').then((module) => module.ashWoodFrame),
  crystalThorn: () => import('./crystalThorn').then((module) => module.crystalThornFrame),
  stormBolt: () => import('./stormBolt').then((module) => module.stormBoltFrame),
  dragonScale: () => import('./dragonScale').then((module) => module.dragonScaleFrame),
  starNebula: () => import('./starNebula').then((module) => module.starNebulaFrame),
  shadowWeave: () => import('./shadowWeave').then((module) => module.shadowWeaveFrame),
  celestialRing: () => import('./celestialRing').then((module) => module.celestialRingFrame),
  obsidianEdge: () => import('./obsidianEdge').then((module) => module.obsidianEdgeFrame),
  pharaohGold: () => import('./pharaohGold').then((module) => module.pharaohGoldFrame),
  voidRift: () => import('./voidRift').then((module) => module.voidRiftFrame),
  coralReef: () => import('./coralReef').then((module) => module.coralReefFrame),
  darkVine: () => import('./darkVine').then((module) => module.darkVineFrame),
  sakuraDrift: () => import('./sakuraDrift').then((module) => module.sakuraDriftFrame),
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
        loader = () => import('./common').then((module) => module.generatedFrame(id));
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
 * Rejects when its chunk fails to load or holds a spec registered under another id.
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
