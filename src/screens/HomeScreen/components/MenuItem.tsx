/**
 * MenuItem - 菜单项（Memoized）
 *
 * 显示 icon + 标题 + 可选副标题，通过 onPress 上报点击意图。
 *
 * ✅ 允许：渲染 UI + 上报用户 intent
 * ❌ 禁止：import service / 业务逻辑判断
 */
import React, { memo, type ReactNode } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { type HomeScreenStyles } from './styles';

export interface MenuItemProps {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  onPress: () => void;
  testID?: string;
  styles: HomeScreenStyles;
}

const MenuItemComponent: React.FC<MenuItemProps> = ({
  icon,
  title,
  subtitle,
  onPress,
  testID,
  styles,
}) => {
  return (
    <TouchableOpacity testID={testID} style={styles.menuItem} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.menuIcon}>
        {typeof icon === 'string' ? <Text style={styles.menuIconText}>{icon}</Text> : icon}
      </View>
      <View style={styles.menuContent}>
        <Text style={styles.menuTitle}>{title}</Text>
        {subtitle && <Text style={styles.menuSubtitle}>{subtitle}</Text>}
      </View>
      <Text style={styles.menuArrow}>›</Text>
    </TouchableOpacity>
  );
};

export const MenuItem = memo(MenuItemComponent);
