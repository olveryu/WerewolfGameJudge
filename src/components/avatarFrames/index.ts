/**
 * avatarFrames — 头像框注册表
 *
 * FrameId 类型从 `@werewolf/game-engine/growth/rewardCatalog` 的 FRAME_IDS 派生。
 * 通过 getFrameComponent 按 id 获取对应的 SVG 渲染组件。
 * 不引入 service、theme。
 */
import { FRAME_IDS, type FrameId } from '@werewolf/game-engine/growth/rewardCatalog';
import type React from 'react';

import { AshWoodFrame } from './AshWoodFrame';
import { BloodThornFrame } from './BloodThornFrame';
import { BoneGateFrame } from './BoneGateFrame';
import { CelestialRingFrame } from './CelestialRingFrame';
import { COMMON_FRAME_ENTRIES, RARE_FRAME_ENTRIES } from './common';
import { CoralReefFrame } from './CoralReefFrame';
import { CrystalThornFrame } from './CrystalThornFrame';
import { CrystalVeinFrame } from './CrystalVeinFrame';
import { DarkVineFrame } from './DarkVineFrame';
import { DragonScaleFrame } from './DragonScaleFrame';
import { DuskIronFrame } from './DuskIronFrame';
import { EmberAshFrame } from './EmberAshFrame';
import { FlameThornFrame } from './FlameThornFrame';
import type { FrameProps } from './FrameProps';
import { FrostCrystalFrame } from './FrostCrystalFrame';
import { FrostForgeFrame } from './FrostForgeFrame';
import { GoldLeafFrame } from './GoldLeafFrame';
import { HellFireFrame } from './HellFireFrame';
import { IronForgeFrame } from './IronForgeFrame';
import { JadeSealFrame } from './JadeSealFrame';
import { LionCrestFrame } from './LionCrestFrame';
import { MoonGateFrame } from './MoonGateFrame';
import { MoonSilverFrame } from './MoonSilverFrame';
import { MysticRuneFrame } from './MysticRuneFrame';
import { NightBloomFrame } from './NightBloomFrame';
import { NightShadeFrame } from './NightShadeFrame';
import { ObsidianEdgeFrame } from './ObsidianEdgeFrame';
import { OceanDeepFrame } from './OceanDeepFrame';
import { PharaohGoldFrame } from './PharaohGoldFrame';
import { RavenWingFrame } from './RavenWingFrame';
import { RunicSealFrame } from './RunicSealFrame';
import { SakuraDriftFrame } from './SakuraDriftFrame';
import { SandStoneFrame } from './SandStoneFrame';
import { SerpentScaleFrame } from './SerpentScaleFrame';
import { ShadowWeaveFrame } from './ShadowWeaveFrame';
import { SirenCallFrame } from './SirenCallFrame';
import { SpectralEdgeFrame } from './SpectralEdgeFrame';
import { SpiritBarkFrame } from './SpiritBarkFrame';
import { StarForgeFrame } from './StarForgeFrame';
import { StarNebulaFrame } from './StarNebulaFrame';
import { StormBoltFrame } from './StormBoltFrame';
import { StormWeaveFrame } from './StormWeaveFrame';
import { SunForgeFrame } from './SunForgeFrame';
import { ThornCrownFrame } from './ThornCrownFrame';
import { ThunderForgeFrame } from './ThunderForgeFrame';
import { VenomGlassFrame } from './VenomGlassFrame';
import { ViperCoilFrame } from './ViperCoilFrame';
import { VoidRiftFrame } from './VoidRiftFrame';
import { WildBriarFrame } from './WildBriarFrame';
import { WitchMarkFrame } from './WitchMarkFrame';
import { WolfFangFrame } from './WolfFangFrame';
import { WraithBoneFrame } from './WraithBoneFrame';

export type { FrameId };

interface AvatarFrameConfig {
  /** 中文显示名 */
  name: string;
  /** SVG 渲染组件 */
  Component: React.ComponentType<FrameProps>;
}

/**
 * 头像框注册表（exhaustive Record）—— FRAME_IDS 新增 ID 而此处未添加 → TS 编译报错。
 * UI 展示顺序跟随 FRAME_IDS。
 * 静态条目手动列举；Common 50 条从 factory 展开（runtime 由 gachaProbability 测试覆盖）。
 */
function buildFrameRegistry(): Record<FrameId, AvatarFrameConfig> {
  // Static entries — manually listed for unique hand-crafted frames
  const staticEntries: Record<string, AvatarFrameConfig> = {
    ironForge: { name: '铁锻', Component: IronForgeFrame },
    moonSilver: { name: '月银', Component: MoonSilverFrame },
    bloodThorn: { name: '血棘', Component: BloodThornFrame },
    runicSeal: { name: '符印', Component: RunicSealFrame },
    boneGate: { name: '骨门', Component: BoneGateFrame },
    hellFire: { name: '狱焰', Component: HellFireFrame },
    darkVine: { name: '暗藤', Component: DarkVineFrame },
    frostCrystal: { name: '霜晶', Component: FrostCrystalFrame },
    pharaohGold: { name: '墓金', Component: PharaohGoldFrame },
    voidRift: { name: '虚裂', Component: VoidRiftFrame },
    stormBolt: { name: '雷暴', Component: StormBoltFrame },
    sakuraDrift: { name: '樱散', Component: SakuraDriftFrame },
    dragonScale: { name: '龙鳞', Component: DragonScaleFrame },
    jadeSeal: { name: '玉印', Component: JadeSealFrame },
    starNebula: { name: '星云', Component: StarNebulaFrame },
    shadowWeave: { name: '影织', Component: ShadowWeaveFrame },
    coralReef: { name: '珊瑚', Component: CoralReefFrame },
    emberAsh: { name: '余烬', Component: EmberAshFrame },
    celestialRing: { name: '天环', Component: CelestialRingFrame },
    obsidianEdge: { name: '黑曜', Component: ObsidianEdgeFrame },
    nightShade: { name: '夜影', Component: NightShadeFrame },
    sunForge: { name: '日锻', Component: SunForgeFrame },
    crystalVein: { name: '晶脉', Component: CrystalVeinFrame },
    wolfFang: { name: '狼牙', Component: WolfFangFrame },
    serpentScale: { name: '蛇鳞', Component: SerpentScaleFrame },
    thornCrown: { name: '荆冠', Component: ThornCrownFrame },
    mysticRune: { name: '秘文', Component: MysticRuneFrame },
    wildBriar: { name: '野蔷薇', Component: WildBriarFrame },
    venomGlass: { name: '毒玻璃', Component: VenomGlassFrame },
    starForge: { name: '星锻', Component: StarForgeFrame },
    duskIron: { name: '暮铁', Component: DuskIronFrame },
    spectralEdge: { name: '幽光刃', Component: SpectralEdgeFrame },
    wraithBone: { name: '幽骨', Component: WraithBoneFrame },
    viperCoil: { name: '蝰蛇', Component: ViperCoilFrame },
    moonGate: { name: '月门', Component: MoonGateFrame },
    stormWeave: { name: '风暴织', Component: StormWeaveFrame },
    sandStone: { name: '砂岩', Component: SandStoneFrame },
    ravenWing: { name: '鸦羽', Component: RavenWingFrame },
    frostForge: { name: '霜锻', Component: FrostForgeFrame },
    goldLeaf: { name: '金箔', Component: GoldLeafFrame },
    spiritBark: { name: '灵木', Component: SpiritBarkFrame },
    nightBloom: { name: '夜绽', Component: NightBloomFrame },
    flameThorn: { name: '焰棘', Component: FlameThornFrame },
    oceanDeep: { name: '深海', Component: OceanDeepFrame },
    thunderForge: { name: '雷锻', Component: ThunderForgeFrame },
    witchMark: { name: '巫痕', Component: WitchMarkFrame },
    lionCrest: { name: '狮纹', Component: LionCrestFrame },
    sirenCall: { name: '海妖', Component: SirenCallFrame },
    ashWood: { name: '灰木', Component: AshWoodFrame },
    crystalThorn: { name: '晶棘', Component: CrystalThornFrame },
  };
  // Merge static + common factory entries.
  // Exhaustiveness validated by gachaProbability test (REWARD_POOL counts).
  return { ...staticEntries, ...COMMON_FRAME_ENTRIES, ...RARE_FRAME_ENTRIES } as Record<
    FrameId,
    AvatarFrameConfig
  >;
}
const FRAME_REGISTRY = buildFrameRegistry();

/** 所有可用头像框（顺序 = FRAME_IDS 展示顺序） */
export const AVATAR_FRAMES: readonly (AvatarFrameConfig & { id: FrameId })[] = FRAME_IDS.map(
  (id) => ({ id, ...FRAME_REGISTRY[id] }),
);

const FRAME_MAP = new Map<string, AvatarFrameConfig>(AVATAR_FRAMES.map((f) => [f.id, f]));

/** 按 id 获取头像框配置。无效 id 返回 undefined。 */
export function getFrameById(id: string | null | undefined): AvatarFrameConfig | undefined {
  if (!id) return undefined;
  return FRAME_MAP.get(id);
}
