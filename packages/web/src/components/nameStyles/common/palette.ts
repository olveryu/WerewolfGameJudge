/**
 * Name style color palette — shared by common + rare factory generators.
 *
 * 10 base hues × { hex, rgba components } for systematic config generation.
 */

export interface NameStyleColor {
  /** CSS hex color */
  hex: string;
  /** RGBA components for textShadow generation (r, g, b) */
  rgb: [number, number, number];
  /** Chinese color name */
  cn: string;
}

// prettier-ignore
export const BASE_PALETTE: Record<string, NameStyleColor> = {
  crimson:  { hex: '#DC2626', rgb: [220, 38, 38],   cn: '绯红' },
  coral:    { hex: '#F97316', rgb: [249, 115, 22],   cn: '珊瑚' },
  amber:    { hex: '#D69E2E', rgb: [214, 158, 46],   cn: '琥珀' },
  emerald:  { hex: '#059669', rgb: [5, 150, 105],    cn: '翡翠' },
  teal:     { hex: '#0D9488', rgb: [13, 148, 136],   cn: '青碧' },
  azure:    { hex: '#2563EB', rgb: [37, 99, 235],    cn: '蔚蓝' },
  indigo:   { hex: '#4F46E5', rgb: [79, 70, 229],    cn: '靛蓝' },
  violet:   { hex: '#7C3AED', rgb: [124, 58, 237],   cn: '紫罗兰' },
  rose:     { hex: '#E11D48', rgb: [225, 29, 72],    cn: '玫红' },
  slate:    { hex: '#64748B', rgb: [100, 116, 139],  cn: '石灰' },
};

type ColorKey = keyof typeof BASE_PALETTE;

export const COLOR_KEYS: readonly ColorKey[] = [
  'crimson',
  'coral',
  'amber',
  'emerald',
  'teal',
  'azure',
  'indigo',
  'violet',
  'rose',
  'slate',
] as const;
