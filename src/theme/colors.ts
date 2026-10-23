/**
 * colors - app color constants
 *
 * Semantic colors based on the "月白" color scheme.
 * Pure constants, no React or service.
 */

export interface ThemeColors {
  // Primary
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
  textMuted: string;
  textInverse: string;

  // Borders
  border: string;
  borderLight: string;

  // Status
  success: string;
  warning: string;
  error: string;
  info: string;

  // Game specific (4-faction: wolf / god / villager / third)
  wolf: string;
  villager: string;
  god: string;
  third: string;

  // Overlay
  overlay: string;
  overlayLight: string;

  // Utility
  transparent: 'transparent';
}

/**
 * Night report (2026) dossier palette — the dark archive surface the
 * werewolf night review is printed on. Raw hues live here in the theme
 * layer (same precedent as PICTIONARY_DRAWING_PALETTE); the report's layout
 * spec (nightReviewLayout) composes them into semantic slots.
 */
export const NIGHT_REPORT_DOSSIER_COLORS = {
  background: '#101017',
  card: '#1C1C26',
  cardBorder: '#2B2B3A',
  divider: '#262633',
  text: '#F2F2F7',
  textSecondary: '#9A9AAD',
  textMuted: '#6D6D80',
  textFaint: '#55556A',
  salmon: '#FF7A72',
  salmonLight: '#FF9D97',
  deadMedalBg: '#3A2326',
  deadMedalBorder: '#5C3236',
  wolfMedalBg: '#33202B',
  wolfMedalText: '#FF9DB1',
  wolfMedalBorder: '#59303F',
  godMedalBg: '#262040',
  godMedalText: '#C4B0FF',
  godMedalBorder: '#453A75',
  violet: '#B79AFF',
  goodMedalBg: '#1E2B26',
  goodMedalText: '#7EE2A8',
  goodMedalBorder: '#2F5243',
  neutralMedalBg: '#262633',
  neutralMedalBorder: '#3D3D52',
  idleBg: '#17171F',
  idleText: '#8A8A9C',
  idleStrong: '#B9B9C9',
  rosterOutMedalBg: '#241D20',
  rosterOutMedalBorder: '#453034',
  rosterOutMedalText: '#8A7076',
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
  primary: '#4F46E5',
  primaryLight: '#818CF8',
  primaryDark: '#3730A3',

  background: '#F2F2F7',
  surface: '#FFFFFF',
  surfaceHover: '#E5E5EA',
  card: '#FFFFFF',

  text: '#1A1A2E',
  textSecondary: '#5C5C70',
  textMuted: '#8E8EA0',
  textInverse: '#FFFFFF',

  border: '#D1D1D6',
  borderLight: '#E5E5EA',

  success: '#1A9A4A',
  warning: '#B87D08',
  error: '#D13438',
  info: '#2563EB',

  wolf: '#C82828',
  villager: '#1A9A4A',
  god: '#7B3FBF',
  third: '#B87D08',

  overlay: 'rgba(26, 26, 46, 0.6)',
  overlayLight: 'rgba(26, 26, 46, 0.25)',

  transparent: 'transparent',
};
