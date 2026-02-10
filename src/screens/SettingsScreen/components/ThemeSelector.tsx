/**
 * ThemeSelector - 主题选择组件（Memoized）
 *
 * 显示可用主题列表，通过 onThemeChange 上报选择。
 *
 * ✅ 允许：渲染 UI + 上报用户 intent
 * ❌ 禁止：import service / 业务逻辑判断
 */
import React, { memo, useCallback } from 'react';
import { Text, TouchableOpacity,View } from 'react-native';

import { SettingsScreenStyles } from './styles';

export interface ThemeOption {
  key: string;
  name: string;
}

export interface ThemeSelectorProps {
  currentThemeKey: string;
  availableThemes: ThemeOption[];
  onThemeChange: (key: string) => void;
  styles: SettingsScreenStyles;
}

const arePropsEqual = (prev: ThemeSelectorProps, next: ThemeSelectorProps): boolean => {
  return (
    prev.currentThemeKey === next.currentThemeKey &&
    prev.styles === next.styles &&
    // availableThemes rarely changes, but check length for safety
    prev.availableThemes.length === next.availableThemes.length
  );
};

export const ThemeSelector = memo<ThemeSelectorProps>(
  ({ currentThemeKey, availableThemes, onThemeChange, styles }) => {
    const renderThemeOption = useCallback(
      (theme: ThemeOption) => {
        const isActive = currentThemeKey === theme.key;
        return (
          <TouchableOpacity
            key={theme.key}
            style={[styles.themeOption, isActive && styles.themeOptionActive]}
            onPress={() => onThemeChange(theme.key)}
          >
            <Text style={[styles.themeOptionText, isActive && styles.themeOptionTextActive]}>
              {theme.name}
            </Text>
          </TouchableOpacity>
        );
      },
      [currentThemeKey, onThemeChange, styles],
    );

    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>主题</Text>
        <View style={styles.themeOptions}>{availableThemes.map(renderThemeOption)}</View>
      </View>
    );
  },
  arePropsEqual,
);

ThemeSelector.displayName = 'ThemeSelector';
