/**
 * Common + Rare seat animation factory — generates 100 common + 50 rare colored variants.
 *
 * Common: 10 patterns × 10 colors = 100 (simple avatar entrance)
 * Rare:    5 patterns × 10 colors =  50 (SVG particle entrance)
 *
 * Each entry maps an animation ID string to { name, Component }.
 * Components are memo'd wrappers that bake in the color, exposing only SeatAnimationProps.
 */
import type React from 'react';
import { memo } from 'react';

import type { SeatAnimationProps } from '../SeatAnimationProps';
import { BloomEnter } from './BloomEnter';
import { BlurEnter } from './BlurEnter';
import { BounceEnter } from './BounceEnter';
import { FadeEnter } from './FadeEnter';
import { FlipEnter } from './FlipEnter';
import { LightningEnter } from './LightningEnter';
import { CN_FLAIR_COLORS, FLAIR_PALETTE, FLAIR_PALETTE_KEYS, type FlairColorSet } from './palette';
import { PopEnter } from './PopEnter';
import { PortalEnter } from './PortalEnter';
import { ShatterEnter } from './ShatterEnter';
import { SlideDownEnter } from './SlideDownEnter';
import { SlideUpEnter } from './SlideUpEnter';
import { SpinEnter } from './SpinEnter';
import { SpiralEnter } from './SpiralEnter';
import { ZoomInEnter } from './ZoomInEnter';
import { ZoomOutEnter } from './ZoomOutEnter';

// ── Pattern definitions ─────────────────────────────────────────────────────

interface PatternDef {
  /** ID prefix, e.g. 'fade' → 'fadeRedEnter' */
  prefix: string;
  /** Chinese pattern label, e.g. '淡入' */
  label: string;
  /** Template component (accepts SeatAnimationProps + colors) */
  template: React.ComponentType<SeatAnimationProps & { colors: FlairColorSet }>;
}

/** Common patterns — simple avatar entrance transforms */
const COMMON_PATTERNS: readonly PatternDef[] = [
  { prefix: 'fade', label: '淡入', template: FadeEnter },
  { prefix: 'slideUp', label: '上滑', template: SlideUpEnter },
  { prefix: 'slideDown', label: '下滑', template: SlideDownEnter },
  { prefix: 'zoomIn', label: '放大', template: ZoomInEnter },
  { prefix: 'zoomOut', label: '缩小', template: ZoomOutEnter },
  { prefix: 'spin', label: '旋转', template: SpinEnter },
  { prefix: 'bounce', label: '弹跳', template: BounceEnter },
  { prefix: 'flip', label: '翻转', template: FlipEnter },
  { prefix: 'blur', label: '聚焦', template: BlurEnter },
  { prefix: 'pop', label: '弹出', template: PopEnter },
];

/** Rare patterns — SVG particle entrance effects */
const RARE_PATTERNS: readonly PatternDef[] = [
  { prefix: 'spiral', label: '螺旋', template: SpiralEnter },
  { prefix: 'shatter', label: '碎片', template: ShatterEnter },
  { prefix: 'portal', label: '传送门', template: PortalEnter },
  { prefix: 'lightning', label: '闪电', template: LightningEnter },
  { prefix: 'bloom', label: '花开', template: BloomEnter },
];

// ── Factory ─────────────────────────────────────────────────────────────────

interface AnimationEntry {
  name: string;
  Component: React.ComponentType<SeatAnimationProps>;
}

function createVariant(
  templateComponent: React.ComponentType<SeatAnimationProps & { colors: FlairColorSet }>,
  colors: FlairColorSet,
  displayName: string,
): React.ComponentType<SeatAnimationProps> {
  const Template = templateComponent;
  const Variant = memo<SeatAnimationProps>((props) => <Template {...props} colors={colors} />);
  Variant.displayName = displayName;
  return Variant;
}

/**
 * 100 common animation entries keyed by SeatAnimationId string.
 * Spread into the registry in ../index.ts.
 */
export const COMMON_ANIMATION_ENTRIES: Record<string, AnimationEntry> = {};

for (const pattern of COMMON_PATTERNS) {
  for (const colorKey of FLAIR_PALETTE_KEYS) {
    const id = `${pattern.prefix}${colorKey[0].toUpperCase()}${colorKey.slice(1)}Enter`;
    const name = `${CN_FLAIR_COLORS[colorKey]}${pattern.label}`;
    const colors = FLAIR_PALETTE[colorKey];
    COMMON_ANIMATION_ENTRIES[id] = {
      name,
      Component: createVariant(pattern.template, colors, `${pattern.prefix}Enter(${colorKey})`),
    };
  }
}

/**
 * 50 rare animation entries keyed by SeatAnimationId string.
 * Spread into the registry in ../index.ts.
 */
export const RARE_ANIMATION_ENTRIES: Record<string, AnimationEntry> = {};

for (const pattern of RARE_PATTERNS) {
  for (const colorKey of FLAIR_PALETTE_KEYS) {
    const id = `${pattern.prefix}${colorKey[0].toUpperCase()}${colorKey.slice(1)}Enter`;
    const name = `${CN_FLAIR_COLORS[colorKey]}${pattern.label}`;
    const colors = FLAIR_PALETTE[colorKey];
    RARE_ANIMATION_ENTRIES[id] = {
      name,
      Component: createVariant(pattern.template, colors, `${pattern.prefix}Enter(${colorKey})`),
    };
  }
}
