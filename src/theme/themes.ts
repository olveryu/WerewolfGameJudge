/**
 * themes - Theme Colors configuration
 *
 * 定义所有主题的颜色方案（dark / blood / nature / ocean / light），提供颜色值定义和主题注册。
 * 每个主题实现 ThemeColors 接口，包含 primary / background / surface / text 等语义色。
 * 不包含业务逻辑，不引入 React 或 service。
 */

// ============================================
// 颜色类型定义
// ============================================
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

export type ThemeKey =
  | 'light'
  | 'dark'
  | 'amoled'
  | 'sand'
  | 'midnight'
  | 'blood'
  | 'forest'
  | 'snow';

export interface Theme {
  key: ThemeKey;
  name: string;
  isDark: boolean;
  colors: ThemeColors;
}

// ============================================
// 主题定义
// ============================================

const darkTheme: Theme = {
  key: 'dark',
  name: '暗黑',
  isDark: true,
  colors: {
    primary: '#6366F1',
    primaryLight: '#818CF8',
    primaryDark: '#4F46E5',

    background: '#0F0F0F',
    surface: '#1A1A1A',
    surfaceHover: '#252525',
    card: '#1F1F1F',

    text: '#FFFFFF',
    textSecondary: '#A1A1AA',
    textMuted: '#71717A',
    textInverse: '#000000',

    border: '#27272A',
    borderLight: '#3F3F46',

    success: '#22C55E',
    warning: '#F59E0B',
    error: '#EF4444',
    info: '#3B82F6',

    wolf: '#DC2626',
    villager: '#059669',
    god: '#7C3AED',
    third: '#F59E0B',

    overlay: 'rgba(0, 0, 0, 0.7)',
    overlayLight: 'rgba(0, 0, 0, 0.4)',
  },
};

const lightTheme: Theme = {
  key: 'light',
  name: '浅色',
  isDark: false,
  colors: {
    primary: '#6366F1',
    primaryLight: '#818CF8',
    primaryDark: '#4F46E5',

    background: '#FAFAFA',
    surface: '#FFFFFF',
    surfaceHover: '#F4F4F5',
    card: '#FFFFFF',

    text: '#09090B',
    textSecondary: '#52525B',
    textMuted: '#A1A1AA',
    textInverse: '#FFFFFF',

    border: '#E4E4E7',
    borderLight: '#F4F4F5',

    success: '#16A34A',
    warning: '#CA8A04',
    error: '#DC2626',
    info: '#2563EB',

    wolf: '#DC2626',
    villager: '#16A34A',
    god: '#7C3AED',
    third: '#CA8A04',

    overlay: 'rgba(0, 0, 0, 0.5)',
    overlayLight: 'rgba(0, 0, 0, 0.2)',
  },
};

const midnightTheme: Theme = {
  key: 'midnight',
  name: '午夜',
  isDark: true,
  colors: {
    primary: '#7C3AED',
    primaryLight: '#8B5CF6',
    primaryDark: '#6D28D9',

    background: '#0A0A0F',
    surface: '#12121A',
    surfaceHover: '#1A1A25',
    card: '#15151F',

    text: '#FFFFFF',
    textSecondary: '#A78BFA',
    textMuted: '#6D28D9',
    textInverse: '#000000',

    border: '#2E1065',
    borderLight: '#3B0764',

    success: '#22C55E',
    warning: '#F59E0B',
    error: '#EF4444',
    info: '#8B5CF6',

    wolf: '#DC2626',
    villager: '#059669',
    god: '#A855F7',
    third: '#F59E0B',

    overlay: 'rgba(10, 10, 15, 0.8)',
    overlayLight: 'rgba(10, 10, 15, 0.5)',
  },
};

const bloodTheme: Theme = {
  key: 'blood',
  name: '血月',
  isDark: true,
  colors: {
    primary: '#DC2626',
    primaryLight: '#EF4444',
    primaryDark: '#B91C1C',

    background: '#111111',
    surface: '#1A1111',
    surfaceHover: '#251515',
    card: '#1C1414',

    text: '#FFFFFF',
    textSecondary: '#FCA5A5',
    textMuted: '#991B1B',
    textInverse: '#000000',

    border: '#450A0A',
    borderLight: '#7F1D1D',

    success: '#22C55E',
    warning: '#F59E0B',
    error: '#EF4444',
    info: '#F87171',

    wolf: '#EF4444',
    villager: '#22C55E',
    god: '#F472B6',
    third: '#FBBF24',

    overlay: 'rgba(17, 17, 17, 0.8)',
    overlayLight: 'rgba(17, 17, 17, 0.5)',
  },
};

// 🌲 森林主题 - 神秘绿色森林氛围
const forestTheme: Theme = {
  key: 'forest',
  name: '森林',
  isDark: true,
  colors: {
    primary: '#22C55E',
    primaryLight: '#4ADE80',
    primaryDark: '#16A34A',

    background: '#0A1510',
    surface: '#0F1F17',
    surfaceHover: '#152A1F',
    card: '#122119',

    text: '#ECFDF5',
    textSecondary: '#86EFAC',
    textMuted: '#166534',
    textInverse: '#000000',

    border: '#14532D',
    borderLight: '#166534',

    success: '#4ADE80',
    warning: '#FCD34D',
    error: '#F87171',
    info: '#34D399',

    wolf: '#EF4444',
    villager: '#4ADE80',
    god: '#A78BFA',
    third: '#FCD34D',

    overlay: 'rgba(10, 21, 16, 0.85)',
    overlayLight: 'rgba(10, 21, 16, 0.5)',
  },
};

// ❄️ 雪夜主题 - 冰冷的冬夜氛围
const snowTheme: Theme = {
  key: 'snow',
  name: '雪夜',
  isDark: true,
  colors: {
    primary: '#38BDF8',
    primaryLight: '#7DD3FC',
    primaryDark: '#0284C7',

    background: '#0C1929',
    surface: '#0F2137',
    surfaceHover: '#132A45',
    card: '#11243D',

    text: '#F0F9FF',
    textSecondary: '#7DD3FC',
    textMuted: '#0369A1',
    textInverse: '#000000',

    border: '#0C4A6E',
    borderLight: '#075985',

    success: '#34D399',
    warning: '#FBBF24',
    error: '#FB7185',
    info: '#38BDF8',

    wolf: '#F43F5E',
    villager: '#34D399',
    god: '#A78BFA',
    third: '#FBBF24',

    overlay: 'rgba(12, 25, 41, 0.85)',
    overlayLight: 'rgba(12, 25, 41, 0.5)',
  },
};

// 🟤 暖沙主题 - 护眼暖色调 (f.lux 风格)
const sandTheme: Theme = {
  key: 'sand',
  name: '暖沙',
  isDark: false,
  colors: {
    primary: '#8B6914',
    primaryLight: '#A68B2C',
    primaryDark: '#6B4F0A',

    background: '#F5F0E8',
    surface: '#FAF6EF',
    surfaceHover: '#EDE7DB',
    card: '#FAF6EF',

    text: '#3D2B1F',
    textSecondary: '#6B5744',
    textMuted: '#A08C76',
    textInverse: '#FFFFFF',

    border: '#D9CCBB',
    borderLight: '#E8DDD0',

    success: '#5D8C3E',
    warning: '#B8860B',
    error: '#A0522D',
    info: '#6B7B3A',

    wolf: '#8B2500',
    villager: '#5D8C3E',
    god: '#6B4F0A',
    third: '#B8860B',

    overlay: 'rgba(61, 43, 31, 0.5)',
    overlayLight: 'rgba(61, 43, 31, 0.2)',
  },
};

// ⬛ 纯黑主题 - AMOLED 省电
const amoledTheme: Theme = {
  key: 'amoled',
  name: '纯黑',
  isDark: true,
  colors: {
    primary: '#6366F1',
    primaryLight: '#818CF8',
    primaryDark: '#4F46E5',

    background: '#000000',
    surface: '#0A0A0A',
    surfaceHover: '#141414',
    card: '#0A0A0A',

    text: '#FFFFFF',
    textSecondary: '#A1A1AA',
    textMuted: '#52525B',
    textInverse: '#000000',

    border: '#1A1A1A',
    borderLight: '#262626',

    success: '#22C55E',
    warning: '#F59E0B',
    error: '#EF4444',
    info: '#3B82F6',

    wolf: '#DC2626',
    villager: '#059669',
    god: '#7C3AED',
    third: '#F59E0B',

    overlay: 'rgba(0, 0, 0, 0.85)',
    overlayLight: 'rgba(0, 0, 0, 0.5)',
  },
};

// ============================================
// 导出
// ============================================

export const themes: Record<ThemeKey, Theme> = {
  light: lightTheme,
  dark: darkTheme,
  amoled: amoledTheme,
  sand: sandTheme,
  midnight: midnightTheme,
  blood: bloodTheme,
  forest: forestTheme,
  snow: snowTheme,
};

export const defaultTheme: ThemeKey = 'light';
