/**
 * MenuItem - Memoized menu item component
 *
 * Uses shared styles from parent to avoid redundant StyleSheet.create.
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

function arePropsEqual(prev: MenuItemProps, next: MenuItemProps): boolean {
  return (
    prev.icon === next.icon &&
    prev.title === next.title &&
    prev.subtitle === next.subtitle &&
    prev.testID === next.testID &&
    prev.styles === next.styles
    // onPress excluded - uses ref pattern in parent for stability
  );
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

export const MenuItem = memo(MenuItemComponent, arePropsEqual);
