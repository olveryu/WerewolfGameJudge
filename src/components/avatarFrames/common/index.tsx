/**
 * Common + Rare frame factory — generates 100 common + 50 rare colored frame variants.
 *
 * Common: 10 shapes × 10 colors = 100 (simple single-border geometry)
 * Rare:    5 shapes × 10 colors =  50 (multi-layer, decorative details)
 *
 * Each entry maps a FrameId to { name, Component }.
 * Components are memo'd wrappers that bake in the color, exposing only FrameProps.
 */
import type React from 'react';
import { memo } from 'react';

import type { FrameProps } from '../FrameProps';
import { ChainFrame } from './ChainFrame';
import { FiligreeFrame } from './FiligreeFrame';
import { GemFrame } from './GemFrame';
import { GrooveFrame } from './GrooveFrame';
import { InlayFrame } from './InlayFrame';
import {
  CN_COLOR_NAMES,
  FRAME_PALETTE,
  type FrameColorSet,
  PALETTE_KEYS,
  type PaletteKey,
} from './palette';
import { SimpleBevelFrame } from './SimpleBevelFrame';
import { SimpleCrossFrame } from './SimpleCrossFrame';
import { SimpleDashFrame } from './SimpleDashFrame';
import { SimpleDiamondFrame } from './SimpleDiamondFrame';
import { SimpleDoubleFrame } from './SimpleDoubleFrame';
import { SimpleNotchFrame } from './SimpleNotchFrame';
import { SimpleOctagonFrame } from './SimpleOctagonFrame';
import { SimpleRoundFrame } from './SimpleRoundFrame';
import { SimpleScallopFrame } from './SimpleScallopFrame';
import { SimpleSquareFrame } from './SimpleSquareFrame';

// ── Shape definitions ───────────────────────────────────────────────────────

interface ShapeDef {
  /** ID prefix, e.g. 'round' → 'roundRed' */
  prefix: string;
  /** Chinese shape label, e.g. '圆环' */
  label: string;
  /** Template component (accepts FrameProps + colors) */
  template: React.ComponentType<FrameProps & { colors: FrameColorSet }>;
}

/** Common shapes — simple single-border geometry */
const COMMON_SHAPES: readonly ShapeDef[] = [
  { prefix: 'round', label: '圆环', template: SimpleRoundFrame },
  { prefix: 'square', label: '方框', template: SimpleSquareFrame },
  { prefix: 'octagon', label: '八角', template: SimpleOctagonFrame },
  { prefix: 'dash', label: '虚线', template: SimpleDashFrame },
  { prefix: 'double', label: '双线', template: SimpleDoubleFrame },
  { prefix: 'diamond', label: '菱形', template: SimpleDiamondFrame },
  { prefix: 'scallop', label: '波浪', template: SimpleScallopFrame },
  { prefix: 'cross', label: '十字', template: SimpleCrossFrame },
  { prefix: 'notch', label: '缺角', template: SimpleNotchFrame },
  { prefix: 'bevel', label: '斜面', template: SimpleBevelFrame },
];

/** Rare shapes — multi-layer, decorative details (corner scrolls, gems, chains) */
const RARE_SHAPES: readonly ShapeDef[] = [
  { prefix: 'inlay', label: '嵌边', template: InlayFrame },
  { prefix: 'gem', label: '宝石', template: GemFrame },
  { prefix: 'filigree', label: '花纹', template: FiligreeFrame },
  { prefix: 'chain', label: '锁链', template: ChainFrame },
  { prefix: 'groove', label: '槽纹', template: GrooveFrame },
];

// ── Factory ─────────────────────────────────────────────────────────────────

interface CommonFrameEntry {
  name: string;
  Component: React.ComponentType<FrameProps>;
}

function createVariant(
  templateComponent: React.ComponentType<FrameProps & { colors: FrameColorSet }>,
  colors: FrameColorSet,
  displayName: string,
): React.ComponentType<FrameProps> {
  const Template = templateComponent;
  const Variant = memo<FrameProps>((props) => <Template {...props} colors={colors} />);
  Variant.displayName = displayName;
  return Variant;
}

/**
 * 100 common frame entries keyed by FrameId string.
 * Spread into FRAME_REGISTRY in ../index.ts.
 */
export const COMMON_FRAME_ENTRIES: Record<string, CommonFrameEntry> = {};

for (const shape of COMMON_SHAPES) {
  for (const colorKey of PALETTE_KEYS) {
    const id = `${shape.prefix}${colorKey[0].toUpperCase()}${colorKey.slice(1)}`;
    const name = `${CN_COLOR_NAMES[colorKey]}${shape.label}`;
    const colors = FRAME_PALETTE[colorKey as PaletteKey];
    COMMON_FRAME_ENTRIES[id] = {
      name,
      Component: createVariant(shape.template, colors, `${shape.prefix}Frame(${colorKey})`),
    };
  }
}

/**
 * 50 rare frame entries keyed by FrameId string.
 * Spread into FRAME_REGISTRY in ../index.ts.
 */
export const RARE_FRAME_ENTRIES: Record<string, CommonFrameEntry> = {};

for (const shape of RARE_SHAPES) {
  for (const colorKey of PALETTE_KEYS) {
    const id = `${shape.prefix}${colorKey[0].toUpperCase()}${colorKey.slice(1)}`;
    const name = `${CN_COLOR_NAMES[colorKey]}${shape.label}`;
    const colors = FRAME_PALETTE[colorKey as PaletteKey];
    RARE_FRAME_ENTRIES[id] = {
      name,
      Component: createVariant(shape.template, colors, `${shape.prefix}Frame(${colorKey})`),
    };
  }
}
