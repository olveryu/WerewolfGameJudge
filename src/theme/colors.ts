/**
 * colors - app color constants
 *
 * Semantic colors based on the "月白" color scheme.
 * Pure constants, no React or service.
 *
 * Values meet WCAG 2.2 AA (4.5:1 text): each hue keeps its OKLCH hue and chroma and is
 * darkened only as far as its role needs. Fill tokens carry white text; `*Text` tokens are
 * the text color of a hue on surface, background, surfaceHover and the hue's own tints up
 * to 20%. Pinned by src/theme/__tests__/colorContrast.contract.test.ts.
 */

export interface ThemeColors {
  // Primary (fill and text)
  primary: string;
  primaryLight: string;
  primaryDark: string;

  // Backgrounds
  background: string;
  surface: string;
  surfaceHover: string;
  card: string;

  // Text
  text: string;
  textSecondary: string;
  /** Tertiary text on surface/background only; never on surfaceHover or tints. */
  textMuted: string;
  /** Inactive controls only (WCAG 1.4.3 exempts them from contrast). */
  textDisabled: string;
  textInverse: string;

  // Borders
  border: string;
  borderLight: string;

  // Status fills (backgrounds, borders, icons)
  success: string;
  warning: string;
  error: string;
  /** Fill and text. */
  info: string;

  // Status text
  successText: string;
  warningText: string;
  errorText: string;

  // Game specific (4-faction: wolf / god / villager / third) fills
  wolf: string;
  villager: string;
  god: string;
  third: string;

  // Faction text
  wolfText: string;
  villagerText: string;
  godText: string;
  thirdText: string;

  // Overlay
  overlay: string;
  overlayLight: string;

  // Utility
  transparent: 'transparent';
}

/**
 * Night report (2026) palette — the light surface the werewolf night
 * review is printed on, aligned with the app's white theme. Raw hues live
 * here in the theme layer (same precedent as PICTIONARY_DRAWING_PALETTE);
 * the report's layout spec (nightReviewLayout) composes them into
 * semantic slots.
 */
export const NIGHT_REPORT_COLORS = {
  background: '#FFFFFF',
  cardBorder: '#E4E4EC',
  divider: '#ECECF2',
  text: '#17171F',
  textSecondary: '#55566B',
  textMuted: '#6C6C7A',
  danger: '#D92D20',
  dangerText: '#D3261A',
  deadMedalBg: '#FDECEA',
  deadMedalBorder: '#EFA9A3',
  wolfMedalBg: '#FDECEF',
  wolfMedalText: '#D12357',
  wolfMedalBorder: '#F3C2CF',
  godMedalBg: '#ECEAFE',
  godMedalText: '#4F46E5',
  godMedalBorder: '#C9BFF5',
  violet: '#4F46E5',
  goodMedalBg: '#E6F4EA',
  goodMedalText: '#067647',
  goodMedalBorder: '#A9D9BC',
  neutralMedalBg: '#F0F0F5',
  neutralMedalBorder: '#DCDCE6',
} as const;

export const PICTIONARY_CANVAS_BACKGROUND = '#FFFFFF';

export const PICTIONARY_DRAWING_PALETTE = [
  { name: '黑色', value: '#171717' },
  { name: '白色', value: PICTIONARY_CANVAS_BACKGROUND },
  { name: '红色', value: '#E5484D' },
  { name: '橙色', value: '#F28C28' },
  { name: '黄色', value: '#F5C542' },
  { name: '绿色', value: '#2E9D63' },
  { name: '青色', value: '#19A7AE' },
  { name: '蓝色', value: '#3478F6' },
  { name: '紫色', value: '#7C5CE7' },
  { name: '粉色', value: '#E56B9F' },
] as const;

/** 月白 — restrained, translucent, elegant indigo with gaming atmosphere */
export const colors: ThemeColors = {
  primary: '#4A3FDE',
  primaryLight: '#818CF8',
  primaryDark: '#3730A3',

  background: '#F2F2F7',
  surface: '#FFFFFF',
  surfaceHover: '#E5E5EA',
  card: '#FFFFFF',

  text: '#1A1A2E',
  textSecondary: '#5C5C70',
  textMuted: '#6D6D7E',
  textDisabled: '#8E8EA0',
  textInverse: '#FFFFFF',

  border: '#D1D1D6',
  borderLight: '#E5E5EA',

  success: '#00893D',
  warning: '#A06C03',
  error: '#D13438',
  info: '#104DD4',

  successText: '#04692E',
  warningText: '#7D5301',
  errorText: '#B0001C',

  wolf: '#C82828',
  villager: '#00893D',
  god: '#763ABA',
  third: '#A06C03',

  wolfText: '#B00112',
  villagerText: '#04692E',
  godText: '#763ABA',
  thirdText: '#7D5301',

  overlay: 'rgba(26, 26, 46, 0.6)',
  overlayLight: 'rgba(26, 26, 46, 0.25)',

  transparent: 'transparent',
};

/** A hue that colors words and the chips, tints, bars and borders around them. */
export type ColorTone =
  | 'primary'
  | 'info'
  | 'success'
  | 'warning'
  | 'error'
  | 'wolf'
  | 'villager'
  | 'god'
  | 'third'
  | 'neutral';

/** Per tone: `fill` for tints up to 20%, bars, borders and solid backgrounds; `text` for words. */
export const toneColors: Readonly<Record<ColorTone, Readonly<{ fill: string; text: string }>>> = {
  primary: { fill: colors.primary, text: colors.primary },
  info: { fill: colors.info, text: colors.info },
  success: { fill: colors.success, text: colors.successText },
  warning: { fill: colors.warning, text: colors.warningText },
  error: { fill: colors.error, text: colors.errorText },
  wolf: { fill: colors.wolf, text: colors.wolfText },
  villager: { fill: colors.villager, text: colors.villagerText },
  god: { fill: colors.god, text: colors.godText },
  third: { fill: colors.third, text: colors.thirdText },
  neutral: { fill: colors.textMuted, text: colors.textSecondary },
};

/** The brand gradient behind white text; every stop holds textInverse at 4.5:1. */
export const PRIMARY_GRADIENT = [colors.primary, colors.primaryDark] as const;
