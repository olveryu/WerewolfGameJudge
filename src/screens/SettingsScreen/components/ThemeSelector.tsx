/**
 * ThemeSelector - 主题选择组件（Memoized）
 *
 * 显示可用主题列表，通过 onThemeChange 上报选择。
 * 渲染 UI 并上报用户 intent，不 import service，不包含业务逻辑判断。
 */
import { memo, useCallback, useMemo } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { SettingsScreenStyles } from './styles';

interface ThemeOption {
  key: string;
  name: string;
}

interface ThemeSelectorProps {
  currentThemeKey: string;
  availableThemes: ThemeOption[];
  onThemeChange: (key: string) => void;
  styles: SettingsScreenStyles;
}

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

    const COLUMNS = 4;
    const spacerCount = (COLUMNS - (availableThemes.length % COLUMNS)) % COLUMNS;
    const spacers = useMemo(
      () =>
        Array.from({ length: spacerCount }, (_, i) => (
          <View key={`spacer-${i}`} style={styles.themeOption} />
        )),
      [spacerCount, styles.themeOption],
    );

    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>主题</Text>
        <View style={styles.themeOptions}>
          {availableThemes.map(renderThemeOption)}
          {spacers}
        </View>
      </View>
    );
  },
);

ThemeSelector.displayName = 'ThemeSelector';
