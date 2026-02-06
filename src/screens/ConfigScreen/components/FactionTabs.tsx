/**
 * FactionTabs - Segmented tab bar for switching between faction groups
 *
 * Displays faction emoji + title + count badge per tab.
 * Active tab is highlighted with accent color underline.
 *
 * Performance: Memoized, receives pre-created styles from parent.
 */
import React, { memo, useCallback } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { ConfigScreenStyles } from './styles';

export interface FactionTabItem {
  key: string;
  emoji: string;
  title: string;
  count: number;
  accentColor: string;
}

export interface FactionTabsProps {
  tabs: FactionTabItem[];
  activeKey: string;
  onTabPress: (key: string) => void;
  styles: ConfigScreenStyles;
}

const arePropsEqual = (prev: FactionTabsProps, next: FactionTabsProps): boolean => {
  if (
    prev.activeKey !== next.activeKey ||
    prev.styles !== next.styles ||
    prev.tabs.length !== next.tabs.length
  ) {
    return false;
  }
  for (let i = 0; i < prev.tabs.length; i++) {
    const p = prev.tabs[i];
    const n = next.tabs[i];
    if (p.key !== n.key || p.count !== n.count || p.accentColor !== n.accentColor) {
      return false;
    }
  }
  return true;
};

export const FactionTabs = memo<FactionTabsProps>(
  ({ tabs, activeKey, onTabPress, styles }) => {
    return (
      <View style={styles.tabBar}>
        {tabs.map((tab) => {
          const isActive = tab.key === activeKey;
          return (
            <FactionTab
              key={tab.key}
              tab={tab}
              isActive={isActive}
              onPress={onTabPress}
              styles={styles}
            />
          );
        })}
      </View>
    );
  },
  arePropsEqual,
);

FactionTabs.displayName = 'FactionTabs';

// ── Individual Tab (internal) ──────────────────

interface FactionTabProps {
  tab: FactionTabItem;
  isActive: boolean;
  onPress: (key: string) => void;
  styles: ConfigScreenStyles;
}

const FactionTab = memo<FactionTabProps>(({ tab, isActive, onPress, styles }) => {
  const handlePress = useCallback(() => onPress(tab.key), [tab.key, onPress]);

  return (
    <TouchableOpacity
      testID={`config-faction-tab-${tab.key}`}
      style={[styles.tab, isActive && styles.tabActive]}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <Text
        style={[
          styles.tabLabel,
          isActive && { color: tab.accentColor },
        ]}
      >
        {tab.emoji} {tab.title}
      </Text>
      <View
        style={[
          styles.tabBadge,
          isActive
            ? { backgroundColor: tab.accentColor + '20' }
            : undefined,
        ]}
      >
        <Text
          style={[
            styles.tabBadgeText,
            isActive ? { color: tab.accentColor } : undefined,
          ]}
        >
          {tab.count}
        </Text>
      </View>
      {isActive && (
        <View style={[styles.tabIndicator, { backgroundColor: tab.accentColor }]} />
      )}
    </TouchableOpacity>
  );
});

FactionTab.displayName = 'FactionTab';
