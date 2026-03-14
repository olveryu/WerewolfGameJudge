/**
 * avatarFrames — 头像框注册表
 *
 * 定义 FrameId 联合类型和 AVATAR_FRAMES 配置数组。
 * 通过 getFrameComponent 按 id 获取对应的 SVG 渲染组件。
 * 不引入 React hooks、service、theme。
 */
import type React from 'react';

import {
  ArcaneRuneFrame,
  BloodFlameFrame,
  BrambleFrame,
  type FrameProps,
  LunarFrame,
  WolfFangFrame,
} from './frames';

export type { FrameProps } from './frames';

/** 可选的 5 款头像框 ID */
export type FrameId = 'lunar' | 'wolfFang' | 'arcaneRune' | 'bramble' | 'bloodFlame';

export interface AvatarFrameConfig {
  id: FrameId;
  /** 中文显示名 */
  name: string;
  /** SVG 渲染组件 */
  Component: React.ComponentType<FrameProps>;
}

/** 所有可用头像框（顺序 = UI 展示顺序） */
export const AVATAR_FRAMES: readonly AvatarFrameConfig[] = [
  { id: 'lunar', name: '月轮', Component: LunarFrame },
  { id: 'wolfFang', name: '狼牙', Component: WolfFangFrame },
  { id: 'arcaneRune', name: '符文', Component: ArcaneRuneFrame },
  { id: 'bramble', name: '荆棘', Component: BrambleFrame },
  { id: 'bloodFlame', name: '血焰', Component: BloodFlameFrame },
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
