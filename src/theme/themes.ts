/**
 * themes - Theme Colors configuration
 *
 * 定义所有主题的颜色方案（8 套：月白 / 暖沙 / 青瓷 / 晴岚 / 石墨 / 月蚀 / 血月 / 幽林）。
 * 浅色 4 套（light / sand / jade / sky）+ 深色 4 套（dark / midnight / blood / forest）。
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

export type ThemeKey = 'light' | 'sand' | 'jade' | 'sky' | 'dark' | 'midnight' | 'blood' | 'forest';

export interface Theme {
  key: ThemeKey;
  name: string;
  isDark: boolean;
  colors: ThemeColors;
}

// ============================================
// 主题定义
// ============================================

// 石墨 — 沉稳、内敛、现代、均衡、普适
const darkTheme: Theme = {
  key: 'dark',
  name: '石墨',
  isDark: true,
  colors: {
    primary: '#7C7CFF',
    primaryLight: '#9B9BFF',
    primaryDark: '#5D5DD7',

    background: '#121214',
    surface: '#1C1C1F',
    surfaceHover: '#26262A',
    card: '#1F1F23',

    text: '#F0F0F3',
    textSecondary: '#9898A8',
    textMuted: '#5E5E6E',
    textInverse: '#121214',

    border: '#2C2C32',
    borderLight: '#3A3A42',

    success: '#34D399',
    warning: '#FBBF24',
    error: '#F87171',
    info: '#60A5FA',

    wolf: '#EF4444',
    villager: '#34D399',
    god: '#A78BFA',
    third: '#FBBF24',

    overlay: 'rgba(0, 0, 0, 0.7)',
    overlayLight: 'rgba(0, 0, 0, 0.4)',
  },
};

// 月白 — 克制、通透、专业、清晨雾气、雅致
const lightTheme: Theme = {
  key: 'light',
  name: '月白',
  isDark: false,
  colors: {
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
  },
};

// 月蚀 — 神秘、仪式感、深邃、暗紫、降神
const midnightTheme: Theme = {
  key: 'midnight',
  name: '月蚀',
  isDark: true,
  colors: {
    primary: '#8B5CF6',
    primaryLight: '#A78BFA',
    primaryDark: '#7C3AED',

    background: '#0B0B14',
    surface: '#131320',
    surfaceHover: '#1C1C2E',
    card: '#16162A',

    text: '#E8E8F0',
    textSecondary: '#9696B8',
    textMuted: '#5A5A7A',
    textInverse: '#0B0B14',

    border: '#28284A',
    borderLight: '#363660',

    success: '#34D399',
    warning: '#FBBF24',
    error: '#F87171',
    info: '#A78BFA',

    wolf: '#EF4444',
    villager: '#34D399',
    god: '#C084FC',
    third: '#FBBF24',

    overlay: 'rgba(11, 11, 20, 0.8)',
    overlayLight: 'rgba(11, 11, 20, 0.5)',
  },
};

// 血月 — 紧张、猎杀、危险、炽烈、血腥
const bloodTheme: Theme = {
  key: 'blood',
  name: '血月',
  isDark: true,
  colors: {
    primary: '#DC3B3B',
    primaryLight: '#EF6060',
    primaryDark: '#B82828',

    background: '#110B0B',
    surface: '#1C1212',
    surfaceHover: '#281A1A',
    card: '#1F1414',

    text: '#F5EAEA',
    textSecondary: '#C89898',
    textMuted: '#7A5050',
    textInverse: '#110B0B',

    border: '#3D2020',
    borderLight: '#522D2D',

    success: '#4ADE80',
    warning: '#FBBF24',
    error: '#FF8080',
    info: '#F09090',

    wolf: '#FF5555',
    villager: '#4ADE80',
    god: '#E879A8',
    third: '#FBBF24',

    overlay: 'rgba(17, 11, 11, 0.8)',
    overlayLight: 'rgba(17, 11, 11, 0.5)',
  },
};

// 幽林 — 隐秘、警觉、苔藓、猎场、策略
const forestTheme: Theme = {
  key: 'forest',
  name: '幽林',
  isDark: true,
  colors: {
    primary: '#3DD68C',
    primaryLight: '#6EEDB0',
    primaryDark: '#1FA866',

    background: '#0A1210',
    surface: '#101D18',
    surfaceHover: '#182820',
    card: '#142119',

    text: '#E8F5EE',
    textSecondary: '#7DC8A0',
    textMuted: '#3A6A50',
    textInverse: '#0A1210',

    border: '#1D3828',
    borderLight: '#265038',

    success: '#6EEDB0',
    warning: '#FCD34D',
    error: '#F87171',
    info: '#3DD68C',

    wolf: '#EF4444',
    villager: '#6EEDB0',
    god: '#B388FF',
    third: '#FCD34D',

    overlay: 'rgba(10, 18, 16, 0.85)',
    overlayLight: 'rgba(10, 18, 16, 0.5)',
  },
};

// 晴岚 — 天青、开阔、朝霜、冷静、理性
const skyTheme: Theme = {
  key: 'sky',
  name: '晴岚',
  isDark: false,
  colors: {
    primary: '#4A7FBB',
    primaryLight: '#6A9BD0',
    primaryDark: '#356599',

    background: '#F4F6FA',
    surface: '#FFFFFF',
    surfaceHover: '#E8ECF2',
    card: '#FFFFFF',

    text: '#1A2030',
    textSecondary: '#556070',
    textMuted: '#8890A0',
    textInverse: '#FFFFFF',

    border: '#D4DAE4',
    borderLight: '#E8ECF2',

    success: '#1A9A4A',
    warning: '#B87D08',
    error: '#D13438',
    info: '#4A7FBB',

    wolf: '#C82828',
    villager: '#1A9A4A',
    god: '#7B3FBF',
    third: '#B87D08',

    overlay: 'rgba(0, 0, 0, 0.5)',
    overlayLight: 'rgba(0, 0, 0, 0.2)',
  },
};

// 暖沙 — 温润、护眼、复古、书卷气、安宁
const sandTheme: Theme = {
  key: 'sand',
  name: '暖沙',
  isDark: false,
  colors: {
    primary: '#886830',
    primaryLight: '#A88540',
    primaryDark: '#6B4E1B',

    background: '#F3EDE4',
    surface: '#FAF6F0',
    surfaceHover: '#E8E0D4',
    card: '#FAF6F0',

    text: '#2D2418',
    textSecondary: '#6D5D48',
    textMuted: '#9A8B78',
    textInverse: '#FFFFFF',

    border: '#D4C8B8',
    borderLight: '#E4DAD0',

    success: '#4E8B3A',
    warning: '#B07D10',
    error: '#A93E2A',
    info: '#5B7B35',

    wolf: '#8B2E1C',
    villager: '#4E8B3A',
    god: '#6B4E1B',
    third: '#B07D10',

    overlay: 'rgba(45, 36, 24, 0.5)',
    overlayLight: 'rgba(45, 36, 24, 0.2)',
  },
};

// 青瓷 — 清凉、沉静、翡翠薄雾、自然、通透
const jadeTheme: Theme = {
  key: 'jade',
  name: '青瓷',
  isDark: false,
  colors: {
    primary: '#2A8A7A',
    primaryLight: '#3AA898',
    primaryDark: '#1E6E60',

    background: '#F3F7F6',
    surface: '#FFFFFF',
    surfaceHover: '#E4EDEA',
    card: '#FFFFFF',

    text: '#182828',
    textSecondary: '#4A6060',
    textMuted: '#829090',
    textInverse: '#FFFFFF',

    border: '#C8D8D4',
    borderLight: '#E0ECE8',

    success: '#1A9A4A',
    warning: '#B87D08',
    error: '#D13438',
    info: '#2A8A7A',

    wolf: '#C82828',
    villager: '#1A9A4A',
    god: '#7B3FBF',
    third: '#B87D08',

    overlay: 'rgba(0, 0, 0, 0.5)',
    overlayLight: 'rgba(0, 0, 0, 0.2)',
  },
};

// ============================================
// 导出
// ============================================

export const themes: Record<ThemeKey, Theme> = {
  // 浅色
  light: lightTheme,
  sand: sandTheme,
  jade: jadeTheme,
  sky: skyTheme,
  // 深色
  dark: darkTheme,
  midnight: midnightTheme,
  blood: bloodTheme,
  forest: forestTheme,
};

export const defaultTheme: ThemeKey = 'light';
