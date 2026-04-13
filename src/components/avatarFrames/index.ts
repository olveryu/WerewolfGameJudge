/**
 * avatarFrames — 头像框注册表
 *
 * FrameId 类型从 `@werewolf/game-engine/growth/rewardCatalog` 的 FRAME_IDS 派生。
 * 通过 getFrameComponent 按 id 获取对应的 SVG 渲染组件。
 * 不引入 service、theme。
 */
import { FRAME_IDS, type FrameId } from '@werewolf/game-engine/growth/rewardCatalog';
import type React from 'react';

import { BloodThornFrame } from './BloodThornFrame';
import { BoneGateFrame } from './BoneGateFrame';
import { CelestialRingFrame } from './CelestialRingFrame';
import { CoralReefFrame } from './CoralReefFrame';
import { DarkVineFrame } from './DarkVineFrame';
import { DragonScaleFrame } from './DragonScaleFrame';
import { EmberAshFrame } from './EmberAshFrame';
import type { FrameProps } from './FrameProps';
import { FrostCrystalFrame } from './FrostCrystalFrame';
import { HellFireFrame } from './HellFireFrame';
import { IronForgeFrame } from './IronForgeFrame';
import { JadeSealFrame } from './JadeSealFrame';
import { MoonSilverFrame } from './MoonSilverFrame';
import { ObsidianEdgeFrame } from './ObsidianEdgeFrame';
import { PharaohGoldFrame } from './PharaohGoldFrame';
import { RunicSealFrame } from './RunicSealFrame';
import { SakuraDriftFrame } from './SakuraDriftFrame';
import { ShadowWeaveFrame } from './ShadowWeaveFrame';
import { StarNebulaFrame } from './StarNebulaFrame';
import { StormBoltFrame } from './StormBoltFrame';
import { VoidRiftFrame } from './VoidRiftFrame';

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
 */
const FRAME_REGISTRY: Record<FrameId, AvatarFrameConfig> = {
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
};

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
