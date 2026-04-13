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
import { DarkVineFrame } from './DarkVineFrame';
import type { FrameProps } from './FrameProps';
import { FrostCrystalFrame } from './FrostCrystalFrame';
import { HellFireFrame } from './HellFireFrame';
import { IronForgeFrame } from './IronForgeFrame';
import { MoonSilverFrame } from './MoonSilverFrame';
import { PharaohGoldFrame } from './PharaohGoldFrame';
import { RunicSealFrame } from './RunicSealFrame';
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
