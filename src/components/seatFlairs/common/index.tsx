/**
 * Common flair factory — generates 50 colored flair variants (5 patterns × 10 colors).
 *
 * Each entry maps a FlairId to { name, Component }.
 * Components are memo'd wrappers that bake in the color, exposing only FlairProps.
 */
import type React from 'react';
import { memo } from 'react';

import type { FlairProps } from '../FlairProps';
import { BreatheFlair } from './BreatheFlair';
import { FloatFlair } from './FloatFlair';
import { GlowFlair } from './GlowFlair';
import {
  CN_FLAIR_COLORS,
  FLAIR_PALETTE,
  FLAIR_PALETTE_KEYS,
  type FlairColorSet,
  type FlairPaletteKey,
} from './palette';
import { PulseFlair } from './PulseFlair';
import { SparkleFlair } from './SparkleFlair';

// ── Pattern definitions ─────────────────────────────────────────────────────

interface PatternDef {
  /** ID prefix, e.g. 'pulse' → 'pulseRed' */
  prefix: string;
  /** Chinese pattern label, e.g. '脉冲' */
  label: string;
  /** Template component (accepts FlairProps + colors) */
  template: React.ComponentType<FlairProps & { colors: FlairColorSet }>;
}

const PATTERNS: readonly PatternDef[] = [
  { prefix: 'pulse', label: '脉冲', template: PulseFlair },
  { prefix: 'glow', label: '微光', template: GlowFlair },
  { prefix: 'sparkle', label: '星点', template: SparkleFlair },
  { prefix: 'breathe', label: '呼吸', template: BreatheFlair },
  { prefix: 'float', label: '浮点', template: FloatFlair },
];

// ── Factory ─────────────────────────────────────────────────────────────────

interface CommonFlairEntry {
  name: string;
  Component: React.ComponentType<FlairProps>;
}

function createVariant(
  templateComponent: React.ComponentType<FlairProps & { colors: FlairColorSet }>,
  colors: FlairColorSet,
  displayName: string,
): React.ComponentType<FlairProps> {
  const Template = templateComponent;
  const Variant = memo<FlairProps>((props) => <Template {...props} colors={colors} />);
  Variant.displayName = displayName;
  return Variant;
}

/**
 * 50 common flair entries keyed by FlairId string.
 * Spread into FLAIR_REGISTRY in ../index.ts.
 */
export const COMMON_FLAIR_ENTRIES: Record<string, CommonFlairEntry> = {};

for (const pattern of PATTERNS) {
  for (const colorKey of FLAIR_PALETTE_KEYS) {
    const id = `${pattern.prefix}${colorKey[0].toUpperCase()}${colorKey.slice(1)}`;
    const name = `${CN_FLAIR_COLORS[colorKey]}${pattern.label}`;
    const colors = FLAIR_PALETTE[colorKey as FlairPaletteKey];
    COMMON_FLAIR_ENTRIES[id] = {
      name,
      Component: createVariant(pattern.template, colors, `${pattern.prefix}Flair(${colorKey})`),
    };
  }
}
