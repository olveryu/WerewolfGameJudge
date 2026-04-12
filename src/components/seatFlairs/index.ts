/**
 * seatFlairs — 座位装饰注册表
 *
 * FlairId 类型从 `@werewolf/game-engine/growth/rewardCatalog` 的 SEAT_FLAIR_IDS 派生。
 * 通过 getFlairById 按 id 获取对应的 Reanimated 动画组件。
 * pattern 同 `avatarFrames/index.ts`。
 */
import { SEAT_FLAIR_IDS } from '@werewolf/game-engine/growth/rewardCatalog';
import type React from 'react';

import { BloodMarkFlair } from './BloodMarkFlair';
import { EmberGlowFlair } from './EmberGlowFlair';
import { FireRingFlair } from './FireRingFlair';
import type { FlairProps } from './FlairProps';
import { FrostAuraFlair } from './FrostAuraFlair';
import { GoldenShineFlair } from './GoldenShineFlair';
import { RuneCircleFlair } from './RuneCircleFlair';
import { SakuraFlair } from './SakuraFlair';
import { ShadowMistFlair } from './ShadowMistFlair';
import { StarlightFlair } from './StarlightFlair';
import { ThunderBoltFlair } from './ThunderBoltFlair';

/** 可选的座位装饰 ID（从 shared catalog 派生） */
export type FlairId = (typeof SEAT_FLAIR_IDS)[number];

interface SeatFlairConfig {
  id: FlairId;
  /** 中文显示名 */
  name: string;
  /** Skia 粒子/光效动画组件 */
  Component: React.ComponentType<FlairProps>;
}

/** 所有可用座位装饰（顺序 = UI 展示顺序） */
export const SEAT_FLAIRS: readonly SeatFlairConfig[] = [
  { id: 'emberGlow', name: '余烬微光', Component: EmberGlowFlair },
  { id: 'frostAura', name: '寒霜气场', Component: FrostAuraFlair },
  { id: 'shadowMist', name: '暗影迷雾', Component: ShadowMistFlair },
  { id: 'goldenShine', name: '金色闪耀', Component: GoldenShineFlair },
  { id: 'bloodMark', name: '血月印记', Component: BloodMarkFlair },
  { id: 'starlight', name: '星光点缀', Component: StarlightFlair },
  { id: 'thunderBolt', name: '雷鸣电闪', Component: ThunderBoltFlair },
  { id: 'sakura', name: '樱花飘落', Component: SakuraFlair },
  { id: 'runeCircle', name: '符文之环', Component: RuneCircleFlair },
  { id: 'fireRing', name: '烈焰之环', Component: FireRingFlair },
] as const;

const FLAIR_MAP = new Map<string, SeatFlairConfig>(SEAT_FLAIRS.map((f) => [f.id, f]));

/** 按 id 获取座位装饰配置。无效 id 返回 undefined。 */
export function getFlairById(id: string | null | undefined): SeatFlairConfig | undefined {
  if (!id) return undefined;
  return FLAIR_MAP.get(id);
}
