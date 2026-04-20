/**
 * Common flair color palette — 10 base colors.
 * Used by all parametric flair animation templates.
 */

export interface FlairColorSet {
  /** Primary particle/glow color (rgb string for SVG) */
  rgb: string;
  /** Lighter accent (rgb string) */
  rgbLight: string;
}

// prettier-ignore
export const FLAIR_PALETTE = {
  red:    { rgb: 'rgb(229,62,62)',   rgbLight: 'rgb(254,178,178)' },
  orange: { rgb: 'rgb(221,107,32)',  rgbLight: 'rgb(251,211,141)' },
  amber:  { rgb: 'rgb(214,158,46)',  rgbLight: 'rgb(250,240,137)' },
  green:  { rgb: 'rgb(56,161,105)',  rgbLight: 'rgb(154,230,180)' },
  teal:   { rgb: 'rgb(49,151,149)',  rgbLight: 'rgb(129,230,217)' },
  blue:   { rgb: 'rgb(49,130,206)',  rgbLight: 'rgb(144,205,244)' },
  indigo: { rgb: 'rgb(90,103,216)',  rgbLight: 'rgb(183,148,244)' },
  purple: { rgb: 'rgb(128,90,213)',  rgbLight: 'rgb(214,188,250)' },
  pink:   { rgb: 'rgb(213,63,140)',  rgbLight: 'rgb(251,182,206)' },
  gray:   { rgb: 'rgb(113,128,150)', rgbLight: 'rgb(203,213,224)' },
} as const;

type FlairPaletteKey = keyof typeof FLAIR_PALETTE;

export const FLAIR_PALETTE_KEYS: readonly FlairPaletteKey[] = [
  'red',
  'orange',
  'amber',
  'green',
  'teal',
  'blue',
  'indigo',
  'purple',
  'pink',
  'gray',
] as const;

/** Chinese color names */
export const CN_FLAIR_COLORS: Record<FlairPaletteKey, string> = {
  red: '红色',
  orange: '橙色',
  amber: '琥珀',
  green: '绿色',
  teal: '青色',
  blue: '蓝色',
  indigo: '靛蓝',
  purple: '紫色',
  pink: '粉色',
  gray: '灰色',
};
