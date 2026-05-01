/**
 * Name style factory — generates common (100) + rare (50) config entries.
 *
 * Common: 10 prefixes × 10 colors = 100 — single color + 1-layer subtle shadow
 * Rare:    5 prefixes × 10 colors =  50 — single color + 3-layer rich glow
 *
 * Pattern mirrors `avatarFrames/common/index.tsx` and `seatFlairs/common/index.tsx`.
 */
import type { NameStyleConfig, TextShadowLayer } from '../nameStyleConfigs';
import { BASE_PALETTE, COLOR_KEYS, type NameStyleColor } from './palette';

// ── Common (100) ────────────────────────────────────────────────────────────

/** Common prefix definitions — 10 prefixes for 100 variants */
const COMMON_PREFIXES: readonly { prefix: string; cn: string }[] = [
  // Original 5 prefixes (replacing old manual "plain" entries)
  { prefix: 'plain', cn: '' },
  { prefix: 'soft', cn: '柔·' },
  { prefix: 'muted', cn: '雾·' },
  { prefix: 'warm', cn: '暖·' },
  { prefix: 'cool', cn: '凉·' },
  // New 5 prefixes
  { prefix: 'light', cn: '浅·' },
  { prefix: 'dusty', cn: '尘·' },
  { prefix: 'faded', cn: '淡·' },
  { prefix: 'pale', cn: '素·' },
  { prefix: 'hazy', cn: '朦·' },
];

function makeCommonShadow(c: NameStyleColor): TextShadowLayer[] {
  const [r, g, b] = c.rgb;
  return [{ offsetX: 0, offsetY: 0, blur: 2, color: `rgba(${r},${g},${b},0.3)` }];
}

/** Shift hue slightly per prefix for visual variety */
function shiftHex(hex: string, prefixIdx: number): string {
  // Original "plain" prefix uses base hex as-is
  if (prefixIdx === 0) return hex;
  // Other prefixes get subtle lightness/saturation shift
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  // Mix with white (lighten) or gray (mute) based on prefix
  const factors = [1.0, 0.85, 0.75, 0.9, 0.8, 0.95, 0.7, 0.88, 0.92, 0.78];
  const f = factors[prefixIdx]!;
  const mix = prefixIdx <= 4 ? 255 : 180; // warm/cool lighten toward white; others toward gray
  const nr = Math.round(r * f + mix * (1 - f));
  const ng = Math.round(g * f + mix * (1 - f));
  const nb = Math.round(b * f + mix * (1 - f));
  const clamp = (v: number) => Math.min(255, Math.max(0, v));
  return `#${clamp(nr).toString(16).padStart(2, '0')}${clamp(ng).toString(16).padStart(2, '0')}${clamp(nb).toString(16).padStart(2, '0')}`;
}

function shiftRgb(c: NameStyleColor, prefixIdx: number): [number, number, number] {
  const shifted = shiftHex(c.hex, prefixIdx);
  return [
    parseInt(shifted.slice(1, 3), 16),
    parseInt(shifted.slice(3, 5), 16),
    parseInt(shifted.slice(5, 7), 16),
  ];
}

// ── Rare (50) ───────────────────────────────────────────────────────────────

/**
 * Rare prefix definitions — 5 prefixes × 10 colors = 50 variants.
 *
 * Each prefix produces a visually distinct glow treatment:
 * - shimmer:  standard 3-layer glow (focused, close-range halo)
 * - radiant:  lightened color + wider blur (diffuse bright aura)
 * - bright:   saturated core + inner bright kernel shadow
 * - vivid:    hue-shifted ±30° secondary glow (chromatic fringe)
 * - lustrous: complementary-hued outer glow (dual-tone depth)
 */
const RARE_PREFIXES: readonly { prefix: string; cn: string }[] = [
  { prefix: 'shimmer', cn: '辉·' },
  { prefix: 'radiant', cn: '耀·' },
  { prefix: 'bright', cn: '灿·' },
  { prefix: 'vivid', cn: '鲜·' },
  { prefix: 'lustrous', cn: '润·' },
];

// ── Per-prefix shadow factories ─────────────────────────────────────────────

/** Clamp a channel value to [0, 255]. */
const ch = (v: number) => Math.min(255, Math.max(0, Math.round(v)));

/** shimmer: focused 3-layer glow at close range. */
function makeShimmerShadows(c: NameStyleColor): TextShadowLayer[] {
  const [r, g, b] = c.rgb;
  return [
    { offsetX: 0, offsetY: 0, blur: 5, color: `rgba(${r},${g},${b},0.6)` },
    { offsetX: 0, offsetY: 0, blur: 10, color: `rgba(${r},${g},${b},0.35)` },
    {
      offsetX: 0,
      offsetY: 0,
      blur: 2,
      color: `rgba(${ch(r + 60)},${ch(g + 60)},${ch(b + 60)},0.4)`,
    },
  ];
}

/** radiant: lightened color (+40 per channel) with wider, more diffuse blur. */
function makeRadiantShadows(c: NameStyleColor): { color: string; shadows: TextShadowLayer[] } {
  const [r, g, b] = c.rgb;
  const lr = ch(r + 40);
  const lg = ch(g + 40);
  const lb = ch(b + 40);
  return {
    color: `#${lr.toString(16).padStart(2, '0')}${lg.toString(16).padStart(2, '0')}${lb.toString(16).padStart(2, '0')}`,
    shadows: [
      { offsetX: 0, offsetY: 0, blur: 8, color: `rgba(${lr},${lg},${lb},0.55)` },
      { offsetX: 0, offsetY: 0, blur: 16, color: `rgba(${lr},${lg},${lb},0.3)` },
      {
        offsetX: 0,
        offsetY: 0,
        blur: 3,
        color: `rgba(${ch(lr + 30)},${ch(lg + 30)},${ch(lb + 30)},0.35)`,
      },
    ],
  };
}

/** bright: saturated base + tight bright-white inner kernel. */
function makeBrightShadows(c: NameStyleColor): TextShadowLayer[] {
  const [r, g, b] = c.rgb;
  // Boost saturation by pulling away from gray midpoint
  const avg = (r + g + b) / 3;
  const sr = ch(r + (r - avg) * 0.3);
  const sg = ch(g + (g - avg) * 0.3);
  const sb = ch(b + (b - avg) * 0.3);
  return [
    { offsetX: 0, offsetY: 0, blur: 6, color: `rgba(${sr},${sg},${sb},0.65)` },
    { offsetX: 0, offsetY: 0, blur: 12, color: `rgba(${sr},${sg},${sb},0.3)` },
    // Bright inner kernel — near-white core glow
    {
      offsetX: 0,
      offsetY: 0,
      blur: 1,
      color: `rgba(${ch(r + 100)},${ch(g + 100)},${ch(b + 100)},0.5)`,
    },
  ];
}

/**
 * vivid: hue-shifted secondary glow (warm +30°, cool -30° in simplified RGB space).
 * Creates a chromatic fringe around the text.
 */
function makeVividShadows(c: NameStyleColor): TextShadowLayer[] {
  const [r, g, b] = c.rgb;
  // Approximate hue shift by rotating RGB channels
  // Warm shift: boost R, reduce B → orange/warm fringe
  const wr = ch(r * 1.1 + 20);
  const wg = ch(g * 0.95);
  const wb = ch(b * 0.7);
  return [
    { offsetX: 0, offsetY: 0, blur: 5, color: `rgba(${r},${g},${b},0.55)` },
    // Hue-shifted outer layer — chromatic fringe
    { offsetX: 0, offsetY: 0, blur: 12, color: `rgba(${wr},${wg},${wb},0.4)` },
    {
      offsetX: 0,
      offsetY: 0,
      blur: 3,
      color: `rgba(${ch(r + 40)},${ch(g + 40)},${ch(b + 40)},0.35)`,
    },
  ];
}

/**
 * lustrous: complementary-hued outer glow for dual-tone depth.
 * Outer layer uses approximate complement (invert RGB, blend 60%).
 */
function makeLustrousShadows(c: NameStyleColor): TextShadowLayer[] {
  const [r, g, b] = c.rgb;
  // Complementary: invert and blend 60% toward complement
  const cr = ch(r + (255 - r * 2) * 0.6);
  const cg = ch(g + (255 - g * 2) * 0.6);
  const cb = ch(b + (255 - b * 2) * 0.6);
  return [
    { offsetX: 0, offsetY: 0, blur: 5, color: `rgba(${r},${g},${b},0.5)` },
    // Complement-hued outer glow — creates color depth
    { offsetX: 0, offsetY: 0, blur: 14, color: `rgba(${cr},${cg},${cb},0.3)` },
    { offsetX: 0, offsetY: 0, blur: 3, color: `rgba(${r},${g},${b},0.45)` },
  ];
}

/** Dispatch table: prefix index → shadow factory. */
const RARE_SHADOW_FACTORIES: readonly ((
  c: NameStyleColor,
) => TextShadowLayer[] | { color: string; shadows: TextShadowLayer[] })[] = [
  makeShimmerShadows,
  makeRadiantShadows,
  makeBrightShadows,
  makeVividShadows,
  makeLustrousShadows,
];

// ── Build registries ────────────────────────────────────────────────────────

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** 100 common name style configs keyed by NameStyleId string. */
export const COMMON_NAME_STYLE_CONFIGS: Record<string, NameStyleConfig> = {};

for (let pi = 0; pi < COMMON_PREFIXES.length; pi++) {
  const { prefix, cn } = COMMON_PREFIXES[pi]!;
  for (const colorKey of COLOR_KEYS) {
    const c = BASE_PALETTE[colorKey]!;
    const id = `${prefix}${capitalize(colorKey)}`;
    const color = shiftHex(c.hex, pi);
    const shiftedRgb = shiftRgb(c, pi);
    const shadowColor: NameStyleColor = { hex: color, rgb: shiftedRgb, cn: c.cn };
    COMMON_NAME_STYLE_CONFIGS[id] = {
      id: id as NameStyleConfig['id'],
      name: `${cn}${c.cn}`,
      tier: 'common',
      color,
      textShadows: makeCommonShadow(shadowColor),
    };
  }
}

/** 50 rare name style configs keyed by NameStyleId string. */
export const RARE_NAME_STYLE_CONFIGS: Record<string, NameStyleConfig> = {};

for (let pi = 0; pi < RARE_PREFIXES.length; pi++) {
  const { prefix, cn } = RARE_PREFIXES[pi]!;
  const factory = RARE_SHADOW_FACTORIES[pi]!;
  for (const colorKey of COLOR_KEYS) {
    const c = BASE_PALETTE[colorKey]!;
    const id = `${prefix}${capitalize(colorKey)}`;
    const result = factory(c);
    // radiant factory returns { color, shadows } to also lighten the text color
    const isCompound = 'shadows' in result;
    RARE_NAME_STYLE_CONFIGS[id] = {
      id: id as NameStyleConfig['id'],
      name: `${cn}${c.cn}`,
      tier: 'rare',
      color: isCompound ? (result as { color: string }).color : c.hex,
      textShadows: isCompound ? (result as { shadows: TextShadowLayer[] }).shadows : result,
    };
  }
}
