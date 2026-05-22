/**
 * seatFlairs — 座位装饰注册表
 *
 * FlairId 类型从 `@werewolf/game-engine/growth/rewardCatalog` 的 SEAT_FLAIR_IDS 派生。
 * 通过 getFlairById 按 id 获取对应的 Canvas 动画组件（'use dom'）。
 * 所有动画统一由 FlairCanvas + draw/ 模块渲染。
 */
import { type FlairId, SEAT_FLAIR_IDS } from '@werewolf/game-engine/growth/rewardCatalog';
import type React from 'react';
import { memo } from 'react';

import { CN_FLAIR_COLORS, FLAIR_PALETTE, FLAIR_PALETTE_KEYS } from './common/palette';
import type { FlairColors } from './draw/types';
import FlairCanvas from './FlairCanvas';
import type { FlairProps } from './FlairProps';

export type { FlairId };

interface SeatFlairConfig {
  /** 中文显示名 */
  name: string;
  /** Canvas 2D 动画组件（'use dom'） */
  Component: React.ComponentType<FlairProps>;
}

// ── Factory ─────────────────────────────────────────────────────────────────

function createFlairComponent(
  flairId: string,
  colors?: FlairColors,
): React.ComponentType<FlairProps> {
  const Comp = memo<FlairProps>(({ size }) => (
    <FlairCanvas dom={{ matchContents: true }} size={size} flairId={flairId} colors={colors} />
  ));
  Comp.displayName = `Flair(${flairId})`;
  return Comp;
}

// ── Root (Epic/Legendary) 60 entries ────────────────────────────────────────

const ROOT_FLAIR_NAMES: Record<string, string> = {
  emberGlow: '余烬微光',
  frostAura: '寒霜气场',
  shadowMist: '暗影迷雾',
  goldenShine: '金色闪耀',
  bloodMark: '血月印记',
  starlight: '星光点缀',
  thunderBolt: '雷鸣电闪',
  sakura: '樱花飘落',
  runeCircle: '符文之环',
  fireRing: '烈焰之环',
  lunarHalo: '月华光环',
  sonicWave: '音波震荡',
  cometTail: '彗星拖尾',
  iceCrystal: '冰晶棱镜',
  phoenixFeather: '凤凰羽',
  ghostWisp: '幽灵鬼火',
  poisonBubble: '剧毒气泡',
  magmaFloat: '熔岩浮石',
  windGust: '疾风粒子',
  snowfall: '纷飞白雪',
  goldSpark: '金星四溅',
  purpleMist: '紫雾缭绕',
  butterfly: '蝶影翩翩',
  lightPillar: '四柱天光',
  shadowClaw: '暗影之爪',
  rainDrop: '细雨绵绵',
  flowerBloom: '繁花盛开',
  firefly: '萤火虫之夜',
  forestLeaf: '落叶知秋',
  prismShard: '棱镜碎片',
  crystalShard: '水晶碎片',
  moonBeam: '月光束',
  darkSmoke: '暗烟升腾',
  solarFlare: '日冕耀斑',
  nightGlow: '夜光虫',
  oceanWave: '海浪涌动',
  thornVine: '荆棘缠绕',
  mistVeil: '迷雾面纱',
  lavaBurst: '熔岩迸发',
  starDust: '星尘飘散',
  arcticWind: '极地寒风',
  thunderClap: '惊雷一击',
  sandStormFlair: '沙暴席卷',
  venomDrip: '毒液滴落',
  auraBurst: '灵气爆发',
  dawnLight: '曙光微照',
  eclipseRing: '日蚀光环',
  blazeTrail: '烈焰轨迹',
  coralGlow: '珊瑚荧光',
  willowWisp: '柳树鬼火',
  jadeMist: '玉雾弥漫',
  obsidianPulse: '黑曜脉动',
  amberDrop: '琥珀坠落',
  silverStream: '银流蜿蜒',
  tidePool: '潮汐水洼',
  mirageHeat: '海市蜃楼',
  petalDance: '花瓣飞舞',
  stormSurge: '风暴潮涌',
  ashCloud: '灰烬之云',
  lunarFrost: '月霜凝结',
};

// ── Parametric (Common + Rare) entries ──────────────────────────────────────

const COMMON_PREFIXES = [
  'pulse',
  'glow',
  'sparkle',
  'breathe',
  'float',
  'ripple',
  'orbit',
  'flicker',
  'drift',
  'wave',
] as const;
const RARE_PREFIXES = ['cascade', 'vortex', 'constellation', 'aurora', 'firefly'] as const;

const CN_PATTERN_NAMES: Record<string, string> = {
  pulse: '脉冲',
  glow: '微光',
  sparkle: '星点',
  breathe: '呼吸',
  float: '浮点',
  ripple: '涟漪',
  orbit: '轨道',
  flicker: '闪烁',
  drift: '飘浮',
  wave: '波纹',
  cascade: '瀑布',
  vortex: '旋涡',
  constellation: '星座',
  aurora: '极光',
  firefly: '萤火',
};

// ── Registry builder ────────────────────────────────────────────────────────

/**
 * 座位装饰注册表（exhaustive Record）—— SEAT_FLAIR_IDS 新增 ID 而此处未添加 → TS 编译报错。
 * UI 展示顺序跟随 SEAT_FLAIR_IDS。
 */
function buildFlairRegistry(): Record<FlairId, SeatFlairConfig> {
  const entries: Record<string, SeatFlairConfig> = {};

  // Root flairs (no colors)
  for (const [id, name] of Object.entries(ROOT_FLAIR_NAMES)) {
    entries[id] = { name, Component: createFlairComponent(id) };
  }

  // Common + Rare parametric flairs (with colors)
  const allPrefixes = [...COMMON_PREFIXES, ...RARE_PREFIXES];
  for (const prefix of allPrefixes) {
    for (const colorKey of FLAIR_PALETTE_KEYS) {
      const id = `${prefix}${colorKey.charAt(0).toUpperCase()}${colorKey.slice(1)}`;
      const name = `${CN_FLAIR_COLORS[colorKey]}${CN_PATTERN_NAMES[prefix]}`;
      const colors = FLAIR_PALETTE[colorKey];
      entries[id] = { name, Component: createFlairComponent(id, colors) };
    }
  }

  return entries as Record<FlairId, SeatFlairConfig>;
}

const FLAIR_REGISTRY = buildFlairRegistry();

/** 所有可用座位装饰（顺序 = SEAT_FLAIR_IDS 展示顺序） */
export const SEAT_FLAIRS: readonly (SeatFlairConfig & { id: FlairId })[] = SEAT_FLAIR_IDS.map(
  (id) => ({ id, ...FLAIR_REGISTRY[id] }),
);

const FLAIR_MAP = new Map<string, SeatFlairConfig>(SEAT_FLAIRS.map((f) => [f.id, f]));

/** 按 id 获取座位装饰配置。无效 id 返回 undefined。 */
export function getFlairById(id: string | null | undefined): SeatFlairConfig | undefined {
  if (!id) return undefined;
  return FLAIR_MAP.get(id);
}
