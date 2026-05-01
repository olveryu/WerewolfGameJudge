/**
 * Common + Rare flair factory — generates 100 common + 50 rare colored flair variants.
 *
 * Common: 10 patterns × 10 colors = 100 (simple single-animation)
 * Rare:    5 patterns × 10 colors =  50 (multi-element, phase offsets, more particles)
 *
 * Each entry maps a FlairId to { name, Component }.
 * Components are memo'd wrappers that bake in the color, exposing only FlairProps.
 */
import type React from 'react';
import { memo } from 'react';

import type { FlairProps } from '../FlairProps';
import { AuroraFlair } from './AuroraFlair';
import { BreatheFlair } from './BreatheFlair';
import { CascadeFlair } from './CascadeFlair';
import { ConstellationFlair } from './ConstellationFlair';
import { DriftFlair } from './DriftFlair';
import { FireflyFlair } from './FireflyFlair';
import { FlickerFlair } from './FlickerFlair';
import { FloatFlair } from './FloatFlair';
import { GlowFlair } from './GlowFlair';
import { OrbitFlair } from './OrbitFlair';
import { CN_FLAIR_COLORS, FLAIR_PALETTE, FLAIR_PALETTE_KEYS, type FlairColorSet } from './palette';
import { PulseFlair } from './PulseFlair';
import { RippleFlair } from './RippleFlair';
import { SparkleFlair } from './SparkleFlair';
import { VortexFlair } from './VortexFlair';
import { WaveFlair } from './WaveFlair';

// ── Pattern definitions ─────────────────────────────────────────────────────

interface PatternDef {
  /** ID prefix, e.g. 'pulse' → 'pulseRed' */
  prefix: string;
  /** Chinese pattern label, e.g. '脉冲' */
  label: string;
  /** Template component (accepts FlairProps + colors) */
  template: React.ComponentType<FlairProps & { colors: FlairColorSet }>;
}

/** Common patterns — simple single-animation */
const COMMON_PATTERNS: readonly PatternDef[] = [
  { prefix: 'pulse', label: '脉冲', template: PulseFlair },
  { prefix: 'glow', label: '微光', template: GlowFlair },
  { prefix: 'sparkle', label: '星点', template: SparkleFlair },
  { prefix: 'breathe', label: '呼吸', template: BreatheFlair },
  { prefix: 'float', label: '浮点', template: FloatFlair },
  { prefix: 'ripple', label: '涟漪', template: RippleFlair },
  { prefix: 'orbit', label: '轨道', template: OrbitFlair },
  { prefix: 'flicker', label: '闪烁', template: FlickerFlair },
  { prefix: 'drift', label: '飘浮', template: DriftFlair },
  { prefix: 'wave', label: '波纹', template: WaveFlair },
];

/** Rare patterns — multi-element, phase offsets, more particles */
const RARE_PATTERNS: readonly PatternDef[] = [
  { prefix: 'cascade', label: '瀑布', template: CascadeFlair },
  { prefix: 'vortex', label: '旋涡', template: VortexFlair },
  { prefix: 'constellation', label: '星座', template: ConstellationFlair },
  { prefix: 'aurora', label: '极光', template: AuroraFlair },
  { prefix: 'firefly', label: '萤火', template: FireflyFlair },
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
 * 100 common flair entries keyed by FlairId string.
 * Spread into FLAIR_REGISTRY in ../index.ts.
 */
export const COMMON_FLAIR_ENTRIES: Record<string, CommonFlairEntry> = {};

for (const pattern of COMMON_PATTERNS) {
  for (const colorKey of FLAIR_PALETTE_KEYS) {
    const id = `${pattern.prefix}${colorKey[0]!.toUpperCase()}${colorKey.slice(1)}`;
    const name = `${CN_FLAIR_COLORS[colorKey]}${pattern.label}`;
    const colors = FLAIR_PALETTE[colorKey];
    COMMON_FLAIR_ENTRIES[id] = {
      name,
      Component: createVariant(pattern.template, colors, `${pattern.prefix}Flair(${colorKey})`),
    };
  }
}

/**
 * 50 rare flair entries keyed by FlairId string.
 * Spread into FLAIR_REGISTRY in ../index.ts.
 */
export const RARE_FLAIR_ENTRIES: Record<string, CommonFlairEntry> = {};

for (const pattern of RARE_PATTERNS) {
  for (const colorKey of FLAIR_PALETTE_KEYS) {
    const id = `${pattern.prefix}${colorKey[0]!.toUpperCase()}${colorKey.slice(1)}`;
    const name = `${CN_FLAIR_COLORS[colorKey]}${pattern.label}`;
    const colors = FLAIR_PALETTE[colorKey];
    RARE_FLAIR_ENTRIES[id] = {
      name,
      Component: createVariant(pattern.template, colors, `${pattern.prefix}Flair(${colorKey})`),
    };
  }
}
