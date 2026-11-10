/** The ten base colours of the generated common and rare seat flairs. */

export interface FlairColorSet {
  /** Primary particle / glow colour. */
  rgb: string;
  /** Lighter accent. */
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
} as const satisfies Record<string, FlairColorSet>;

export type FlairPaletteKey = keyof typeof FLAIR_PALETTE;

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
];
