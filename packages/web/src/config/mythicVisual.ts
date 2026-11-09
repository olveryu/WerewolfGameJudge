/** Eternal-night collection artwork palette and timing; no game state or IO. */
export const MYTHIC_COLORS = {
  silver: '#DCE5DA',
  pearl: '#F4F4E4',
  metal: '#708E82',
  obsidian: '#152622',
  crimson: '#C73D5C',
  enamel: '#951C3C',
  crystal: '#EC6B82',
  highlight: '#FFC2CA',
} as const;

export const MYTHIC_LOOP_DURATION = 7000;
export const MYTHIC_ENTRY_DURATION = 2800;

/** Collection-owned artwork tokens, shared by cosmetic renderers only. */
export const MYTHIC_COLLECTION_COLORS = {
  astral: {
    primary: '#47D9C0',
    secondary: '#E9B85F',
    pearl: '#FFF3D4',
    dark: '#173C3E',
    ink: '#137B78',
  },
  ocean: {
    primary: '#38C8EC',
    secondary: '#FF836F',
    pearl: '#F0FFFA',
    dark: '#123E54',
    ink: '#186E98',
  },
  ink: {
    primary: '#B3D1BE',
    secondary: '#DF513F',
    pearl: '#F5F5E8',
    dark: '#173D34',
    ink: '#AE392F',
  },
} as const;

export type MythicCollection = keyof typeof MYTHIC_COLLECTION_COLORS;
