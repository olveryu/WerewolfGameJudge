/**
 * avatarFrames — 头像框注册表
 *
 * 定义 FrameId 联合类型和 AVATAR_FRAMES 配置数组。
 * 通过 getFrameComponent 按 id 获取对应的 SVG 渲染组件。
 * 不引入 service、theme。
 */
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

export type { FrameProps } from './FrameProps';

/** 可选的 10 款正方形头像框 ID */
export type FrameId =
  | 'ironForge'
  | 'moonSilver'
  | 'bloodThorn'
  | 'runicSeal'
  | 'boneGate'
  | 'hellFire'
  | 'darkVine'
  | 'frostCrystal'
  | 'pharaohGold'
  | 'voidRift';

export interface AvatarFrameConfig {
  id: FrameId;
  /** 中文显示名 */
  name: string;
  /** SVG 渲染组件 */
  Component: React.ComponentType<FrameProps>;
}

/** 所有可用头像框（顺序 = UI 展示顺序） */
export const AVATAR_FRAMES: readonly AvatarFrameConfig[] = [
  { id: 'ironForge', name: '铁锻', Component: IronForgeFrame },
  { id: 'moonSilver', name: '月银', Component: MoonSilverFrame },
  { id: 'bloodThorn', name: '血棘', Component: BloodThornFrame },
  { id: 'runicSeal', name: '符印', Component: RunicSealFrame },
  { id: 'boneGate', name: '骨门', Component: BoneGateFrame },
  { id: 'hellFire', name: '狱焰', Component: HellFireFrame },
  { id: 'darkVine', name: '暗藤', Component: DarkVineFrame },
  { id: 'frostCrystal', name: '霜晶', Component: FrostCrystalFrame },
  { id: 'pharaohGold', name: '墓金', Component: PharaohGoldFrame },
  { id: 'voidRift', name: '虚裂', Component: VoidRiftFrame },
] as const;

const FRAME_MAP = new Map<string, AvatarFrameConfig>(AVATAR_FRAMES.map((f) => [f.id, f]));

/** 按 id 获取头像框配置。无效 id 返回 undefined。 */
export function getFrameById(id: string | null | undefined): AvatarFrameConfig | undefined {
  if (!id) return undefined;
  return FRAME_MAP.get(id);
}

/** 校验字符串是否为合法 FrameId */
export function isValidFrameId(id: string | null | undefined): id is FrameId {
  return !!id && FRAME_MAP.has(id);
}
