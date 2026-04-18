/**
 * Name style factory — generates common (100) + rare (50) config entries.
 *
 * Common: 10 prefixes × 10 colors = 100 — single color + 1-layer subtle shadow
 * Rare:    5 prefixes × 10 colors =  50 — single color + 3-layer rich glow
 *
 * Pattern mirrors `avatarFrames/common/index.tsx` and `seatFlairs/common/index.tsx`.
 */
import type { NameStyleConfig, TextShadowLayer } from '../nameStyleConfigs';
import { BASE_PALETTE, COLOR_KEYS, type ColorKey, type NameStyleColor } from './palette';

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
  const f = factors[prefixIdx];
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

/** Rare prefix definitions — 5 prefixes for 50 variants */
const RARE_PREFIXES: readonly { prefix: string; cn: string }[] = [
  { prefix: 'shimmer', cn: '辉·' },
  { prefix: 'radiant', cn: '耀·' },
  { prefix: 'bright', cn: '灿·' },
  { prefix: 'vivid', cn: '鲜·' },
  { prefix: 'lustrous', cn: '润·' },
];

function makeRareShadows(c: NameStyleColor): TextShadowLayer[] {
  const [r, g, b] = c.rgb;
  return [
    { offsetX: 0, offsetY: 0, blur: 5, color: `rgba(${r},${g},${b},0.6)` },
    { offsetX: 0, offsetY: 0, blur: 10, color: `rgba(${r},${g},${b},0.35)` },
    {
      offsetX: 0,
      offsetY: 0,
      blur: 2,
      color: `rgba(${Math.min(r + 60, 255)},${Math.min(g + 60, 255)},${Math.min(b + 60, 255)},0.4)`,
    },
  ];
}

// ── Build registries ────────────────────────────────────────────────────────

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** 100 common name style configs keyed by NameStyleId string. */
export const COMMON_NAME_STYLE_CONFIGS: Record<string, NameStyleConfig> = {};

for (let pi = 0; pi < COMMON_PREFIXES.length; pi++) {
  const { prefix, cn } = COMMON_PREFIXES[pi];
  for (const colorKey of COLOR_KEYS) {
    const c = BASE_PALETTE[colorKey as ColorKey];
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

for (const { prefix, cn } of RARE_PREFIXES) {
  for (const colorKey of COLOR_KEYS) {
    const c = BASE_PALETTE[colorKey as ColorKey];
    const id = `${prefix}${capitalize(colorKey)}`;
    RARE_NAME_STYLE_CONFIGS[id] = {
      id: id as NameStyleConfig['id'],
      name: `${cn}${c.cn}`,
      tier: 'rare',
      color: c.hex,
      textShadows: makeRareShadows(c),
    };
  }
}
