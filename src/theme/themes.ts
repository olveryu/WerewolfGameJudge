/**
 * Theme Colors - 主题颜色配置
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

  // Game specific
  wolf: string;
  villager: string;
  god: string;

  // Overlay
  overlay: string;
  overlayLight: string;
}

export type ThemeKey = 'light' | 'minimal' | 'dark' | 'midnight' | 'blood' | 'discord';

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

    overlay: 'rgba(10, 10, 15, 0.8)',
    overlayLight: 'rgba(10, 10, 15, 0.5)',
  },
};

const bloodTheme: Theme = {
  key: 'blood',
  name: '🩸 血月',
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

    overlay: 'rgba(17, 17, 17, 0.8)',
    overlayLight: 'rgba(17, 17, 17, 0.5)',
  },
};

const discordTheme: Theme = {
  key: 'discord',
  name: '紫霞',
  isDark: true,
  colors: {
    primary: '#5865F2',
    primaryLight: '#7289DA',
    primaryDark: '#4752C4',

    background: '#36393F',
    surface: '#2F3136',
    surfaceHover: '#40444B',
    card: '#32353B',

    text: '#FFFFFF',
    textSecondary: '#B9BBBE',
    textMuted: '#72767D',
    textInverse: '#000000',

    border: '#202225',
    borderLight: '#40444B',

    success: '#3BA55C',
    warning: '#FAA61A',
    error: '#ED4245',
    info: '#5865F2',

    wolf: '#ED4245',
    villager: '#3BA55C',
    god: '#5865F2',

    overlay: 'rgba(0, 0, 0, 0.7)',
    overlayLight: 'rgba(0, 0, 0, 0.4)',
  },
};

const minimalTheme: Theme = {
  key: 'minimal',
  name: '极简',
  isDark: false,
  colors: {
    // 纯黑白灰，无彩色
    primary: '#333333',
    primaryLight: '#555555',
    primaryDark: '#111111',

    // 纯白背景
    background: '#FFFFFF',
    surface: '#F5F5F5',
    surfaceHover: '#EEEEEE',
    card: '#FFFFFF',

    // 黑白灰文字层次
    text: '#000000',
    textSecondary: '#444444',
    textMuted: '#888888',
    textInverse: '#FFFFFF',

    // 灰色边框
    border: '#CCCCCC',
    borderLight: '#E0E0E0',

    // 状态色也用灰度
    success: '#333333',
    warning: '#666666',
    error: '#000000',
    info: '#555555',

    // 游戏角色色（保持区分度）
    wolf: '#222222',
    villager: '#666666',
    god: '#444444',

    overlay: 'rgba(0, 0, 0, 0.5)',
    overlayLight: 'rgba(0, 0, 0, 0.2)',
  },
};

// ============================================
// 导出
// ============================================

export const themes: Record<ThemeKey, Theme> = {
  light: lightTheme,
  minimal: minimalTheme,
  dark: darkTheme,
  midnight: midnightTheme,
  blood: bloodTheme,
  discord: discordTheme,
};

export const defaultTheme: ThemeKey = 'light';
