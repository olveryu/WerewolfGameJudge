/**
 * themes - Theme Colors configuration
 *
 * 定义所有主题的颜色方案（dark / blood / nature / ocean / light）。
 * 每个主题实现 ThemeColors 接口，包含 primary / background / surface / text 等语义色。
 *
 * ✅ 允许：颜色值定义、主题注册
 * ❌ 禁止：业务逻辑、import React / service
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

export type ThemeKey =
  | 'light'
  | 'minimal'
  | 'dark'
  | 'midnight'
  | 'blood'
  | 'discord'
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

    overlay: 'rgba(12, 25, 41, 0.85)',
    overlayLight: 'rgba(12, 25, 41, 0.5)',
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
  forest: forestTheme,
  snow: snowTheme,
};

export const defaultTheme: ThemeKey = 'light';
