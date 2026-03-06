/**
 * MenuItem - 菜单项（Memoized）
 *
 * 显示 icon + 标题 + 可选副标题，通过 onPress 上报点击意图。
 * 渲染 UI 并上报用户 intent，不 import service，不包含业务逻辑判断。
 */
import { Ionicons } from '@expo/vector-icons';
import React, { memo, type ReactNode } from 'react';
import { Text, View } from 'react-native';

import { PressableScale } from '@/components/PressableScale';
import { type ThemeColors } from '@/theme';
import { componentSizes } from '@/theme/tokens';

import { type HomeScreenStyles } from './styles';

interface MenuItemProps {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  disabled?: boolean;
  onPress: () => void;
  testID?: string;
  styles: HomeScreenStyles;
  colors: ThemeColors;
}

const MenuItemComponent: React.FC<MenuItemProps> = ({
  icon,
  title,
  subtitle,
  disabled,
  onPress,
  testID,
  styles,
  colors,
}) => {
  return (
    <PressableScale
      testID={testID}
      style={[styles.menuItem, disabled && styles.menuItemDisabled]}
      onPress={onPress}
      disabled={disabled}
      activeScale={disabled ? 1 : 0.97}
      accessibilityLabel={title}
    >
      <View style={styles.menuIcon}>
        {typeof icon === 'string' ? <Text style={styles.menuIconText}>{icon}</Text> : icon}
      </View>
      <View style={styles.menuContent}>
        <Text style={styles.menuTitle}>{title}</Text>
        {subtitle && <Text style={styles.menuSubtitle}>{subtitle}</Text>}
      </View>
      <Ionicons name="chevron-forward" size={componentSizes.icon.md} color={colors.textMuted} />
    </PressableScale>
  );
};

export const MenuItem = memo(MenuItemComponent);
