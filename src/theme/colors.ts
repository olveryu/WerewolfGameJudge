/**
 * colors - 应用颜色常量
 *
 * 基于「月白」配色方案的语义色定义。
 * 纯常量，不含 React 或 service。
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
}

/** 月白 — 克制、通透、专业、清晨雾气、雅致 */
export const colors: ThemeColors = {
  primary: '#5B5BD6',
  primaryLight: '#7878E8',
  primaryDark: '#4747B3',

  background: '#F5F5F7',
  surface: '#FFFFFF',
  surfaceHover: '#EDEDF0',
  card: '#FFFFFF',

  text: '#1A1A2E',
  textSecondary: '#5C5C70',
  textMuted: '#8E8EA0',
  textInverse: '#FFFFFF',

  border: '#DDDDE3',
  borderLight: '#EEEEF2',

  success: '#1A9A4A',
  warning: '#B87D08',
  error: '#D13438',
  info: '#2563EB',

  wolf: '#C82828',
  villager: '#1A9A4A',
  god: '#7B3FBF',
  third: '#B87D08',

  overlay: 'rgba(0, 0, 0, 0.5)',
  overlayLight: 'rgba(0, 0, 0, 0.2)',
};
