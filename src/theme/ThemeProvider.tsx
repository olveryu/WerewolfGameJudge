/**
 * ThemeProvider - 主题提供器
 *
 * 用法:
 *   const { colors, t } = useTheme();
 *   <View style={{ backgroundColor: colors.background, padding: t.spacing.md }} />
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
  ReactNode,
} from 'react';
import { Platform, StatusBar } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { themes, defaultTheme, Theme, ThemeKey, ThemeColors } from './themes';
import { spacing, borderRadius, typography, shadows, layout } from './tokens';
import { log } from '../utils/logger';

const themeLog = log.extend('Theme');

// ============================================
// Types
// ============================================

interface ThemeContextValue {
  // Current theme
  theme: Theme;
  themeKey: ThemeKey;
  isDark: boolean;

  // Colors shortcut
  colors: ThemeColors;

  // Design tokens (t for tokens)
  t: {
    spacing: typeof spacing;
    borderRadius: typeof borderRadius;
    typography: typeof typography;
    shadows: typeof shadows;
    layout: typeof layout;
  };

  // Actions
  setTheme: (key: ThemeKey) => void;
  toggleTheme: () => void;

  // Available themes for picker
  availableThemes: Theme[];
}

// ============================================
// Context
// ============================================

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = '@werewolf_theme';

// ============================================
// Provider
// ============================================

interface ThemeProviderProps {
  children: ReactNode;
  initialTheme?: ThemeKey;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({
  children,
  initialTheme = defaultTheme,
}) => {
  const [themeKey, setThemeKey] = useState<ThemeKey>(initialTheme);

  // Load saved theme on mount
  useEffect(() => {
    const loadTheme = async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (saved && saved in themes) {
          setThemeKey(saved as ThemeKey);
        }
      } catch (error) {
        const e = error as { message?: string; name?: string; code?: string };
        themeLog.warn('Failed to load saved theme', {
          message: e?.message ?? String(error),
          name: e?.name,
          code: e?.code,
        });
      }
    };
    loadTheme();
  }, []);

  // Update status bar / theme-color when theme changes
  useEffect(() => {
    const theme = themes[themeKey];

    // Native: Update StatusBar
    if (Platform.OS !== 'web') {
      StatusBar.setBarStyle(theme.isDark ? 'light-content' : 'dark-content', true);
      // Android only: set background color
      if (Platform.OS === 'android') {
        StatusBar.setBackgroundColor(theme.colors.background, true);
      }
    }

    // Web: Update meta tags
    if (typeof document !== 'undefined') {
      const themeColorMeta = document.querySelector('meta[name="theme-color"]');
      if (themeColorMeta) {
        themeColorMeta.setAttribute('content', theme.colors.primary);
      }

      const bgColorMeta = document.querySelector('meta[name="background-color"]');
      if (bgColorMeta) {
        bgColorMeta.setAttribute('content', theme.colors.background);
      }

      document.body.style.backgroundColor = theme.colors.background;
    }
  }, [themeKey]);

  // Set theme and persist
  const setTheme = useCallback((key: ThemeKey) => {
    setThemeKey(key);
    AsyncStorage.setItem(STORAGE_KEY, key).catch((error) => {
      const e = error as { message?: string; name?: string; code?: string };
      themeLog.warn('Failed to save theme', {
        message: e?.message ?? String(error),
        name: e?.name,
        code: e?.code,
      });
    });
  }, []);

  // Toggle between dark and light
  const toggleTheme = useCallback(() => {
    setTheme(themeKey === 'dark' ? 'light' : 'dark');
  }, [themeKey, setTheme]);

  // Memoized value
  const value = useMemo<ThemeContextValue>(() => {
    const theme = themes[themeKey];
    return {
      theme,
      themeKey,
      isDark: theme.isDark,
      colors: theme.colors,
      t: {
        spacing,
        borderRadius,
        typography,
        shadows,
        layout,
      },
      setTheme,
      toggleTheme,
      availableThemes: Object.values(themes),
    };
  }, [themeKey, setTheme, toggleTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

// ============================================
// Hooks
// ============================================

/**
 * Main theme hook - 获取完整主题上下文
 */
export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

/**
 * Colors only hook - 只获取颜色（性能优化）
 */
export function useColors(): ThemeColors {
  const { colors } = useTheme();
  return colors;
}

/**
 * Tokens hook - 只获取 design tokens
 */
export function useTokens() {
  const { t } = useTheme();
  return t;
}

// ============================================
// Re-export tokens for direct import
// ============================================
export { spacing, borderRadius, typography, shadows, layout } from './tokens';
export { themes, type ThemeKey, type ThemeColors, type Theme } from './themes';
