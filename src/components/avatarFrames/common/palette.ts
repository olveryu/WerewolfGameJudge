/**
 * Common frame color palette — 10 base colors × 3 tones.
 * Used by all parametric frame templates.
 */

export interface FrameColorSet {
  /** Primary stroke color */
  primary: string;
  /** Lighter accent / highlight */
  light: string;
  /** Darker accent / shadow */
  dark: string;
}

// prettier-ignore
export const FRAME_PALETTE = {
  red:    { primary: '#E53E3E', light: '#FEB2B2', dark: '#C53030' },
  orange: { primary: '#DD6B20', light: '#FBD38D', dark: '#C05621' },
  amber:  { primary: '#D69E2E', light: '#FAF089', dark: '#B7791F' },
  green:  { primary: '#38A169', light: '#9AE6B4', dark: '#276749' },
  teal:   { primary: '#319795', light: '#81E6D9', dark: '#285E61' },
  blue:   { primary: '#3182CE', light: '#90CDF4', dark: '#2A4365' },
  indigo: { primary: '#5A67D8', light: '#B794F4', dark: '#434190' },
  purple: { primary: '#805AD5', light: '#D6BCFA', dark: '#553C9A' },
  pink:   { primary: '#D53F8C', light: '#FBB6CE', dark: '#97266D' },
  gray:   { primary: '#718096', light: '#CBD5E0', dark: '#4A5568' },
} as const;

export type PaletteKey = keyof typeof FRAME_PALETTE;

export const PALETTE_KEYS: readonly PaletteKey[] = [
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

/** Chinese color names matching PALETTE_KEYS order */
export const CN_COLOR_NAMES: Record<PaletteKey, string> = {
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
