/**
 * Common frame factory — generates 50 colored frame variants (5 shapes × 10 colors).
 *
 * Each entry maps a FrameId to { name, Component }.
 * Components are memo'd wrappers that bake in the color, exposing only FrameProps.
 */
import type React from 'react';
import { memo } from 'react';

import type { FrameProps } from '../FrameProps';
import {
  CN_COLOR_NAMES,
  FRAME_PALETTE,
  type FrameColorSet,
  PALETTE_KEYS,
  type PaletteKey,
} from './palette';
import { SimpleDashFrame } from './SimpleDashFrame';
import { SimpleDoubleFrame } from './SimpleDoubleFrame';
import { SimpleOctagonFrame } from './SimpleOctagonFrame';
import { SimpleRoundFrame } from './SimpleRoundFrame';
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

const SHAPES: readonly ShapeDef[] = [
  { prefix: 'round', label: '圆环', template: SimpleRoundFrame },
  { prefix: 'square', label: '方框', template: SimpleSquareFrame },
  { prefix: 'octagon', label: '八角', template: SimpleOctagonFrame },
  { prefix: 'dash', label: '虚线', template: SimpleDashFrame },
  { prefix: 'double', label: '双线', template: SimpleDoubleFrame },
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
 * 50 common frame entries keyed by FrameId string.
 * Spread into FRAME_REGISTRY in ../index.ts.
 */
export const COMMON_FRAME_ENTRIES: Record<string, CommonFrameEntry> = {};

for (const shape of SHAPES) {
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
